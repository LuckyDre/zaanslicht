/**
 * Zaans Licht — Cloudflare Worker
 * Beheert e-mailabonnees, verzendt nieuwsbrieven en levert nieuws-feed.
 *
 * Endpoints:
 *   POST /subscribe      { email }               → abonneren
 *   POST /unsubscribe    { token }               → afmelden
 *   GET  /count          (vereist X-Worker-Secret) → { count }
 *   POST /send           (vereist X-Worker-Secret) → { subject, message } → mails versturen
 *   GET  /nieuws                                  → geaggregeerde RSS nieuws-feed (JSON)
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

// ── RSS NIEUWS FEED ────────────────────────────────────────────────────────

// Clubs van de clubs-pagina — altijd prioriteit in nieuws
const CLUB_KEYWORDS = [
  'zcfc','zvv zaandijk','fortuna wormerveer','sporting krommenie','ofc oostzaan',
  'vv assendelft','kfc 1910','tos actief','united davo','wsv 1930','sv dts',
  'saenden','de blokkers','alcmaria','sv koedijk','vv opperdoes','sc purmerland',
  'volewijckers','afc ijburg',
];

const ZAANSTREEK_FILTER = [
  'zaanstreek','zaandam','zaanstad','koog aan de zaan','wormerveer','assendelft',
  'krommenie','zaandijk','oostzaan','purmerend','zaankanter','purmerland',
  ...CLUB_KEYWORDS,
];

const SPELER_KEYWORDS = [
  'transfer','aanwinst','tekent','verlengt','speler','aanvaller','verdediger',
  'keeper','middenvelder','doelman','debuut','selectie','oproep',
];

// Filter-helper: ondersteunt woordgrens voor korte termen (bijv. 'az')
function matchFilter(tekst, filters) {
  return filters.some(kw => {
    if (kw.length <= 3) return new RegExp('\\b' + kw + '\\b', 'i').test(tekst);
    return tekst.includes(kw);
  });
}

// Bronnen — clubs-feeds hebben geen filter (altijd relevant)
const RSS_BRONNEN = [
  // ── AZ — VI.nl AZ-specifieke feed (bevestigd werkend) ──
  { url: 'https://www.vi.nl/feed/news.xml?tag=az', label: 'AZ', categorie: 'az', filter: null },

  // ── KNVB — VI.nl KNVB-tag + FCUpdate algemeen ──
  { url: 'https://www.vi.nl/feed/news.xml?tag=knvb',       label: 'KNVB', categorie: 'knvb', filter: null },
  { url: 'https://www.vi.nl/feed/news.xml',                label: 'KNVB', categorie: 'knvb', filter: ['knvb','bondscoach','nationaal elftal','oranje'] },
  { url: 'https://www.fcupdate.nl/rss',                    label: 'KNVB', categorie: 'knvb', filter: ['knvb','bondscoach','oranje','eredivisie'] },

  // ── REGIONAAL — NHNieuws ──
  { url: 'https://www.nhnieuws.nl/rss/nieuws', label: 'NHNieuws', categorie: 'zaanstreek',
    filter: [...ZAANSTREEK_FILTER, 'voetbal'] },

  // ── LOKALE CLUBS (eigen feeds, bevestigd werkend) ──
  { url: 'https://www.zcfc.nl/feed/',              label: 'ZCFC',               categorie: 'clubs', filter: null },
  { url: 'https://www.zvvzaandijk.nl/feed/',       label: 'ZVV Zaandijk',       categorie: 'clubs', filter: null },
  { url: 'https://www.sportingkrommenie.nl/feed/', label: 'Sporting Krommenie', categorie: 'clubs', filter: null },
  { url: 'https://www.uniteddavo.nl/feed/',        label: 'United Davo',        categorie: 'clubs', filter: null },

  // ── NOOT: ofc-oostzaan.nl, blokkers.nl, fortuna-wormerveer.nl, tos-actief.nl
  //    blokkeren automatisch serververkeer (Cloudflare Bot Protection) —
  //    deze kunnen niet automatisch worden opgehaald. ──
];

const NIEUWS_CACHE_KEY = 'cache:nieuws';
const NIEUWS_CACHE_TTL = 1800; // 30 minuten
const TWEE_MAANDEN_MS  = 180 * 24 * 60 * 60 * 1000; // 180 dagen (half jaar)

function parseRSS(xml, bron) {
  const items = [];
  const itemRgx = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRgx.exec(xml)) !== null) {
    const c = m[1];

    const get = (tag) => {
      const cd = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(c);
      if (cd) return cd[1].trim();
      const pl = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i').exec(c);
      return pl ? pl[1].trim() : '';
    };

    const linkM = /<link[^>]*>(?:<!\[CDATA\[)?(https?:[^\]<\s]+)(?:\]\]>)?<\/link>/i.exec(c)
               || /<link[^>]*href=["'](https?:[^"']+)["'][^>]*\/>/i.exec(c);
    const link = linkM ? linkM[1].trim() : get('guid').replace(/^<!\[CDATA\[|\]\]>$/g, '').trim();

    const rawDesc = get('description');
    const beschrijving = rawDesc
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
      .replace(/&#\d+;/g,'').replace(/&[a-z]+;/g,'').replace(/\s+/g,' ').trim();

    const titel   = get('title');
    const pubDate = get('pubDate');
    if (!titel || !link) continue;

    const ts = pubDate ? new Date(pubDate).getTime() : 0;

    // Sla items ouder dan 2 maanden over (maar behoud items zonder datum)
    if (ts > 0 && ts < Date.now() - TWEE_MAANDEN_MS) continue;

    const tekst    = (titel + ' ' + beschrijving).toLowerCase();
    const isSpeler = SPELER_KEYWORDS.some(kw => tekst.includes(kw));
    const isClub   = bron.categorie === 'clubs' || CLUB_KEYWORDS.some(kw => tekst.includes(kw));

    items.push({
      titel,
      link,
      beschrijving: beschrijving.length > 220 ? beschrijving.slice(0, 220) + '…' : beschrijving,
      pubDate,
      datum: pubDate ? new Date(pubDate).toLocaleDateString('nl-NL', { day:'numeric', month:'short', year:'numeric' }) : '',
      ts,
      bron:      bron.label,
      categorie: isSpeler ? 'speler' : isClub ? 'clubs' : bron.categorie,
    });
  }
  return items;
}

async function handleNieuws(request, env) {
  const url    = new URL(request.url);
  const forceer = url.searchParams.has('forceer');

  // Serveer uit cache (tenzij forceer=true)
  if (!forceer) {
    try {
      const cached = await env.SUBSCRIBERS.get(NIEUWS_CACHE_KEY);
      if (cached) return json(JSON.parse(cached));
    } catch {}
  }

  // Haal alle RSS-bronnen parallel op
  const resultaten = await Promise.allSettled(
    RSS_BRONNEN.map(async (bron) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const res = await fetch(bron.url, {
          headers: { 'User-Agent': 'ZaansLicht-NewsFeed/1.0 (zaanslicht.com)' },
          signal:  controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml   = await res.text();
        const items = parseRSS(xml, bron);
        if (!bron.filter) return items;
        return items.filter(item => {
          const tekst = (item.titel + ' ' + item.beschrijving).toLowerCase();
          return matchFilter(tekst, bron.filter);
        });
      } finally {
        clearTimeout(timer);
      }
    })
  );

  // Combineer, verwijder dubbele labels/URL's, sorteer: clubs eerst, dan op datum
  const alles  = resultaten.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const gezien = new Set();
  const uniek  = alles.filter(i => {
    if (gezien.has(i.link)) return false;
    gezien.add(i.link);
    return true;
  });
  uniek.sort((a, b) => {
    // Clubs en KNVB/AZ altijd bovenaan
    const prioriteit = (i) => (i.categorie === 'clubs' ? 0 : i.categorie === 'knvb' || i.categorie === 'az' ? 1 : 2);
    const pDiff = prioriteit(a) - prioriteit(b);
    if (pDiff !== 0) return pDiff;
    return b.ts - a.ts;
  });
  const top60 = uniek.slice(0, 60);

  try { await env.SUBSCRIBERS.put(NIEUWS_CACHE_KEY, JSON.stringify(top60), { expirationTtl: NIEUWS_CACHE_TTL }); } catch {}

  return json(top60);
}

// ── DEBUG ENDPOINT ────────────────────────────────────────────────────────
async function handleNieuwsDebug(request, env) {
  const resultaten = await Promise.allSettled(
    RSS_BRONNEN.map(async (bron) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const res = await fetch(bron.url, {
          headers: { 'User-Agent': 'ZaansLicht-NewsFeed/1.0 (zaanslicht.com)' },
          signal: controller.signal,
        });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) return { url: bron.url, label: bron.label, status: res.status, error: `HTTP ${res.status}` };
        const xml = await res.text();
        const items = parseRSS(xml, bron);
        const filtered = bron.filter ? items.filter(item => {
          const tekst = (item.titel + ' ' + item.beschrijving).toLowerCase();
          return matchFilter(tekst, bron.filter);
        }) : items;
        return { url: bron.url, label: bron.label, status: res.status, contentType: ct.slice(0,40), totalItems: items.length, filteredItems: filtered.length, firstTitle: filtered[0]?.titel || items[0]?.titel || '—' };
      } catch(e) {
        return { url: bron.url, label: bron.label, error: e.message };
      } finally {
        clearTimeout(timer);
      }
    })
  );
  return json(resultaten.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message }));
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
    if (url.pathname === '/nieuws'      && request.method === 'GET')  return handleNieuws(request, env);
    if (url.pathname === '/nieuws-debug' && request.method === 'GET') return handleNieuwsDebug(request, env);

    return new Response('Zaans Licht Worker', { status: 200, headers: CORS_HEADERS });
  },
};
