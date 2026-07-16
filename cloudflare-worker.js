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
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Worker-Secret, X-Fotograaf-Token',
  'X-Content-Type-Options':       'nosniff',
  'Referrer-Policy':              'strict-origin-when-cross-origin',
  'X-Frame-Options':              'DENY',
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

  const existing = await env.SUBSCRIBERS.get('sub:' + emailLower);
  if (existing) return json({ ok: true, message: 'Al aangemeld' });

  const token = Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const subscriber = { email: emailLower, token, ts: Date.now() };

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

  // Controleer pauze
  const paused = await env.SUBSCRIBERS.get('settings:paused');
  if (paused === '1') return json({ sent: 0, message: 'Verzenden is gepauzeerd' });

  let sent = 0, errors = 0, skipped = 0;

  for (const sub of emails) {
    // Sla gebande abonnees over
    const banned = await env.SUBSCRIBERS.get('ban:' + sub.email);
    if (banned === '1') { skipped++; continue; }

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
        headers: {
          'List-Unsubscribe': `<https://zaanslicht.com/afmelden.html?token=${sub.token}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });

    if (res.ok) sent++; else errors++;
  }

  return json({ sent, errors, skipped });
}

// ── E-MAIL TEMPLATE ────────────────────────────────────────────────────────
function buildEmail(message, unsubscribeUrl) {
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
      <tr><td style="background:#0d0d0d;padding:28px 36px;text-align:center;">
        <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:2px;">
          Zaans<span style="color:#FF6B00;"> Licht</span>
        </p>
        <p style="margin:6px 0 0;font-size:11px;color:#555;letter-spacing:3px;text-transform:uppercase;">Fotografie door Andreas Luckfiel</p>
      </td></tr>
      <tr><td style="height:4px;background:linear-gradient(90deg,#FF6B00,#ff9a00);"></td></tr>
      <tr><td style="padding:36px 36px 28px;">
        <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.7;">${htmlMessage}</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="https://zaanslicht.com" style="display:inline-block;background:#FF6B00;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:1px;">
            Bekijk de nieuwe foto&rsquo;s &rarr;
          </a>
        </div>
      </td></tr>
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

// ── VERWIJDER ABONNEE (admin) ─────────────────────────────────────────────
async function handleDeleteSubscriber(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { email } = await request.json().catch(() => ({}));
  if (!email) return json({ error: 'Email ontbreekt' }, 400);
  const emailLower = email.toLowerCase().trim();
  const raw = await env.SUBSCRIBERS.get('sub:' + emailLower);
  if (raw) {
    const sub = JSON.parse(raw);
    await env.SUBSCRIBERS.delete('sub:' + emailLower);
    if (sub.token) await env.SUBSCRIBERS.delete('tok:' + sub.token);
  }
  await env.SUBSCRIBERS.delete('ban:' + emailLower);
  return json({ ok: true });
}

// ── BAN / UNBAN ABONNEE ───────────────────────────────────────────────────
async function handleBan(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { email, ban } = await request.json().catch(() => ({}));
  if (!email) return json({ error: 'Email ontbreekt' }, 400);
  const emailLower = email.toLowerCase().trim();
  if (ban) {
    await env.SUBSCRIBERS.put('ban:' + emailLower, '1');
  } else {
    await env.SUBSCRIBERS.delete('ban:' + emailLower);
  }
  return json({ ok: true });
}

// ── PAUZE (alle mails aan/uit) ────────────────────────────────────────────
async function handlePause(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { paused } = await request.json().catch(() => ({}));
  if (paused) {
    await env.SUBSCRIBERS.put('settings:paused', '1');
  } else {
    await env.SUBSCRIBERS.delete('settings:paused');
  }
  return json({ ok: true, paused });
}

async function handleGetPause(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const val = await env.SUBSCRIBERS.get('settings:paused');
  return json({ paused: val === '1' });
}

// ── LIJST ABONNEES ────────────────────────────────────────────────────────
async function handleSubscribers(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);

  const list = [];
  let cursor = undefined;
  do {
    const result = await env.SUBSCRIBERS.list({ prefix: 'sub:', cursor, limit: 1000 });
    for (const key of result.keys) {
      const raw = await env.SUBSCRIBERS.get(key.name);
      if (raw) {
        try {
          const sub = JSON.parse(raw);
          list.push({ email: sub.email, ts: sub.ts });
        } catch {}
      }
    }
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  // Voeg ban-status toe
  for (const sub of list) {
    const banned = await env.SUBSCRIBERS.get('ban:' + sub.email);
    sub.banned = banned === '1';
  }
  list.sort((a, b) => b.ts - a.ts);
  return json({ list });
}

// ══════════════════════════════════════════════════════════════════════════
// FOTOGRAFEN SYSTEEM
// ══════════════════════════════════════════════════════════════════════════

// KV keys:
//   fotograaf:invite:{token}   → { naam, email, expires }
//   fotograaf:account:{id}     → { id, naam, email, kleur, passwordHash, ts }
//   fotograaf:token:{token}    → id  (sessie-token na inloggen)
//   fotograaf:mappen:{id}      → [{ map, categorie, ts }]  (eigen mappen)

// R2 keys:  fotografen/{id}/{categorie}/{map}/{filename}.webp (of .jpg — Safari/iOS-fallback)

// ── HELPERS ───────────────────────────────────────────────────────────────
function randomToken(bytes = 24) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2,'0')).join('');
}

async function hashPassword(password) {
  const enc  = new TextEncoder();
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const key  = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 },
    key, 256
  );
  const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${salt}:${hash}`;
}

async function verifyPassword(password, stored) {
  // Oud formaat: gewone SHA-256 hex string (geen dubbele punt)
  if (!stored.startsWith('pbkdf2:')) {
    const enc  = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    const hex  = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === stored;
  }
  // Nieuw formaat: pbkdf2:{salt}:{hash}
  const [, salt, expectedHash] = stored.split(':');
  const enc  = new TextEncoder();
  const key  = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 },
    key, 256
  );
  const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hash === expectedHash;
}

async function getFotograafByToken(token, env) {
  if (!token) return null;
  const res = await env.SUBSCRIBERS.getWithMetadata('fotograaf:token:' + token);
  const waarde = res && res.value;
  if (!waarde) return null;
  const isReview = waarde.startsWith('review:');
  const id  = isReview ? waarde.slice(7) : waarde;
  const raw = await env.SUBSCRIBERS.get('fotograaf:account:' + id);
  if (!raw) return null;
  // Schuivende vervaldatum: geldig gebruik verlengt de sessie met 30 dagen.
  // Max 1x per 24 uur per token (KV-writes zijn gelimiteerd: 1000/dag op het gratis plan)
  // en altijd best-effort: een mislukte verlenging mag een geldige sessie nooit breken.
  // Review-sessies niet verlengen — die horen na 2 uur te verlopen.
  if (!isReview) {
    const laatstVerlengd = (res.metadata && res.metadata.verlengd) || 0;
    if (Date.now() - laatstVerlengd > 24 * 3600 * 1000) {
      try {
        await env.SUBSCRIBERS.put('fotograaf:token:' + token, id, {
          expirationTtl: 30 * 24 * 3600,
          metadata: { verlengd: Date.now() },
        });
      } catch (e) { /* quota of storing — sessie blijft gewoon geldig */ }
    }
  }
  return JSON.parse(raw);
}

// ── UITNODIGEN ─────────────────────────────────────────────────────────────
async function handleFotograafUitnodiging(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { naam, email } = await request.json().catch(() => ({}));
  if (!naam || !email) return json({ error: 'Naam en email verplicht' }, 400);

  const token   = randomToken();
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 dagen
  await env.SUBSCRIBERS.put('fotograaf:invite:' + token, JSON.stringify({ naam, email, expires }), { expirationTtl: 7 * 24 * 3600 });

  const link = `https://zaanslicht.com/fotograaf.html?invite=${token}`;

  // Stuur uitnodigingsmail via Resend
  try {
    const mailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    env.FROM_EMAIL || 'Zaans Licht <updates@zaanslicht.com>',
        to:      email,
        subject: `${naam}, je bent uitgenodigd als fotograaf op Zaans Licht`,
        html: `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
<tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:10px;overflow:hidden;">
<tr><td style="background:#0d0d0d;padding:28px 36px;text-align:center;">
  <p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:2px;">Zaans<span style="color:#FF6B00;"> Licht</span></p>
  <p style="margin:6px 0 0;font-size:11px;color:#555;letter-spacing:3px;text-transform:uppercase;">Fotografie door Andreas Luckfiel</p>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,#FF6B00,#ff9a00);"></td></tr>
<tr><td style="padding:36px;">
  <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111;">Hoi ${naam}! 👋</p>
  <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.7;">Je bent uitgenodigd om foto's te delen op <strong>Zaans Licht</strong>. Klik op de knop hieronder om je account aan te maken.</p>
  <div style="background:#f8f8f8;border-left:4px solid #FF6B00;padding:14px 18px;border-radius:4px;margin:0 0 24px;">
    <p style="margin:0;font-size:13px;color:#555;line-height:1.9;">
      💡 <strong>Bewaar deze mail goed</strong> — de link is 7 dagen geldig en eenmalig te gebruiken.<br>
      🔐 <strong>Kies een sterk wachtwoord</strong> — minimaal 8 tekens, iets wat je goed onthoudt.<br>
      🔖 <strong>Sla de pagina daarna op als bladwijzer</strong> — zo kom je altijd snel terug.
    </p>
  </div>
  <div style="text-align:center;margin:28px 0;">
    <a href="${link}" style="display:inline-block;background:#FF6B00;color:#fff;text-decoration:none;padding:14px 36px;border-radius:6px;font-weight:700;font-size:15px;">Account aanmaken &rarr;</a>
  </div>
  <p style="font-size:12px;color:#aaa;text-align:center;margin-top:16px;">Of kopieer deze link: <span style="color:#FF6B00;word-break:break-all;">${link}</span></p>
</td></tr>
<tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:16px 36px;text-align:center;">
  <p style="margin:0;font-size:11px;color:#aaa;">Zaans Licht — uitnodiging voor gastfotograaf</p>
</td></tr>
</table></td></tr></table></body></html>`,
      }),
    });

    if (!mailRes.ok) {
      const fout = await mailRes.text().catch(() => `HTTP ${mailRes.status}`);
      return json({ ok: true, mailFout: fout, link });
    }
  } catch(mailErr) {
    return json({ ok: true, mailFout: String(mailErr), link });
  }

  return json({ ok: true, mailVerstuurd: true, link });
}

