/**
 * Zaans Licht — Cloudflare Worker
 * Beheert e-mailabonnees en verzendt nieuwsbrieven via Resend.
 *
 * Endpoints:
 *   POST /subscribe      { email }               → abonneren
 *   POST /unsubscribe    { token }               → afmelden
 *   GET  /count          (vereist X-Worker-Secret) → { count }
 *   POST /send           (vereist X-Worker-Secret) → { subject, message } → mails versturen
 *
 * Benodigde Worker-omgevingsvariabelen (in Cloudflare dashboard → Settings → Variables):
 *   WORKER_SECRET      willekeurige geheime sleutel (bijv. een lang wachtwoord)
 *   RESEND_API_KEY     jouw Resend API-sleutel
 *   FROM_EMAIL         bijv.  updates@zaanslicht.com  (domein moet geverifieerd zijn in Resend)
 *
 * Benodigde KV-namespace binding genaamd "SUBSCRIBERS" (zie wrangler.toml)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  'https://zaanslicht.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Worker-Secret',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function requireSecret(request, env) {
  return request.headers.get('X-Worker-Secret') === env.WORKER_SECRET;
}

// ── ABONNEER ──────────────────────────────────────────────────────────────
async function handleSubscribe(request, env) {
  const { email } = await request.json().catch(() => ({}));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Ongeldig e-mailadres' }, 400);
  }

  const emailLower = email.toLowerCase().trim();

  // Controleer of dit adres al bestaat
  const existing = await env.SUBSCRIBERS.get('sub:' + emailLower);
  if (existing) return json({ ok: true, message: 'Al aangemeld' });

  // Genereer uniek token voor afmeldlink
  const token = Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const subscriber = { email: emailLower, token, ts: Date.now() };

  // Sla twee vermeldingen op: e-mail → gegevens en token → e-mail (voor opzoeken)
  await env.SUBSCRIBERS.put('sub:' + emailLower, JSON.stringify(subscriber));
  await env.SUBSCRIBERS.put('tok:' + token, emailLower);

  return json({ ok: true });
}

// ── AFMELDEN ──────────────────────────────────────────────────────────────
async function handleUnsubscribe(request, env) {
  const { token } = await request.json().catch(() => ({}));
  if (!token) return json({ error: 'Token ontbreekt' }, 400);

  const emailLower = await env.SUBSCRIBERS.get('tok:' + token);
  if (!emailLower) return json({ error: 'Onbekend token' }, 404);

  await env.SUBSCRIBERS.delete('sub:' + emailLower);
  await env.SUBSCRIBERS.delete('tok:' + token);

  return json({ ok: true });
}

// ── AANTAL ABONNEES ────────────────────────────────────────────────────────
async function handleCount(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);

  let count = 0;
  let cursor = undefined;
  do {
    const result = await env.SUBSCRIBERS.list({ prefix: 'sub:', cursor, limit: 1000 });
    count += result.keys.length;
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return json({ count });
}

// ── VERSTUUR NIEUWSBRIEF ───────────────────────────────────────────────────
async function handleSend(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);

  const { subject, message } = await request.json().catch(() => ({}));
  if (!subject || !message) return json({ error: 'Subject en message zijn verplicht' }, 400);

  // Haal alle abonnees op
  const emails = [];
  let cursor = undefined;
  do {
    const result = await env.SUBSCRIBERS.list({ prefix: 'sub:', cursor, limit: 1000 });
    for (const key of result.keys) {
      const raw = await env.SUBSCRIBERS.get(key.name);
      if (raw) {
        try { emails.push(JSON.parse(raw)); } catch {}
      }
    }
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  if (!emails.length) return json({ sent: 0, message: 'Geen abonnees' });

  // Stuur mails via Resend
  let sent = 0;
  let errors = 0;

  for (const sub of emails) {
    const unsubUrl = `https://zaanslicht.com/afmelden.html?token=${sub.token}`;
    const html = buildEmail(message, unsubUrl);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    env.FROM_EMAIL || 'Zaans Licht <updates@zaanslicht.com>',
        to:      sub.email,
        subject: subject,
        html:    html,
      }),
    });

    if (res.ok) sent++; else errors++;
  }

  return json({ sent, errors });
}

// ── E-MAIL TEMPLATE ────────────────────────────────────────────────────────
function buildEmail(message, unsubscribeUrl) {
  // Vervang newlines door <br> voor HTML-opmaak
  const htmlMessage = message
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zaans Licht — Nieuwe foto's</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

      <!-- HEADER -->
      <tr><td style="background:#0d0d0d;padding:28px 36px;text-align:center;">
        <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:2px;">
          Zaans<span style="color:#FF6B00;"> Licht</span>
        </p>
        <p style="margin:6px 0 0;font-size:11px;color:#555;letter-spacing:3px;text-transform:uppercase;">Fotografie door Andreas Luckfiel</p>
      </td></tr>

      <!-- DIVIDER -->
      <tr><td style="height:4px;background:linear-gradient(90deg,#FF6B00,#ff9a00);"></td></tr>

      <!-- INHOUD -->
      <tr><td style="padding:36px 36px 28px;">
        <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.7;">${htmlMessage}</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="https://zaanslicht.com" style="display:inline-block;background:#FF6B00;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:1px;">
            Bekijk de nieuwe foto&rsquo;s &rarr;
          </a>
        </div>
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:20px 36px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#aaa;line-height:1.8;">
          Je ontvangt deze mail omdat je je hebt aangemeld voor updates van Zaans Licht.<br>
          <a href="${unsubscribeUrl}" style="color:#FF6B00;text-decoration:none;">Klik hier om je af te melden</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── MAIN HANDLER ───────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/subscribe'   && request.method === 'POST') return handleSubscribe(request, env);
    if (url.pathname === '/unsubscribe' && request.method === 'POST') return handleUnsubscribe(request, env);
    if (url.pathname === '/count'       && request.method === 'GET')  return handleCount(request, env);
    if (url.pathname === '/send'        && request.method === 'POST') return handleSend(request, env);

    return new Response('Zaans Licht Worker', { status: 200, headers: CORS_HEADERS });
  },
};
