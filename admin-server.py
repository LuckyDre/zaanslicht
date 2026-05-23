#!/usr/bin/env python3
"""
Lokale admin server voor Zaans Licht — http://localhost:8765
Start via: python3 admin-server.py
Of dubbelklik op 'Start Admin.command' op het bureaublad.
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import subprocess, json, os, sys
from pathlib import Path

SITE   = Path(__file__).parent
PORT   = 8765
SIPS   = '/usr/bin/sips'
CWEBP  = '/opt/homebrew/bin/cwebp'
GIT    = '/usr/bin/git'

class AdminHandler(SimpleHTTPRequestHandler):

    def do_GET(self):
        if self.path.startswith('/api/'):
            self.handle_api(self.path[5:])
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/save-manifest':
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            try:
                data = json.loads(body)
                with open(SITE / 'manifest.json', 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                self.json_response({'success': True, 'msg': 'manifest.json opgeslagen'})
            except Exception as e:
                self.json_response({'success': False, 'msg': str(e)})
        else:
            self.send_error(404)

    def handle_api(self, action):
        if   action == 'status':   self.json_response(self.get_status())
        elif action == 'convert':  self.json_response(self.run_convert())
        elif action == 'sync':     self.json_response(self.run_sync())
        elif action == 'manifest': self.serve_manifest()
        else:                      self.send_error(404)

    # ── MANIFEST lezen ──────────────────────────────────────────────────────
    def serve_manifest(self):
        try:
            with open(SITE / 'manifest.json', encoding='utf-8') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.cors()
            self.end_headers()
            self.wfile.write(data.encode())
        except Exception as e:
            self.json_response({'error': str(e)})

    # ── STATUS ──────────────────────────────────────────────────────────────
    def get_status(self):
        unconverted = []
        for ext in ['jpg', 'JPG', 'jpeg', 'JPEG', 'png', 'PNG']:
            for f in SITE.rglob(f'*.{ext}'):
                if '_originelen' in str(f): continue
                if f.stem in ('logo', 'logo-oranje', 'profiel'): continue
                unconverted.append(str(f.relative_to(SITE)))

        git_out = subprocess.run([GIT, 'status', '--porcelain'],
                                 cwd=SITE, capture_output=True, text=True).stdout.strip()
        changes = len([l for l in git_out.splitlines() if l]) if git_out else 0
        return {'unconverted': len(unconverted), 'git_changes': changes}

    # ── CONVERTEREN ─────────────────────────────────────────────────────────
    def run_convert(self):
        converted, errors = [], []
        tmp = '/tmp/zl_conv.jpg'

        for ext in ['jpg', 'JPG', 'jpeg', 'JPEG']:
            for f in list(SITE.rglob(f'*.{ext}')):
                if '_originelen' in str(f): continue
                if f.stem in ('logo', 'logo-oranje', 'profiel'): continue
                try:
                    subprocess.run([SIPS, '-Z', '2200', str(f), '--out', tmp],
                                   capture_output=True, check=True)
                    webp = f.with_suffix('.webp')
                    subprocess.run([CWEBP, '-q', '82', tmp, '-o', str(webp)],
                                   capture_output=True, check=True)
                    f.unlink()
                    converted.append(f.name)
                except Exception as e:
                    errors.append(f'{f.name}: {e}')

        # Manifest opnieuw genereren
        subprocess.run([sys.executable, str(SITE / 'generate-manifest.py')], cwd=SITE)

        return {
            'success': True,
            'converted': len(converted),
            'bestanden': converted,
            'errors': errors,
            'msg': f'{len(converted)} foto\'s geconverteerd naar WebP'
        }

    # ── SYNC NAAR GITHUB ────────────────────────────────────────────────────
    def run_sync(self):
        log = []
        try:
            # Manifest vernieuwen
            r = subprocess.run([sys.executable, str(SITE / 'generate-manifest.py')],
                               cwd=SITE, capture_output=True, text=True)
            log.append(r.stdout.strip())

            # Git add
            subprocess.run([GIT, 'add', '-A'], cwd=SITE, check=True)

            # Controleer of er iets te committen is
            status = subprocess.run([GIT, 'status', '--porcelain'],
                                    cwd=SITE, capture_output=True, text=True).stdout.strip()
            if not status:
                return {'success': True, 'msg': '✓ Alles is al up-to-date', 'log': log}

            # Commit
            import datetime
            ts  = datetime.datetime.now().strftime('%d-%m-%Y %H:%M')
            msg = f'Beheer sync: {ts}'
            subprocess.run([GIT, 'commit', '-m', msg], cwd=SITE, check=True)
            log.append(f'Commit: {msg}')

            # Push
            push = subprocess.run([GIT, 'push'], cwd=SITE, capture_output=True, text=True)
            log.append(push.stdout.strip() or push.stderr.strip())

            return {'success': True, 'msg': '✓ Site bijgewerkt op GitHub', 'log': log}

        except subprocess.CalledProcessError as e:
            return {'success': False, 'msg': f'Git fout: {e}', 'log': log}
        except Exception as e:
            return {'success': False, 'msg': str(e), 'log': log}

    # ── HELPERS ─────────────────────────────────────────────────────────────
    def json_response(self, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.cors()
        self.end_headers()
        self.wfile.write(body)

    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')

    def log_message(self, *args):
        pass  # Geen access-log in terminal

if __name__ == '__main__':
    os.chdir(SITE)
    server = HTTPServer(('localhost', PORT), AdminHandler)
    print(f'\n✓ Zaans Licht Admin — http://localhost:{PORT}/admin.html')
    print('  Ctrl+C om te stoppen\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer gestopt.')