// ── UITNODIGINGEN LIJST (admin) ────────────────────────────────────────────
async function handleUitnodigingenLijst(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const lijst = [];
  let cursor;
  do {
    const r = await env.SUBSCRIBERS.list({ prefix: 'fotograaf:invite:', cursor, limit: 100 });
    for (const key of r.keys) {
      const raw = await env.SUBSCRIBERS.get(key.name);
      if (raw) {
        const inv = JSON.parse(raw);
        const token = key.name.replace('fotograaf:invite:', '');
        lijst.push({ token, naam: inv.naam, email: inv.email, expires: inv.expires,
          verlopen: Date.now() > inv.expires });
      }
    }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  lijst.sort((a, b) => b.expires - a.expires);
  return json({ uitnodigingen: lijst });
}

// ── UITNODIGING INTREKKEN (admin) ──────────────────────────────────────────
async function handleUitnodigingIntrekken(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { token } = await request.json().catch(() => ({}));
  if (!token) return json({ error: 'token verplicht' }, 400);
  await env.SUBSCRIBERS.delete('fotograaf:invite:' + token);
  return json({ ok: true });
}

// ── REGISTREREN ────────────────────────────────────────────────────────────
async function handleFotograafRegister(request, env) {
  const { inviteToken, password, kleur } = await request.json().catch(() => ({}));
  if (!inviteToken || !password) return json({ error: 'Invite token en wachtwoord verplicht' }, 400);

  const raw = await env.SUBSCRIBERS.get('fotograaf:invite:' + inviteToken);
  if (!raw) return json({ error: 'Ongeldige of verlopen uitnodiging' }, 400);

  const invite = JSON.parse(raw);
  if (Date.now() > invite.expires) return json({ error: 'Uitnodiging verlopen' }, 400);

  const id           = randomToken(8);
  const passwordHash = await hashPassword(password);
  const now          = Date.now();
  const account      = { id, naam: invite.naam, email: invite.email, kleur: kleur || '#3b82f6', passwordHash, ts: now, last_login: now };

  await env.SUBSCRIBERS.put('fotograaf:account:' + id, JSON.stringify(account));
  await env.SUBSCRIBERS.put('fotograaf:loginlog:' + id, JSON.stringify([now]));
  await env.SUBSCRIBERS.delete('fotograaf:invite:' + inviteToken);

  const sessieToken = randomToken();
  await env.SUBSCRIBERS.put('fotograaf:token:' + sessieToken, id, { expirationTtl: 30 * 24 * 3600 });

  // Stuur welkomstmail via Resend
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    env.FROM_EMAIL || 'Zaans Licht <updates@zaanslicht.com>',
        to:      account.email,
        subject: 'Welkom bij Zaans Licht — jouw account is aangemaakt',
        html: `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      <tr><td style="background:#0d0d0d;padding:28px 36px;text-align:center;">
        <p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:2px;">Zaans<span style="color:#FF6B00;"> Licht</span></p>
        <p style="margin:6px 0 0;font-size:11px;color:#555;letter-spacing:3px;text-transform:uppercase;">Fotografie door Andreas Luckfiel</p>
      </td></tr>
      <tr><td style="height:4px;background:linear-gradient(90deg,#FF6B00,#ff9a00);"></td></tr>
      <tr><td style="padding:36px 36px 28px;">
        <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111;">Welkom, ${account.naam}! 👋</p>
        <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.7;">
          Je account op Zaans Licht is aangemaakt. Je kunt nu inloggen en foto's uploaden.
        </p>
        <p style="margin:0 0 8px;font-size:14px;color:#555;"><strong>Inloggen:</strong> <a href="https://zaanslicht.com/fotograaf.html" style="color:#FF6B00">zaanslicht.com/fotograaf.html</a></p>
        <p style="margin:0 0 28px;font-size:14px;color:#555;"><strong>E-mailadres:</strong> ${account.email}</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="https://zaanslicht.com/fotograaf.html" style="display:inline-block;background:#FF6B00;color:#fff;text-decoration:none;padding:13px 32px;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:1px;">
            Naar het fotograaf portaal &rarr;
          </a>
        </div>
        <p style="font-size:13px;color:#888;line-height:1.6;">
          Je kunt altijd inloggen met je e-mailadres en het wachtwoord dat je hebt ingesteld.
          Je account heeft geen vervaldatum.
        </p>
      </td></tr>
      <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:20px 36px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#aaa;">Je ontvangt deze mail omdat je bent uitgenodigd als fotograaf op Zaans Licht.</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`,
      }),
    });
  } catch { /* mail-fout mag registratie niet blokkeren */ }

  return json({ ok: true, token: sessieToken, naam: account.naam, kleur: account.kleur, id });
}

// ── INLOGGEN ───────────────────────────────────────────────────────────────
async function handleFotograafLogin(request, env) {
  const { email, password } = await request.json().catch(() => ({}));
  if (!email || !password) return json({ error: 'Email en wachtwoord verplicht' }, 400);

  // Zoek account op email
  let found = null;
  let cursor;
  do {
    const r = await env.SUBSCRIBERS.list({ prefix: 'fotograaf:account:', cursor, limit: 100 });
    for (const key of r.keys) {
      const a = JSON.parse(await env.SUBSCRIBERS.get(key.name));
      if (a.email.toLowerCase() === email.toLowerCase()) { found = a; break; }
    }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor && !found);

  if (!found) return json({ error: 'Onbekend e-mailadres' }, 401);

  const ok = await verifyPassword(password, found.passwordHash);
  if (!ok) return json({ error: 'Onjuist wachtwoord' }, 401);

  // Upgrade SHA-256 hash stilletjes naar PBKDF2 bij eerste inlog na de update
  if (!found.passwordHash.startsWith('pbkdf2:')) {
    found.passwordHash = await hashPassword(password);
    await env.SUBSCRIBERS.put('fotograaf:account:' + found.id, JSON.stringify(found));
  }

  // Controleer blokkering
  const geblokkeerd = await env.SUBSCRIBERS.get('fotograaf:geblokkeerd:' + found.id);
  if (geblokkeerd === '1') return json({ error: 'Je account is tijdelijk geblokkeerd. Neem contact op met de beheerder.' }, 403);

  // Sla login-tijdstip op
  found.last_login = Date.now();
  await env.SUBSCRIBERS.put('fotograaf:account:' + found.id, JSON.stringify(found));

  // Loginlog bijhouden (max 25 entries, nieuwste eerst)
  const logRaw   = await env.SUBSCRIBERS.get('fotograaf:loginlog:' + found.id);
  const loginLog = logRaw ? JSON.parse(logRaw) : [];
  loginLog.unshift(Date.now());
  if (loginLog.length > 25) loginLog.length = 25;
  await env.SUBSCRIBERS.put('fotograaf:loginlog:' + found.id, JSON.stringify(loginLog));

  const sessieToken = randomToken();
  await env.SUBSCRIBERS.put('fotograaf:token:' + sessieToken, found.id, { expirationTtl: 30 * 24 * 3600 });

  return json({ ok: true, token: sessieToken, naam: found.naam, kleur: found.kleur, id: found.id });
}

// ── LOGINLOG (admin) ──────────────────────────────────────────────────────
async function handleLoginLog(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id verplicht' }, 400);
  const raw = await env.SUBSCRIBERS.get('fotograaf:loginlog:' + id);
  return json({ log: raw ? JSON.parse(raw) : [] });
}

// ── ADMIN LOGIN (tweestaps wachtwoord) ────────────────────────────────────
async function handleAdminLogin(request, env) {
  const { stap, wachtwoord } = await request.json().catch(() => ({}));
  if (!stap || !wachtwoord) return json({ error: 'Ongeldige aanvraag' }, 400);

  if (stap === 1) {
    if (wachtwoord !== env.ADMIN_PASSWORD_1) return json({ error: 'Onjuist wachtwoord' }, 401);
    return json({ ok: true });
  }
  if (stap === 2) {
    if (wachtwoord !== env.ADMIN_PASSWORD_2) return json({ error: 'Onjuiste pincode' }, 401);
    return json({ ok: true, workerSecret: env.WORKER_SECRET });
  }
  return json({ error: 'Ongeldige stap' }, 400);
}

// ── GITHUB PROXY (manifest + bestanden via Worker) ────────────────────────
const GH_REPO   = 'LuckyDre/zaanslicht';
const GH_BRANCH = 'main';
const GH_API    = 'https://api.github.com';

async function githubGet(path, env) {
  const r = await fetch(`${GH_API}${path}`, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'ZaansLicht-Worker/1.0' }
  });
  if (!r.ok) { const msg = await r.text().catch(() => ''); throw new Error(`GitHub ${r.status}: ${msg.slice(0,200)}`); }
  return r.json();
}

async function githubPut(path, body, env) {
  const r = await fetch(`${GH_API}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'ZaansLicht-Worker/1.0' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `GitHub ${r.status}`); }
  return r.json();
}

async function handleAdminManifestGet(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  try {
    const data = await githubGet(`/repos/${GH_REPO}/contents/manifest.json?ref=${GH_BRANCH}&t=${Date.now()}`, env);
    return json({ sha: data.sha, content: data.content });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleAdminManifestSave(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { content, message } = await request.json().catch(() => ({}));
  if (!content || !message) return json({ error: 'content en message verplicht' }, 400);
  try {
    const huidig = await githubGet(`/repos/${GH_REPO}/contents/manifest.json?ref=${GH_BRANCH}&t=${Date.now()}`, env);
    const result = await githubPut(`/repos/${GH_REPO}/contents/manifest.json`, {
      message, content, sha: huidig.sha, branch: GH_BRANCH,
    }, env);
    return json({ ok: true, sha: result.content?.sha });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleAdminGithubFileGet(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  if (!path) return json({ error: 'path ontbreekt' }, 400);
  try {
    const data = await githubGet(`/repos/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}`, env);
    return json({ sha: data.sha });
  } catch {
    return json({ sha: null });
  }
}

async function handleAdminGithubFilePut(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { path, content, message, sha } = await request.json().catch(() => ({}));
  if (!path || !content || !message) return json({ error: 'path, content en message verplicht' }, 400);
  try {
    const body = { message, content, branch: GH_BRANCH };
    if (sha) body.sha = sha;
    await githubPut(`/repos/${GH_REPO}/contents/${path}`, body, env);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── REVIEW-MODUS (admin kijkt mee als fotograaf) ───────────────────────────
async function handleReviewWachtwoord(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { wachtwoord } = await request.json().catch(() => ({}));
  if (!wachtwoord || wachtwoord.length < 8) return json({ error: 'Review-wachtwoord moet minimaal 8 tekens zijn' }, 400);
  await env.SUBSCRIBERS.put('review:wachtwoord', await hashPassword(wachtwoord));
  return json({ ok: true });
}

async function handleReviewSessie(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { id, wachtwoord } = await request.json().catch(() => ({}));
  if (!id || !wachtwoord) return json({ error: 'id en wachtwoord verplicht' }, 400);

  const opgeslagen = await env.SUBSCRIBERS.get('review:wachtwoord');
  if (!opgeslagen) return json({ error: 'Er is nog geen review-wachtwoord ingesteld' }, 400);
  if (!(await verifyPassword(wachtwoord, opgeslagen))) return json({ error: 'Onjuist review-wachtwoord' }, 401);

  const raw = await env.SUBSCRIBERS.get('fotograaf:account:' + id);
  if (!raw) return json({ error: 'Fotograaf niet gevonden' }, 404);
  const account = JSON.parse(raw);

  // Korte sessie (2 uur) — zelfde token-mechanisme als een gewone login.
  // Waarde krijgt 'review:'-prefix zodat getFotograafByToken de TTL niet verlengt.
  const token = randomToken();
  await env.SUBSCRIBERS.put('fotograaf:token:' + token, 'review:' + account.id, { expirationTtl: 2 * 3600 });
  return json({ ok: true, token, naam: account.naam, kleur: account.kleur, id: account.id });
}

// ── FOTO UPLOADEN ──────────────────────────────────────────────────────────
async function handleFotoUpload(request, env) {
  const authToken = request.headers.get('X-Fotograaf-Token');
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);

  const geblokkeerd = await env.SUBSCRIBERS.get('fotograaf:geblokkeerd:' + fotograaf.id);
  if (geblokkeerd === '1') return json({ error: 'Je account is tijdelijk geblokkeerd.' }, 403);

  const formData = await request.formData().catch(() => null);
  if (!formData) return json({ error: 'Geen formData' }, 400);

  const file      = formData.get('foto');
  const categorie = (formData.get('categorie') || 'eigen').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const map       = (formData.get('map') || 'Mijn foto\'s').substring(0, 80);
  const labelsRaw = formData.get('labels') || '[]';
  let labels = [];
  try { labels = JSON.parse(labelsRaw).slice(0, 10); } catch {}

  if (!file || !file.name) return json({ error: 'Geen bestand' }, 400);
  if (file.size > 15 * 1024 * 1024) return json({ error: 'Bestand te groot (max 15MB)' }, 400);

  // Controleer magic bytes: WebP = RIFF....WEBP (bytes 0-3 en 8-11), JPEG = FF D8 FF
  // JPEG wordt geaccepteerd omdat Safari/iOS geen WebP-encoding via Canvas ondersteunt —
  // de fotograaf.html-upload valt daar terug op JPEG i.p.v. WebP.
  const header = await file.slice(0, 12).arrayBuffer();
  const b = new Uint8Array(header);
  const isWebP = b[0]===0x52&&b[1]===0x49&&b[2]===0x46&&b[3]===0x46&&
                 b[8]===0x57&&b[9]===0x45&&b[10]===0x42&&b[11]===0x50;
  const isJPEG = b[0]===0xFF&&b[1]===0xD8&&b[2]===0xFF;
  if (!isWebP && !isJPEG) return json({ error: 'Alleen WebP- of JPEG-bestanden worden opgeslagen. Converteer eerst.' }, 400);

  const ext         = isWebP ? '.webp' : '.jpg';
  const contentType = isWebP ? 'image/webp' : 'image/jpeg';
  const basisNaam  = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const veiligNaam = basisNaam + ext;
  const r2Key = `fotografen/${fotograaf.id}/${categorie}/${encodeURIComponent(map)}/${veiligNaam}`;

  await env.FOTOS.put(r2Key, file.stream(), {
    httpMetadata: { contentType },
    customMetadata: { fotograafId: fotograaf.id, fotograafNaam: fotograaf.naam, map, categorie },
  });

  // Thumbnail opslaan als die meegezonden is (en ook echt WebP of JPEG is)
  const thumb = formData.get('thumbnail');
  if (thumb && thumb.size > 0) {
    const th = await thumb.slice(0, 12).arrayBuffer();
    const tb = new Uint8Array(th);
    const thumbIsWebP = tb[0]===0x52&&tb[1]===0x49&&tb[2]===0x46&&tb[3]===0x46&&
                        tb[8]===0x57&&tb[9]===0x45&&tb[10]===0x42&&tb[11]===0x50;
    const thumbIsJPEG = tb[0]===0xFF&&tb[1]===0xD8&&tb[2]===0xFF;
    if (thumbIsWebP || thumbIsJPEG) {
      const thumbExt = thumbIsWebP ? '.webp' : '.jpg';
      const thumbKey = 'thumbs/' + r2Key.replace(/\.[^.]+$/, '-thumb' + thumbExt);
      await env.FOTOS.put(thumbKey, thumb.stream(), {
        httpMetadata: { contentType: thumbIsWebP ? 'image/webp' : 'image/jpeg' },
      });
    }
  }

  // Bijhouden welke mappen de fotograaf heeft
  const mappenRaw = await env.SUBSCRIBERS.get('fotograaf:mappen:' + fotograaf.id);
  const mappen    = mappenRaw ? JSON.parse(mappenRaw) : [];
  const bestaand = mappen.find(m => m.map === map && m.categorie === categorie);
  if (!bestaand) {
    mappen.push({ map, categorie, ts: Date.now(), labels, opVoetbal: true, opNosports: false, opEigenPagina: true });
    await env.SUBSCRIBERS.put('fotograaf:mappen:' + fotograaf.id, JSON.stringify(mappen));
  } else if (labels.length && JSON.stringify(bestaand.labels) !== JSON.stringify(labels)) {
    // Update labels als ze zijn veranderd
    bestaand.labels = labels;
    await env.SUBSCRIBERS.put('fotograaf:mappen:' + fotograaf.id, JSON.stringify(mappen));
  }

  // Labels gekozen tijdens uploaden ook echt toepassen op déze foto (net als het
  // bestaande 🏷-systeem per foto) — anders landen ze alleen op de map-metadata
  // en komen ze nooit in de reverse index terecht die clubs.html gebruikt.
  if (labels.length) {
    await env.SUBSCRIBERS.put('foto:labels:' + r2Key, JSON.stringify(labels));
    const entry = { key: r2Key, url: '', fotograafId: fotograaf.id, naam: fotograaf.naam, kleur: fotograaf.kleur, ts: Date.now() };
    await updateReverseIndex(r2Key, [], labels, entry, env);
  }

  return json({ ok: true, key: r2Key, naam: veiligNaam });
}

// ── FOTO'S OPHALEN ─────────────────────────────────────────────────────────
async function handleFotosLijst(request, env) {
  const url       = new URL(request.url);
  const id        = url.searchParams.get('id');
  const categorie = url.searchParams.get('categorie');

  if (!id) return json({ error: 'id verplicht' }, 400);

  const prefix  = categorie
    ? `fotografen/${id}/${categorie}/`
    : `fotografen/${id}/`;

  const lijst   = await env.FOTOS.list({ prefix, limit: 500 });

  // Haal verborgen mappen, fotos en handmatige foto-volgorde op
  const [verborgenMappenRaw, verborgenFotosRaw, fotoVolgordeRaw] = await Promise.all([
    env.SUBSCRIBERS.get('fotograaf:verborgen-mappen:' + id),
    env.SUBSCRIBERS.get('fotograaf:verborgen-fotos:' + id),
    env.SUBSCRIBERS.get('fotograaf:foto-volgorde:' + id),
  ]);
  const verborgenMappen = verborgenMappenRaw ? JSON.parse(verborgenMappenRaw) : [];
  const verborgenFotos  = verborgenFotosRaw  ? JSON.parse(verborgenFotosRaw)  : [];

  const isAdmin = requireSecret(request, env);

  const fotos = lijst.objects
    .filter(o => isAdmin || !verborgenFotos.includes(o.key))
    .filter(o => isAdmin || !verborgenMappen.some(m => o.key.includes(`/${encodeURIComponent(m)}/`) || o.key.includes(`/${m}/`)))
    .map(o => ({
      key:  o.key,
      naam: o.key.split('/').pop(),
      ts:   o.uploaded?.getTime() || 0,
    }));

  return json({ fotos, verborgenMappen, verborgenFotos, fotoVolgorde: fotoVolgordeRaw ? JSON.parse(fotoVolgordeRaw) : {} });
}

// ── HANDMATIGE FOTO-VOLGORDE PER MAP (fotograaf zelf) ─────────────────────
async function handleFotoVolgorde(request, env) {
  const fotograaf = await getFotograafByToken(request.headers.get('X-Fotograaf-Token'), env);
  if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);
  const { map, volgorde } = await request.json().catch(() => ({}));
  if (!map || !Array.isArray(volgorde)) return json({ error: 'map en volgorde verplicht' }, 400);
  if (volgorde.some(k => typeof k !== 'string' || !k.startsWith(`fotografen/${fotograaf.id}/`))) {
    return json({ error: 'Ongeldige keys' }, 400);
  }
  const raw  = await env.SUBSCRIBERS.get('fotograaf:foto-volgorde:' + fotograaf.id);
  const data = raw ? JSON.parse(raw) : {};
  if (volgorde.length === 0) delete data[map];
  else data[map] = volgorde;
  await env.SUBSCRIBERS.put('fotograaf:foto-volgorde:' + fotograaf.id, JSON.stringify(data));
  return json({ ok: true });
}

// ── MANIFEST VOOR GASTFOTOGRAFEN ───────────────────────────────────────────
async function handleFotograafManifest(request, env) {
  // Geeft een manifest-achtige structuur terug van alle gastfotografen
  const accounts = [];
  let cursor;
  do {
    const r = await env.SUBSCRIBERS.list({ prefix: 'fotograaf:account:', cursor, limit: 100 });
    for (const key of r.keys) {
      const a = JSON.parse(await env.SUBSCRIBERS.get(key.name));
      const mappenRaw = await env.SUBSCRIBERS.get('fotograaf:mappen:' + a.id);
      const mappen    = mappenRaw ? JSON.parse(mappenRaw) : [];
      accounts.push({ id: a.id, naam: a.naam, kleur: a.kleur, mappen });
    }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);

  return json({ fotografen: accounts });
}

// ── LIJST FOTOGRAFEN (admin) ───────────────────────────────────────────────
async function handleFotograafLijst(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const lijst = [];
  let cursor;
  do {
    const r = await env.SUBSCRIBERS.list({ prefix: 'fotograaf:account:', cursor, limit: 100 });
    for (const key of r.keys) {
      const a = JSON.parse(await env.SUBSCRIBERS.get(key.name));
      const mappenRaw = await env.SUBSCRIBERS.get('fotograaf:mappen:' + a.id);
      lijst.push({ id: a.id, naam: a.naam, email: a.email, kleur: a.kleur, ts: a.ts, last_login: a.last_login || null, aantalMappen: mappenRaw ? JSON.parse(mappenRaw).length : 0 });
    }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return json({ fotografen: lijst });
}

// ── FOTOGRAAF VERWIJDEREN (admin) ──────────────────────────────────────────
async function handleFotograafVerwijderen(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { id } = await request.json().catch(() => ({}));
  if (!id) return json({ error: 'id verplicht' }, 400);

  // Verwijder account + mappen-index
  await env.SUBSCRIBERS.delete('fotograaf:account:' + id);
  await env.SUBSCRIBERS.delete('fotograaf:mappen:' + id);

  // Verwijder alle R2 foto's van deze fotograaf (+ bijbehorende labels/reverse index)
  const lijst = await env.FOTOS.list({ prefix: `fotografen/${id}/`, limit: 1000 });
  for (const obj of lijst.objects) {
    await env.FOTOS.delete(obj.key);
    await verwijderFotoLabels(obj.key, env);
  }

  return json({ ok: true });
}

// ── FOTO VERWIJDEREN (eigen foto) ──────────────────────────────────────────
async function handleFotoVerwijderen(request, env) {
  const authToken = request.headers.get('X-Fotograaf-Token');
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);

  const { key } = await request.json().catch(() => ({}));
  if (!key) return json({ error: 'key verplicht' }, 400);

  // Controleer dat de key bij deze fotograaf hoort
  if (!key.startsWith(`fotografen/${fotograaf.id}/`)) return json({ error: 'Geen toegang tot dit bestand' }, 403);

  await env.FOTOS.delete(key);
  await verwijderFotoLabels(key, env);
  return json({ ok: true });
}

async function handleAdminMapVerwijderen(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { id, map } = await request.json().catch(() => ({}));
  if (!id || !map) return json({ error: 'id en map verplicht' }, 400);

  // Verwijder alle R2 foto's in deze map
  const lijst = await env.FOTOS.list({ prefix: `fotografen/${id}/`, limit: 1000 });
  const enc   = encodeURIComponent(map);
  const targets = lijst.objects.filter(o => o.key.includes(`/${map}/`) || o.key.includes(`/${enc}/`));
  await Promise.all(targets.map(o => env.FOTOS.delete(o.key)));
  await Promise.all(targets.map(o => verwijderFotoLabels(o.key, env)));

  // Verwijder map uit KV-index
  const raw = await env.SUBSCRIBERS.get('fotograaf:mappen:' + id);
  if (raw) {
    const mappen = JSON.parse(raw).filter(m => m.map !== map);
    await env.SUBSCRIBERS.put('fotograaf:mappen:' + id, JSON.stringify(mappen));
  }
  return json({ ok: true, verwijderd: targets.length });
}

async function handleAdminFotoVerwijderen(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { key } = await request.json().catch(() => ({}));
  if (!key || !key.startsWith('fotografen/')) return json({ error: 'Ongeldige key' }, 400);
  await env.FOTOS.delete(key);
  await verwijderFotoLabels(key, env);
  return json({ ok: true });
}

// ── ACCOUNT BLOKKEREN / DEBLOKKEREN (admin) ───────────────────────────────
async function handleBlokkeer(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { id, geblokkeerd } = await request.json().catch(() => ({}));
  if (!id) return json({ error: 'id verplicht' }, 400);
  if (geblokkeerd) {
    await env.SUBSCRIBERS.put('fotograaf:geblokkeerd:' + id, '1');
  } else {
    await env.SUBSCRIBERS.delete('fotograaf:geblokkeerd:' + id);
  }
  return json({ ok: true, geblokkeerd });
}

// ── SERIE VERBERGEN / TONEN (admin) ───────────────────────────────────────
async function handleVerborgeMap(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { id, map, verborgen } = await request.json().catch(() => ({}));
  if (!id || !map) return json({ error: 'id en map verplicht' }, 400);
  const raw = await env.SUBSCRIBERS.get('fotograaf:verborgen-mappen:' + id);
  let lijst = raw ? JSON.parse(raw) : [];
  if (verborgen) {
    if (!lijst.includes(map)) lijst.push(map);
  } else {
    lijst = lijst.filter(m => m !== map);
  }
  await env.SUBSCRIBERS.put('fotograaf:verborgen-mappen:' + id, JSON.stringify(lijst));
  return json({ ok: true });
}

// ── MAP VERBERGEN / TONEN (fotograaf zelf) ───────────────────────────────
async function handleEigenVerborgenLijst(request, env) {
  const fg = await getFotograafByToken(request.headers.get('X-Fotograaf-Token'), env);
  if (!fg) return json({ error: 'Geen toegang' }, 401);
  const raw = await env.SUBSCRIBERS.get('fotograaf:verborgen-mappen:' + fg.id);
  return json({ verborgenMappen: raw ? JSON.parse(raw) : [] });
}

async function handleEigenVerborgeMap(request, env) {
  const fg = await getFotograafByToken(request.headers.get('X-Fotograaf-Token'), env);
  if (!fg) return json({ error: 'Geen toegang' }, 401);
  const { map, verborgen } = await request.json().catch(() => ({}));
  if (!map) return json({ error: 'map verplicht' }, 400);
  const raw = await env.SUBSCRIBERS.get('fotograaf:verborgen-mappen:' + fg.id);
  let lijst = raw ? JSON.parse(raw) : [];
  if (verborgen) {
    if (!lijst.includes(map)) lijst.push(map);
  } else {
    lijst = lijst.filter(m => m !== map);
  }
  await env.SUBSCRIBERS.put('fotograaf:verborgen-mappen:' + fg.id, JSON.stringify(lijst));
  return json({ ok: true });
}

// ── FOTO VERBERGEN / TONEN (admin) ────────────────────────────────────────
async function handleVerborgeFoto(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { id, key, verborgen } = await request.json().catch(() => ({}));
  if (!id || !key) return json({ error: 'id en key verplicht' }, 400);
  const raw = await env.SUBSCRIBERS.get('fotograaf:verborgen-fotos:' + id);
  let lijst = raw ? JSON.parse(raw) : [];
  if (verborgen) {
    if (!lijst.includes(key)) lijst.push(key);
  } else {
    lijst = lijst.filter(k => k !== key);
  }
  await env.SUBSCRIBERS.put('fotograaf:verborgen-fotos:' + id, JSON.stringify(lijst));
  return json({ ok: true });
}

// ── VERBORGEN STATUS OPHALEN (admin) ──────────────────────────────────────
async function handleVerborgeLijst(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const url = new URL(request.url);
  const id  = url.searchParams.get('id');
  if (!id) return json({ error: 'id verplicht' }, 400);
  const [mappen, fotos, geblokkeerd] = await Promise.all([
    env.SUBSCRIBERS.get('fotograaf:verborgen-mappen:' + id),
    env.SUBSCRIBERS.get('fotograaf:verborgen-fotos:' + id),
    env.SUBSCRIBERS.get('fotograaf:geblokkeerd:' + id),
  ]);
  return json({
    geblokkeerd: geblokkeerd === '1',
    verborgenMappen: mappen ? JSON.parse(mappen) : [],
    verborgenFotos:  fotos  ? JSON.parse(fotos)  : [],
  });
}

// ── EIGEN ACCOUNT VERWIJDEREN ─────────────────────────────────────────────
async function handleAccountVerwijderen(request, env) {
  const authToken = request.headers.get('X-Fotograaf-Token');
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);

  // Verwijder alle R2 foto's
  const lijst = await env.FOTOS.list({ prefix: `fotografen/${fotograaf.id}/`, limit: 1000 });
  for (const obj of lijst.objects) { await env.FOTOS.delete(obj.key); }

  // Verwijder KV data
  await env.SUBSCRIBERS.delete('fotograaf:account:' + fotograaf.id);
  await env.SUBSCRIBERS.delete('fotograaf:mappen:' + fotograaf.id);
  await env.SUBSCRIBERS.delete('fotograaf:token:' + authToken);

  return json({ ok: true });
}

// ── MAPPEN VOLGORDE OPSLAAN ───────────────────────────────────────────────
// ── GECOMBINEERDE GALLERY VOLGORDE ────────────────────────────────────────
async function handlePositieBeheer(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { id, mag } = await request.json().catch(() => ({}));
  if (!id) return json({ error: 'id verplicht' }, 400);
  if (mag) {
    await env.SUBSCRIBERS.put('fotograaf:positiebeheer:' + id, '1');
  } else {
    await env.SUBSCRIBERS.delete('fotograaf:positiebeheer:' + id);
  }
  return json({ ok: true, mag: !!mag });
}

async function handleFotograafGalleryVolgorde(request, env) {
  // Fotograaf mag alleen zijn eigen mappen verplaatsen in de gecombineerde volgorde
  const authToken = request.headers.get('X-Fotograaf-Token');
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);

  // Check of deze fotograaf positiebeheer mag
  const mag = await env.SUBSCRIBERS.get('fotograaf:positiebeheer:' + fotograaf.id);
  if (!mag) return json({ error: 'Geen toestemming om positie te bepalen' }, 403);

  const { categorie, volgorde } = await request.json().catch(() => ({}));
  if (!categorie || !volgorde) return json({ error: 'categorie en volgorde verplicht' }, 400);

  // Laad huidige volgorde
  const huidigRaw = await env.SUBSCRIBERS.get('gallery:volgorde:' + categorie);
  const huidig = huidigRaw ? JSON.parse(huidigRaw) : null;

  // Als er nog geen volgorde bestaat, mag de fotograaf alles instellen
  if (huidig !== null) {
    // Verifieer dat andermans items niet zijn gewijzigd of verwijderd
    const andermansInNieuw  = volgorde.filter(e => !(e.type === 'gast' && e.fgId === fotograaf.id));
    const andermansInHuidig = huidig.filter(e => !(e.type === 'gast' && e.fgId === fotograaf.id));
    if (JSON.stringify(andermansInNieuw.map(e => e.type + e.map + (e.fgId||'')))
      !== JSON.stringify(andermansInHuidig.map(e => e.type + e.map + (e.fgId||'')))) {
      return json({ error: 'Andere mappen mogen niet worden gewijzigd' }, 403);
    }
  }

  await env.SUBSCRIBERS.put('gallery:volgorde:' + categorie, JSON.stringify(volgorde));
  return json({ ok: true });
}

async function handleGalleryVolgorde(request, env) {
  const secret = request.headers.get('X-Worker-Secret');
  if (!secret || secret !== env.WORKER_SECRET) return json({ error: 'Niet toegestaan' }, 401);

  const body = await request.json().catch(() => ({}));
  if (!body.voetbal && !body.nosports) return json({ error: 'voetbal of nosports verplicht' }, 400);

  if (body.voetbal)  await env.SUBSCRIBERS.put('gallery:volgorde:voetbal',  JSON.stringify(body.voetbal));
  if (body.nosports) await env.SUBSCRIBERS.put('gallery:volgorde:nosports', JSON.stringify(body.nosports));
  return json({ ok: true });
}

async function handleGetGalleryVolgorde(request, env) {
  const voetbal  = await env.SUBSCRIBERS.get('gallery:volgorde:voetbal');
  const nosports = await env.SUBSCRIBERS.get('gallery:volgorde:nosports');
  return json({
    voetbal:  voetbal  ? JSON.parse(voetbal)  : null,
    nosports: nosports ? JSON.parse(nosports) : null,
  });
}

async function handleMappenVolgorde(request, env) {
  const adminSecret = request.headers.get('X-Worker-Secret');
  const isAdmin = adminSecret && adminSecret === env.WORKER_SECRET;

  let fotograafId;
  let mappen;

  if (isAdmin) {
    // Admin: stuurt { id, volgorde: [...mapNamen] }
    const body = await request.json().catch(() => ({}));
    fotograafId = body.id;
    const volgorde = body.volgorde;
    if (!fotograafId || !Array.isArray(volgorde)) return json({ error: 'id en volgorde verplicht' }, 400);
    // Haal huidige mappen op en hersorteer op basis van volgorde
    const huidigeRaw = await env.SUBSCRIBERS.get('fotograaf:mappen:' + fotograafId);
    const huidigeMappen = huidigeRaw ? JSON.parse(huidigeRaw) : [];
    mappen = volgorde.map(mapNaam => huidigeMappen.find(m => m.map === mapNaam)).filter(Boolean);
    // Voeg mappen toe die niet in volgorde staan (aan het einde)
    huidigeMappen.forEach(m => { if (!mappen.find(x => x.map === m.map)) mappen.push(m); });
  } else {
    // Fotograaf: stuurt { mappen: [...] } met X-Fotograaf-Token
    const authToken = request.headers.get('X-Fotograaf-Token');
    const fotograaf = await getFotograafByToken(authToken, env);
    if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);
    fotograafId = fotograaf.id;
    const body = await request.json().catch(() => ({}));
    mappen = body.mappen;
    if (!Array.isArray(mappen)) return json({ error: 'mappen verplicht' }, 400);
    // Alleen bestaande mappen accepteren: herordenen en verwijderen mag, maar
    // een verouderd tabblad mag een (elders) verwijderde map niet her-toevoegen —
    // die zou dan zonder foto's als lege spookmap op de site terugkomen.
    // Nieuwe mappen ontstaan uitsluitend via handleFotoUpload.
    const huidigeRaw = await env.SUBSCRIBERS.get('fotograaf:mappen:' + fotograafId);
    const huidigeNamen = new Set((huidigeRaw ? JSON.parse(huidigeRaw) : []).map(m => m.map));
    mappen = mappen.filter(m => huidigeNamen.has(m.map));
  }

  await env.SUBSCRIBERS.put('fotograaf:mappen:' + fotograafId, JSON.stringify(mappen));
  return json({ ok: true });
}

// ── DATUM PER MAP ──────────────────────────────────────────────────────────
async function handleMapDatum(request, env) {
  // Admin (secret + id in body) of fotograaf (token, eigen mappen)
  const isAdmin = requireSecret(request, env);
  const body = await request.json().catch(() => ({}));
  const { map, datum } = body;
  if (!map) return json({ error: 'map verplicht' }, 400);
  if (datum && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return json({ error: 'datum moet JJJJ-MM-DD zijn' }, 400);

  let fotograafId;
  if (isAdmin) {
    fotograafId = body.id;
    if (!fotograafId) return json({ error: 'id verplicht' }, 400);
  } else {
    const fotograaf = await getFotograafByToken(request.headers.get('X-Fotograaf-Token'), env);
    if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);
    fotograafId = fotograaf.id;
  }

  const raw = await env.SUBSCRIBERS.get('fotograaf:mappen:' + fotograafId);
  const mappen = raw ? JSON.parse(raw) : [];
  const entry = mappen.find(m => m.map === map);
  if (!entry) return json({ error: 'map niet gevonden' }, 404);

  if (datum) entry.datum = datum;
  else delete entry.datum;

  await env.SUBSCRIBERS.put('fotograaf:mappen:' + fotograafId, JSON.stringify(mappen));
  return json({ ok: true, datum: datum || null });
}

// ── VERHAAL/BESCHRIJVING OPSLAAN ──────────────────────────────────────────
async function handleMapBeschrijving(request, env) {
  const isAdmin = requireSecret(request, env);
  const body = await request.json().catch(() => ({}));
  const { map, beschrijving } = body;
  if (!map) return json({ error: 'map verplicht' }, 400);

  let fotograafId;
  if (isAdmin) {
    fotograafId = body.id;
    if (!fotograafId) return json({ error: 'id verplicht' }, 400);
  } else {
    const fotograaf = await getFotograafByToken(request.headers.get('X-Fotograaf-Token'), env);
    if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);
    fotograafId = fotograaf.id;
  }

  const raw = await env.SUBSCRIBERS.get('fotograaf:mappen:' + fotograafId);
  const mappen = raw ? JSON.parse(raw) : [];
  const entry = mappen.find(m => m.map === map);
  if (!entry) return json({ error: 'map niet gevonden' }, 404);

  if (beschrijving) entry.beschrijving = beschrijving;
  else delete entry.beschrijving;

  await env.SUBSCRIBERS.put('fotograaf:mappen:' + fotograafId, JSON.stringify(mappen));
  return json({ ok: true });
}

// ── NAAM/TITEL OPSLAAN ────────────────────────────────────────────────────
async function handleMapNaam(request, env) {
  const isAdmin = requireSecret(request, env);
  const body = await request.json().catch(() => ({}));
  const { map, naam } = body;
  if (!map) return json({ error: 'map verplicht' }, 400);

  let fotograafId;
  if (isAdmin) {
    fotograafId = body.id;
    if (!fotograafId) return json({ error: 'id verplicht' }, 400);
  } else {
    const fotograaf = await getFotograafByToken(request.headers.get('X-Fotograaf-Token'), env);
    if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);
    fotograafId = fotograaf.id;
  }

  const raw = await env.SUBSCRIBERS.get('fotograaf:mappen:' + fotograafId);
  const mappen = raw ? JSON.parse(raw) : [];
  const entry = mappen.find(m => m.map === map);
  if (!entry) return json({ error: 'map niet gevonden' }, 404);

  if (naam) entry.naam = naam;
  else delete entry.naam;

  await env.SUBSCRIBERS.put('fotograaf:mappen:' + fotograafId, JSON.stringify(mappen));
  return json({ ok: true });
}

// ── PAGINA TOGGLES ─────────────────────────────────────────────────────────
async function handleMapPaginas(request, env) {
  const isAdmin = requireSecret(request, env);
  const body = await request.json().catch(() => ({}));
  const { map, opVoetbal, opNosports, opEigenPagina } = body;
  if (!map) return json({ error: 'map verplicht' }, 400);

  let fotograafId;
  if (isAdmin) {
    fotograafId = body.id;
    if (!fotograafId) return json({ error: 'id verplicht' }, 400);
  } else {
    const fotograaf = await getFotograafByToken(request.headers.get('X-Fotograaf-Token'), env);
    if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);
    fotograafId = fotograaf.id;
  }

  const raw = await env.SUBSCRIBERS.get('fotograaf:mappen:' + fotograafId);
  const mappen = raw ? JSON.parse(raw) : [];
  const entry = mappen.find(m => m.map === map);
  if (!entry) return json({ error: 'map niet gevonden' }, 404);

  if (opVoetbal    !== undefined) entry.opVoetbal    = Boolean(opVoetbal);
  if (opNosports   !== undefined) entry.opNosports   = Boolean(opNosports);
  if (opEigenPagina !== undefined) entry.opEigenPagina = Boolean(opEigenPagina);

  await env.SUBSCRIBERS.put('fotograaf:mappen:' + fotograafId, JSON.stringify(mappen));
  return json({ ok: true });
}

// ── KLEUR BIJWERKEN ────────────────────────────────────────────────────────
async function handleFotograafKleur(request, env) {
  const authToken = request.headers.get('X-Fotograaf-Token');
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);

  const { kleur } = await request.json().catch(() => ({}));
  if (!kleur || !/^#[0-9a-fA-F]{6}$/.test(kleur)) return json({ error: 'Ongeldige kleur' }, 400);

  fotograaf.kleur = kleur;
  await env.SUBSCRIBERS.put('fotograaf:account:' + fotograaf.id, JSON.stringify(fotograaf));
  return json({ ok: true, kleur });
}

// ── BIO OPSLAAN ───────────────────────────────────────────────────────────
async function handleBioOpslaan(request, env) {
  const authToken = request.headers.get('X-Fotograaf-Token');
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);

  const { bio } = await request.json().catch(() => ({}));
  if (typeof bio !== 'string') return json({ error: 'bio verplicht' }, 400);
  if (bio.length > 1000) return json({ error: 'Bio mag maximaal 1000 tekens zijn' }, 400);

  await env.SUBSCRIBERS.put('fotograaf:bio:' + fotograaf.id, JSON.stringify({ bio: bio.trim(), ts: Date.now() }));
  return json({ ok: true });
}

// ── PROFIELFOTO UPLOADEN ──────────────────────────────────────────────────
async function handleProfielfotoUpload(request, env) {
  const authToken = request.headers.get('X-Fotograaf-Token');
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);

  const formData = await request.formData().catch(() => null);
  if (!formData) return json({ error: 'Geen formData' }, 400);

  const file = formData.get('foto');
  if (!file || !file.name) return json({ error: 'Geen bestand' }, 400);
  const naam = file.name.toLowerCase();
  if (!naam.endsWith('.webp') && !naam.endsWith('.jpg') && !naam.endsWith('.jpeg')) {
    return json({ error: 'Alleen WebP of JPG toegestaan' }, 400);
  }
  if (file.size > 5 * 1024 * 1024) return json({ error: 'Max 5MB voor profielfoto' }, 400);

  const contentType = naam.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  const ext = naam.endsWith('.webp') ? 'webp' : 'jpg';
  const r2Key = `fotografen/${fotograaf.id}/profiel.${ext}`;

  await env.FOTOS.put(r2Key, file.stream(), {
    httpMetadata: { contentType },
    customMetadata: { fotograafId: fotograaf.id },
  });

  await env.SUBSCRIBERS.put('fotograaf:profielfoto:' + fotograaf.id, r2Key);
  return json({ ok: true, key: r2Key });
}

// ── REACTIE OPSLAAN ──────────────────────────────────────────────────────────
async function handleComment(request, env) {
  try {
    const body = await request.json().catch(e => null);
    if (!body) return json({ error: 'Geen geldige JSON' }, 400);

    const { naam, tekst, photoKey, src } = body;
    if (!tekst) return json({ error: 'Bericht vereist' }, 400);
    if (!photoKey) return json({ error: 'Foto niet geselecteerd' }, 400);

    const timestamp = Date.now();
    const commentId = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Opslaan in KV
    const commentKey = `comment:${photoKey}:${commentId}`;
    await env.SUBSCRIBERS.put(
      commentKey,
      JSON.stringify({ naam: naam || 'Anoniem', tekst, ts: timestamp, src, photoKey }),
      { expirationTtl: 7776000 } // 90 dagen
    );

    // Voeg toe aan recent list
    await env.SUBSCRIBERS.put(
      `recent:${commentId}`,
      JSON.stringify({ naam: naam || 'Anoniem', tekst, ts: timestamp, photoKey, src }),
      { expirationTtl: 7776000 }
    );

    return json({ ok: true, id: commentId });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── REACTIES OPHALEN ─────────────────────────────────────────────────────────
// ── LABELS ────────────────────────────────────────────────────────────────────
const STANDAARD_LABELS = [
  'Alcmaria Victrix','VV Assendelft','De Blokkers','SV DTS','Fortuna Wormerveer',
  'AFC IJburg','KFC','SV Koedijk','OFC Oostzaan','VV Opperdoes','SC Purmerland',
  'VV Saenden','Sporting Krommenie','TOS Actief','United Davo','ASC De Volewijckers',
  'WSV 1930','ZVV Zaandijk','ZCFC'
];

async function handleGetAndreasProfile(request, env) {
  const raw  = await env.SUBSCRIBERS.get('profiel:andreas');
  const data = raw ? JSON.parse(raw) : {};
  return json({ kleur: data.kleur || '#FF6B00' });
}

async function handleSetAndreasProfile(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { kleur } = await request.json().catch(() => ({}));
  if (!kleur || !/^#[0-9a-fA-F]{6}$/.test(kleur)) return json({ error: 'Ongeldige kleur' }, 400);
  const raw  = await env.SUBSCRIBERS.get('profiel:andreas');
  const data = raw ? JSON.parse(raw) : {};
  data.kleur = kleur;
  await env.SUBSCRIBERS.put('profiel:andreas', JSON.stringify(data));
  return json({ ok: true });
}

async function handleGetLabels(request, env) {
  const [raw, verwijderdRaw] = await Promise.all([
    env.SUBSCRIBERS.get('labels:lijst'),
    env.SUBSCRIBERS.get('labels:verwijderd'),
  ]);
  const opgeslagen = raw ? JSON.parse(raw) : [];
  const verwijderd = verwijderdRaw ? JSON.parse(verwijderdRaw) : [];
  const alle = [...new Set([...STANDAARD_LABELS, ...opgeslagen])]
    .filter(l => !verwijderd.includes(l))
    .sort((a, b) => a.localeCompare(b, 'nl'));
  return json({ labels: alle });
}

async function handleAddLabel(request, env) {
  const isAdmin   = requireSecret(request, env);
  const authToken = request.headers.get('X-Fotograaf-Token');
  const fotograaf = isAdmin ? true : await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);

  const { label } = await request.json().catch(() => ({}));
  if (!label || label.trim().length < 2) return json({ error: 'Label te kort' }, 400);
  const schoon = label.trim().substring(0, 50);

  const raw = await env.SUBSCRIBERS.get('labels:lijst');
  const lijst = raw ? JSON.parse(raw) : [];
  if (!lijst.includes(schoon) && !STANDAARD_LABELS.includes(schoon)) {
    lijst.push(schoon);
    await env.SUBSCRIBERS.put('labels:lijst', JSON.stringify(lijst));
  }
  return json({ ok: true, label: schoon });
}

async function updateReverseIndex(key, oudeLabels, schoneLabels, entry, env) {
  for (const label of oudeLabels) {
    if (!schoneLabels.includes(label)) {
      const idxRaw = await env.SUBSCRIBERS.get('label:fotos:' + label);
      const idx = idxRaw ? JSON.parse(idxRaw) : [];
      await env.SUBSCRIBERS.put('label:fotos:' + label, JSON.stringify(idx.filter(f => f.key !== key)));
    }
  }
  for (const label of schoneLabels) {
    if (!oudeLabels.includes(label)) {
      const idxRaw = await env.SUBSCRIBERS.get('label:fotos:' + label);
      const idx = idxRaw ? JSON.parse(idxRaw) : [];
      if (!idx.find(f => f.key === key)) {
        idx.push(entry);
        await env.SUBSCRIBERS.put('label:fotos:' + label, JSON.stringify(idx));
      }
    }
  }
}

// Ruimt foto:labels + reverse index (label:fotos:{label}) op voor een verwijderde
// foto. Aanroepen bij ELKE foto-verwijdering, anders blijven er wees-entries
// achter die naar niet meer bestaande bestanden wijzen (zie PROJECT.md v0.23).
async function verwijderFotoLabels(key, env) {
  const raw = await env.SUBSCRIBERS.get('foto:labels:' + key);
  if (!raw) return;
  const labels = JSON.parse(raw);
  await updateReverseIndex(key, labels, [], null, env);
  await env.SUBSCRIBERS.delete('foto:labels:' + key);
}

async function handleGetFotoLabels(request, env) {
  const isAdmin = requireSecret(request, env);
  const key = new URL(request.url).searchParams.get('key');
  if (!key) return json({ error: 'key verplicht' }, 400);

  if (!isAdmin) {
    const authToken = request.headers.get('X-Fotograaf-Token');
    const fotograaf = await getFotograafByToken(authToken, env);
    if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);
    if (!key.startsWith('fotografen/' + fotograaf.id + '/')) return json({ error: 'Geen toegang' }, 403);
  }

  const raw = await env.SUBSCRIBERS.get('foto:labels:' + key);
  return json({ labels: raw ? JSON.parse(raw) : [] });
}

async function handleSetFotoLabels(request, env) {
  const isAdmin = requireSecret(request, env);
  const { key, labels, url, naam, kleur, mapNaam, type: entryType, cat } = await request.json().catch(() => ({}));
  if (!key) return json({ error: 'key verplicht' }, 400);

  let entry;
  if (isAdmin) {
    entry = { key, url: url || '', fotograafId: 'andreas', naam: naam || 'Andreas Luckfiel', kleur: kleur || '#FF6B00', ts: Date.now() };
    if (mapNaam) { entry.mapNaam = mapNaam; entry.type = entryType || 'map'; entry.cat = cat || ''; }
  } else {
    const authToken = request.headers.get('X-Fotograaf-Token');
    const fotograaf = await getFotograafByToken(authToken, env);
    if (!fotograaf) return json({ error: 'Niet ingelogd' }, 401);
    if (!key.startsWith('fotografen/' + fotograaf.id + '/')) return json({ error: 'Geen toegang' }, 403);
    entry = { key, url: url || '', fotograafId: fotograaf.id, naam: fotograaf.naam, kleur: fotograaf.kleur, ts: Date.now() };
  }

  const schoneLabels = Array.isArray(labels) ? labels.slice(0, 10) : [];
  const oudRaw = await env.SUBSCRIBERS.get('foto:labels:' + key);
  const oudeLabels = oudRaw ? JSON.parse(oudRaw) : [];

  await updateReverseIndex(key, oudeLabels, schoneLabels, entry, env);

  if (schoneLabels.length === 0) {
    await env.SUBSCRIBERS.delete('foto:labels:' + key);
  } else {
    await env.SUBSCRIBERS.put('foto:labels:' + key, JSON.stringify(schoneLabels));
  }
  return json({ ok: true, labels: schoneLabels });
}

async function handleFotosBijLabel(request, env) {
  const label = new URL(request.url).searchParams.get('label');
  if (!label) return json({ error: 'label verplicht' }, 400);
  const raw = await env.SUBSCRIBERS.get('label:fotos:' + label);
  return json({ fotos: raw ? JSON.parse(raw) : [] });
}

async function handleDeleteComment(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const { id, photoKey } = await request.json().catch(() => ({}));
  if (!id || !photoKey) return json({ error: 'id en photoKey verplicht' }, 400);
  await Promise.all([
    env.SUBSCRIBERS.delete(`comment:${photoKey}:${id}`),
    env.SUBSCRIBERS.delete(`recent:${id}`),
  ]);
  return json({ ok: true });
}

async function handleAlleComments(request, env) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
  const comments = [];
  let cursor;
  do {
    const r = await env.SUBSCRIBERS.list({ prefix: 'comment:', cursor, limit: 100 });
    for (const key of r.keys) {
      const c = JSON.parse(await env.SUBSCRIBERS.get(key.name));
      // Formaat: comment:{photoKey}:{id} — id is het laatste deel na de laatste :
      const lastColon = key.name.lastIndexOf(':');
      const id = key.name.substring(lastColon + 1);
      comments.push({ ...c, id });
    }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  comments.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return json({ comments });
}

async function handleComments(request, env) {
  try {
    const url = new URL(request.url);
    const photoKey = url.searchParams.get('key');
    if (!photoKey) return json({ error: 'Photo key vereist' }, 400);

    const comments = [];
    let cursor;
    do {
      const r = await env.SUBSCRIBERS.list({ prefix: `comment:${photoKey}:`, cursor, limit: 100 });
      for (const key of r.keys) {
        const c = JSON.parse(await env.SUBSCRIBERS.get(key.name));
        comments.push(c);
      }
      cursor = r.list_complete ? undefined : r.cursor;
    } while (cursor);

    // Sorteer op timestamp (nieuwste eerst)
    comments.sort((a, b) => b.ts - a.ts);
    return json({ comments });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── PROFIELEN OPHALEN (publiek) ───────────────────────────────────────────
async function handleProfielen(request, env) {
  const profielen = [];
  let cursor;
  do {
    const r = await env.SUBSCRIBERS.list({ prefix: 'fotograaf:account:', cursor, limit: 100 });
    for (const key of r.keys) {
      const a = JSON.parse(await env.SUBSCRIBERS.get(key.name));
      const bioRaw     = await env.SUBSCRIBERS.get('fotograaf:bio:' + a.id);
      const fotoKey    = await env.SUBSCRIBERS.get('fotograaf:profielfoto:' + a.id);
      const bio        = bioRaw ? JSON.parse(bioRaw).bio : '';
      const fotoUrl    = fotoKey ? `/foto/${fotoKey}` : null;
      if (bio || fotoUrl) {
        profielen.push({ id: a.id, naam: a.naam, kleur: a.kleur, bio, fotoUrl });
      }
    }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return json({ profielen });
}

// ── ADMIN: VIEW DASHBOARD VAN FOTOGRAAF ───────────────────────────────────────
async function handleViewDashboard(request, env, id) {
  if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);

  // Haal account op
  const account = await env.SUBSCRIBERS.get('fotograaf:account:' + id);
  if (!account) return json({ error: 'Fotograaf niet gevonden' }, 404);

  const a = JSON.parse(account);
  const mappenRaw = await env.SUBSCRIBERS.get('fotograaf:mappen:' + id);
  const mappen = mappenRaw ? JSON.parse(mappenRaw) : [];

  const bioRaw = await env.SUBSCRIBERS.get('fotograaf:bio:' + id);
  const bio = bioRaw ? JSON.parse(bioRaw).bio : '';

  const fotoKey = await env.SUBSCRIBERS.get('fotograaf:profielfoto:' + id);
  const fotoUrl = fotoKey ? `/foto/${fotoKey}` : null;

  // Laad galerij-data
  const voetbalRaw = await env.SUBSCRIBERS.get('voetbal');
  const voetbal = voetbalRaw ? JSON.parse(voetbalRaw) : [];

  const nosportsRaw = await env.SUBSCRIBERS.get('nosports');
  const nosports = nosportsRaw ? JSON.parse(nosportsRaw) : [];

  // Filter galerij naar foto's van deze fotograaf
  const filterByFotograaf = (items) => items.filter(item => item.fotos?.some(f => f.fotograaf === id));

  return json({
    account: {
      id: a.id,
      naam: a.naam,
      email: a.email,
      kleur: a.kleur,
      ts: a.ts,
      last_login: a.last_login,
    },
    mappen,
    bio,
    fotoUrl,
    galerij: {
      voetbal: filterByFotograaf(voetbal),
      nosports: filterByFotograaf(nosports),
    },
  });
}

// ── FOTO SERVEREN VIA WORKER (publiek toegankelijk) ───────────────────────
async function handleFotoServe(request, env) {
  const url = new URL(request.url);
  const key = url.pathname.replace('/foto/', '');
  if (!key.startsWith('fotografen/')) return new Response('Niet gevonden', { status: 404 });

  // Thumbnail ophalen als ?thumb=1 meegegeven; valt terug op origineel
  // Thumb-extensie volgt de extensie van het origineel (.webp of .jpg — zie handleFotoUpload)
  let object = null;
  if (url.searchParams.get('thumb') === '1') {
    const keyExt   = key.match(/\.[^.]+$/)?.[0] || '.webp';
    const thumbKey = 'thumbs/' + key.replace(/\.[^.]+$/, '-thumb' + keyExt);
    object = await env.FOTOS.get(thumbKey);
  }
  if (!object) object = await env.FOTOS.get(key);
  if (!object) return new Response('Niet gevonden', { status: 404 });

  // Bepaal Content-Type op basis van bestandsextensie
  const ext = key.split('.').pop().toLowerCase();
  const contentTypes = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'webp': 'image/webp', 'png': 'image/png',
    'gif': 'image/gif', 'heic': 'image/heic',
  };
  const contentType = object.httpMetadata?.contentType
    || contentTypes[ext]
    || 'image/jpeg';

  const headers = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000',
    'Access-Control-Allow-Origin': '*',
  };

  // Bij ?download=1: forceer download via Content-Disposition
  if (url.searchParams.get('download') === '1') {
    const bestandsnaam = decodeURIComponent(key.split('/').pop());
    headers['Content-Disposition'] = `attachment; filename="${bestandsnaam}"`;
    headers['Cache-Control'] = 'no-cache';
  }

  return new Response(object.body, { headers });
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
    if (url.pathname === '/subscribers'        && request.method === 'GET')    return handleSubscribers(request, env);
    if (url.pathname === '/delete-subscriber'  && request.method === 'POST')   return handleDeleteSubscriber(request, env);
    if (url.pathname === '/ban'                && request.method === 'POST')   return handleBan(request, env);
    if (url.pathname === '/pause'              && request.method === 'POST')   return handlePause(request, env);
    if (url.pathname === '/pause'              && request.method === 'GET')    return handleGetPause(request, env);
    if (url.pathname === '/send'        && request.method === 'POST') return handleSend(request, env);

    // ── FOTOGRAFEN SYSTEEM ──
    if (url.pathname === '/fotograaf/uitnodigen'      && request.method === 'POST') return handleFotograafUitnodiging(request, env);
    if (url.pathname === '/fotograaf/uitnodigingen'   && request.method === 'GET')  return handleUitnodigingenLijst(request, env);
    if (url.pathname === '/fotograaf/intrekken'       && request.method === 'POST') return handleUitnodigingIntrekken(request, env);
    if (url.pathname === '/fotograaf/register'    && request.method === 'POST') return handleFotograafRegister(request, env);
    if (url.pathname === '/fotograaf/login'       && request.method === 'POST') return handleFotograafLogin(request, env);
    if (url.pathname === '/fotograaf/upload'      && request.method === 'POST') return handleFotoUpload(request, env);
    if (url.pathname === '/fotograaf/fotos'       && request.method === 'GET')  return handleFotosLijst(request, env);
    if (url.pathname === '/fotograaf/manifest'    && request.method === 'GET')  return handleFotograafManifest(request, env);
    if (url.pathname === '/fotograaf/lijst'       && request.method === 'GET')  return handleFotograafLijst(request, env);
    if (url.pathname === '/fotograaf/loginlog'    && request.method === 'GET')  return handleLoginLog(request, env);
    if (url.pathname === '/admin/map-verwijderen'  && request.method === 'POST') return handleAdminMapVerwijderen(request, env);
    if (url.pathname === '/admin/foto-verwijderen' && request.method === 'POST') return handleAdminFotoVerwijderen(request, env);
    if (url.pathname === '/fotograaf/verwijderen' && request.method === 'POST') return handleFotograafVerwijderen(request, env);
    if (url.pathname === '/fotograaf/foto-delete' && request.method === 'POST') return handleFotoVerwijderen(request, env);
    if (url.pathname === '/fotograaf/kleur'          && request.method === 'POST') return handleFotograafKleur(request, env);
    if (url.pathname === '/fotograaf/delete-account'  && request.method === 'POST') return handleAccountVerwijderen(request, env);
    if (url.pathname === '/fotograaf/blokkeer'        && request.method === 'POST') return handleBlokkeer(request, env);
    if (url.pathname === '/fotograaf/verberg-map'       && request.method === 'POST') return handleVerborgeMap(request, env);
    if (url.pathname === '/fotograaf/verberg-foto'      && request.method === 'POST') return handleVerborgeFoto(request, env);
    if (url.pathname === '/fotograaf/verborgen-eigen'   && request.method === 'GET')  return handleEigenVerborgenLijst(request, env);
    if (url.pathname === '/fotograaf/eigen-verberg-map' && request.method === 'POST') return handleEigenVerborgeMap(request, env);
    if (url.pathname === '/comment'  && request.method === 'POST') return handleComment(request, env);
    if (url.pathname === '/comments'     && request.method === 'GET')  return handleComments(request, env);
    if (url.pathname === '/profiel/andreas' && request.method === 'GET')  return handleGetAndreasProfile(request, env);
    if (url.pathname === '/profiel/andreas' && request.method === 'POST') return handleSetAndreasProfile(request, env);
    if (url.pathname === '/foto-labels'   && request.method === 'GET')    return handleGetFotoLabels(request, env);
    if (url.pathname === '/foto-labels'   && request.method === 'POST')   return handleSetFotoLabels(request, env);
    if (url.pathname === '/fotos-bij-label' && request.method === 'GET')  return handleFotosBijLabel(request, env);
    if (url.pathname === '/labels'       && request.method === 'GET')    return handleGetLabels(request, env);
    if (url.pathname === '/labels'       && request.method === 'POST')   return handleAddLabel(request, env);
    if (url.pathname === '/labels'       && request.method === 'DELETE') {
      if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
      const { label } = await request.json().catch(() => ({}));
      if (!label) return json({ error: 'label verplicht' }, 400);
      // Verwijder uit aangepaste lijst
      const raw  = await env.SUBSCRIBERS.get('labels:lijst');
      const lijst = raw ? JSON.parse(raw) : [];
      await env.SUBSCRIBERS.put('labels:lijst', JSON.stringify(lijst.filter(l => l !== label)));
      // Voeg toe aan blocklist als het een standaard label is
      if (STANDAARD_LABELS.includes(label)) {
        const vRaw = await env.SUBSCRIBERS.get('labels:verwijderd');
        const verwijderd = vRaw ? JSON.parse(vRaw) : [];
        if (!verwijderd.includes(label)) {
          verwijderd.push(label);
          await env.SUBSCRIBERS.put('labels:verwijderd', JSON.stringify(verwijderd));
        }
      }
      return json({ ok: true });
    }
    if (url.pathname === '/alle-comments'  && request.method === 'GET')    return handleAlleComments(request, env);
    if (url.pathname === '/delete-comment' && request.method === 'POST')   return handleDeleteComment(request, env);
    if (url.pathname === '/fotograaf/verborgen'       && request.method === 'GET')  return handleVerborgeLijst(request, env);
    if (url.pathname === '/fotograaf/mappen-volgorde' && request.method === 'POST') return handleMappenVolgorde(request, env);
    if (url.pathname === '/fotograaf/foto-volgorde' && request.method === 'POST') return handleFotoVolgorde(request, env);
    if (url.pathname === '/fotograaf/map-datum'       && request.method === 'POST') return handleMapDatum(request, env);
    if (url.pathname === '/fotograaf/map-beschrijving' && request.method === 'POST') return handleMapBeschrijving(request, env);
    if (url.pathname === '/fotograaf/map-naam'         && request.method === 'POST') return handleMapNaam(request, env);
    if (url.pathname === '/fotograaf/map-eigen-pagina' && request.method === 'POST') return handleMapPaginas(request, env);
    if (url.pathname === '/fotograaf/map-paginas'      && request.method === 'POST') return handleMapPaginas(request, env);
    if (url.pathname === '/admin/login'               && request.method === 'POST') return handleAdminLogin(request, env);
    if (url.pathname === '/admin/manifest'            && request.method === 'GET')  return handleAdminManifestGet(request, env);
    if (url.pathname === '/admin/manifest'            && request.method === 'POST') return handleAdminManifestSave(request, env);
    if (url.pathname === '/admin/github-file'         && request.method === 'GET')  return handleAdminGithubFileGet(request, env);
    if (url.pathname === '/admin/github-file'         && request.method === 'POST') return handleAdminGithubFilePut(request, env);
    if (url.pathname === '/admin/review-wachtwoord'   && request.method === 'POST') return handleReviewWachtwoord(request, env);
    if (url.pathname === '/admin/review-sessie'       && request.method === 'POST') return handleReviewSessie(request, env);
    if (url.pathname === '/gallery/volgorde'          && request.method === 'POST') return handleGalleryVolgorde(request, env);
    if (url.pathname === '/gallery/volgorde'          && request.method === 'GET')  return handleGetGalleryVolgorde(request, env);
    if (url.pathname === '/fotograaf/positiebeheer'   && request.method === 'POST') return handlePositieBeheer(request, env);
    if (url.pathname === '/fotograaf/positiebeheer'   && request.method === 'GET')  {
      if (!requireSecret(request, env)) return json({ error: 'Geen toegang' }, 401);
      const id = new URL(request.url).searchParams.get('id');
      const mag = await env.SUBSCRIBERS.get('fotograaf:positiebeheer:' + id);
      return json({ mag: mag === '1' });
    }
    if (url.pathname === '/fotograaf/gallery-volgorde'   && request.method === 'POST') return handleFotograafGalleryVolgorde(request, env);
    if (url.pathname === '/fotograaf/positiebeheer-check' && request.method === 'GET') {
      const authToken = request.headers.get('X-Fotograaf-Token');
      const fotograaf = await getFotograafByToken(authToken, env);
      if (!fotograaf) return json({ mag: false });
      const mag = await env.SUBSCRIBERS.get('fotograaf:positiebeheer:' + fotograaf.id);
      return json({ mag: mag === '1' });
    }
    if (url.pathname === '/fotograaf/bio-opslaan'    && request.method === 'POST') return handleBioOpslaan(request, env);
    if (url.pathname === '/fotograaf/profielfoto'    && request.method === 'POST') return handleProfielfotoUpload(request, env);
    if (url.pathname === '/fotograaf/profielen'      && request.method === 'GET')  return handleProfielen(request, env);
    if (url.pathname.startsWith('/fotograaf/view-dashboard/') && request.method === 'GET') {
      const id = url.pathname.replace('/fotograaf/view-dashboard/', '');
      return handleViewDashboard(request, env, id);
    }
    if (url.pathname.startsWith('/foto/fotografen/'))                              return handleFotoServe(request, env);

    return new Response('Zaans Licht Worker', { status: 200, headers: CORS_HEADERS });
  },
};
