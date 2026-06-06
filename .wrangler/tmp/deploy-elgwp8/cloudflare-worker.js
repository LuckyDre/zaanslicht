var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// cloudflare-worker.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://zaanslicht.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Worker-Secret, X-Fotograaf-Token"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}
__name(json, "json");
function requireSecret(request, env) {
  return request.headers.get("X-Worker-Secret") === env.WORKER_SECRET;
}
__name(requireSecret, "requireSecret");
async function handleSubscribe(request, env) {
  const { email } = await request.json().catch(() => ({}));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Ongeldig e-mailadres" }, 400);
  }
  const emailLower = email.toLowerCase().trim();
  const existing = await env.SUBSCRIBERS.get("sub:" + emailLower);
  if (existing) return json({ ok: true, message: "Al aangemeld" });
  const token = Array.from(crypto.getRandomValues(new Uint8Array(20))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const subscriber = { email: emailLower, token, ts: Date.now() };
  await env.SUBSCRIBERS.put("sub:" + emailLower, JSON.stringify(subscriber));
  await env.SUBSCRIBERS.put("tok:" + token, emailLower);
  return json({ ok: true });
}
__name(handleSubscribe, "handleSubscribe");
async function handleUnsubscribe(request, env) {
  const { token } = await request.json().catch(() => ({}));
  if (!token) return json({ error: "Token ontbreekt" }, 400);
  const emailLower = await env.SUBSCRIBERS.get("tok:" + token);
  if (!emailLower) return json({ error: "Onbekend token" }, 404);
  await env.SUBSCRIBERS.delete("sub:" + emailLower);
  await env.SUBSCRIBERS.delete("tok:" + token);
  return json({ ok: true });
}
__name(handleUnsubscribe, "handleUnsubscribe");
async function handleCount(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  let count = 0;
  let cursor = void 0;
  do {
    const result = await env.SUBSCRIBERS.list({ prefix: "sub:", cursor, limit: 1e3 });
    count += result.keys.length;
    cursor = result.list_complete ? void 0 : result.cursor;
  } while (cursor);
  return json({ count });
}
__name(handleCount, "handleCount");
async function handleSend(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const { subject, message } = await request.json().catch(() => ({}));
  if (!subject || !message) return json({ error: "Subject en message zijn verplicht" }, 400);
  const emails = [];
  let cursor = void 0;
  do {
    const result = await env.SUBSCRIBERS.list({ prefix: "sub:", cursor, limit: 1e3 });
    for (const key of result.keys) {
      const raw = await env.SUBSCRIBERS.get(key.name);
      if (raw) {
        try {
          emails.push(JSON.parse(raw));
        } catch {
        }
      }
    }
    cursor = result.list_complete ? void 0 : result.cursor;
  } while (cursor);
  if (!emails.length) return json({ sent: 0, message: "Geen abonnees" });
  const paused = await env.SUBSCRIBERS.get("settings:paused");
  if (paused === "1") return json({ sent: 0, message: "Verzenden is gepauzeerd" });
  let sent = 0, errors = 0, skipped = 0;
  for (const sub of emails) {
    const banned = await env.SUBSCRIBERS.get("ban:" + sub.email);
    if (banned === "1") {
      skipped++;
      continue;
    }
    const unsubUrl = `https://zaanslicht.com/afmelden.html?token=${sub.token}`;
    const html = buildEmail(message, unsubUrl);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL || "Zaans Licht <updates@zaanslicht.com>",
        to: sub.email,
        subject,
        html,
        headers: {
          "List-Unsubscribe": `<https://zaanslicht.com/afmelden.html?token=${sub.token}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
        }
      })
    });
    if (res.ok) sent++;
    else errors++;
  }
  return json({ sent, errors, skipped });
}
__name(handleSend, "handleSend");
function buildEmail(message, unsubscribeUrl) {
  const htmlMessage = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zaans Licht \u2014 Nieuwe foto's</title></head>
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
__name(buildEmail, "buildEmail");
async function handleDeleteSubscriber(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const { email } = await request.json().catch(() => ({}));
  if (!email) return json({ error: "Email ontbreekt" }, 400);
  const emailLower = email.toLowerCase().trim();
  const raw = await env.SUBSCRIBERS.get("sub:" + emailLower);
  if (raw) {
    const sub = JSON.parse(raw);
    await env.SUBSCRIBERS.delete("sub:" + emailLower);
    if (sub.token) await env.SUBSCRIBERS.delete("tok:" + sub.token);
  }
  await env.SUBSCRIBERS.delete("ban:" + emailLower);
  return json({ ok: true });
}
__name(handleDeleteSubscriber, "handleDeleteSubscriber");
async function handleBan(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const { email, ban } = await request.json().catch(() => ({}));
  if (!email) return json({ error: "Email ontbreekt" }, 400);
  const emailLower = email.toLowerCase().trim();
  if (ban) {
    await env.SUBSCRIBERS.put("ban:" + emailLower, "1");
  } else {
    await env.SUBSCRIBERS.delete("ban:" + emailLower);
  }
  return json({ ok: true });
}
__name(handleBan, "handleBan");
async function handlePause(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const { paused } = await request.json().catch(() => ({}));
  if (paused) {
    await env.SUBSCRIBERS.put("settings:paused", "1");
  } else {
    await env.SUBSCRIBERS.delete("settings:paused");
  }
  return json({ ok: true, paused });
}
__name(handlePause, "handlePause");
async function handleGetPause(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const val = await env.SUBSCRIBERS.get("settings:paused");
  return json({ paused: val === "1" });
}
__name(handleGetPause, "handleGetPause");
async function handleSubscribers(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const list = [];
  let cursor = void 0;
  do {
    const result = await env.SUBSCRIBERS.list({ prefix: "sub:", cursor, limit: 1e3 });
    for (const key of result.keys) {
      const raw = await env.SUBSCRIBERS.get(key.name);
      if (raw) {
        try {
          const sub = JSON.parse(raw);
          list.push({ email: sub.email, ts: sub.ts });
        } catch {
        }
      }
    }
    cursor = result.list_complete ? void 0 : result.cursor;
  } while (cursor);
  for (const sub of list) {
    const banned = await env.SUBSCRIBERS.get("ban:" + sub.email);
    sub.banned = banned === "1";
  }
  list.sort((a, b) => b.ts - a.ts);
  return json({ list });
}
__name(handleSubscribers, "handleSubscribers");
function randomToken(bytes = 24) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(randomToken, "randomToken");
async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 1e5 },
    key,
    256
  );
  const hash = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${salt}:${hash}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, stored) {
  if (!stored.startsWith("pbkdf2:")) {
    const enc2 = new TextEncoder().encode(password);
    const hash2 = await crypto.subtle.digest("SHA-256", enc2);
    const hex = Array.from(new Uint8Array(hash2)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return hex === stored;
  }
  const [, salt, expectedHash] = stored.split(":");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 1e5 },
    key,
    256
  );
  const hash = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hash === expectedHash;
}
__name(verifyPassword, "verifyPassword");
async function getFotograafByToken(token, env) {
  const id = await env.SUBSCRIBERS.get("fotograaf:token:" + token);
  if (!id) return null;
  const raw = await env.SUBSCRIBERS.get("fotograaf:account:" + id);
  return raw ? JSON.parse(raw) : null;
}
__name(getFotograafByToken, "getFotograafByToken");
async function handleFotograafUitnodiging(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const { naam, email } = await request.json().catch(() => ({}));
  if (!naam || !email) return json({ error: "Naam en email verplicht" }, 400);
  const token = randomToken();
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1e3;
  await env.SUBSCRIBERS.put("fotograaf:invite:" + token, JSON.stringify({ naam, email, expires }), { expirationTtl: 7 * 24 * 3600 });
  const link = `https://zaanslicht.com/fotograaf.html?invite=${token}`;
  try {
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.FROM_EMAIL || "Zaans Licht <updates@zaanslicht.com>",
        to: email,
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
  <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111;">Hoi ${naam}! \u{1F44B}</p>
  <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.7;">Je bent uitgenodigd om foto's te delen op <strong>Zaans Licht</strong>. Klik op de knop hieronder om je account aan te maken.</p>
  <div style="background:#f8f8f8;border-left:4px solid #FF6B00;padding:14px 18px;border-radius:4px;margin:0 0 24px;">
    <p style="margin:0;font-size:13px;color:#555;line-height:1.9;">
      \u{1F4A1} <strong>Bewaar deze mail goed</strong> \u2014 de link is 7 dagen geldig en eenmalig te gebruiken.<br>
      \u{1F510} <strong>Kies een sterk wachtwoord</strong> \u2014 minimaal 8 tekens, iets wat je goed onthoudt.<br>
      \u{1F516} <strong>Sla de pagina daarna op als bladwijzer</strong> \u2014 zo kom je altijd snel terug.
    </p>
  </div>
  <div style="text-align:center;margin:28px 0;">
    <a href="${link}" style="display:inline-block;background:#FF6B00;color:#fff;text-decoration:none;padding:14px 36px;border-radius:6px;font-weight:700;font-size:15px;">Account aanmaken &rarr;</a>
  </div>
  <p style="font-size:12px;color:#aaa;text-align:center;margin-top:16px;">Of kopieer deze link: <span style="color:#FF6B00;word-break:break-all;">${link}</span></p>
</td></tr>
<tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:16px 36px;text-align:center;">
  <p style="margin:0;font-size:11px;color:#aaa;">Zaans Licht \u2014 uitnodiging voor gastfotograaf</p>
</td></tr>
</table></td></tr></table></body></html>`
      })
    });
    if (!mailRes.ok) {
      const fout = await mailRes.text().catch(() => `HTTP ${mailRes.status}`);
      return json({ ok: true, mailFout: fout, link });
    }
  } catch (mailErr) {
    return json({ ok: true, mailFout: String(mailErr), link });
  }
  return json({ ok: true, mailVerstuurd: true, link });
}
__name(handleFotograafUitnodiging, "handleFotograafUitnodiging");
async function handleUitnodigingenLijst(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const lijst = [];
  let cursor;
  do {
    const r = await env.SUBSCRIBERS.list({ prefix: "fotograaf:invite:", cursor, limit: 100 });
    for (const key of r.keys) {
      const raw = await env.SUBSCRIBERS.get(key.name);
      if (raw) {
        const inv = JSON.parse(raw);
        const token = key.name.replace("fotograaf:invite:", "");
        lijst.push({
          token,
          naam: inv.naam,
          email: inv.email,
          expires: inv.expires,
          verlopen: Date.now() > inv.expires
        });
      }
    }
    cursor = r.list_complete ? void 0 : r.cursor;
  } while (cursor);
  lijst.sort((a, b) => b.expires - a.expires);
  return json({ uitnodigingen: lijst });
}
__name(handleUitnodigingenLijst, "handleUitnodigingenLijst");
async function handleUitnodigingIntrekken(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const { token } = await request.json().catch(() => ({}));
  if (!token) return json({ error: "token verplicht" }, 400);
  await env.SUBSCRIBERS.delete("fotograaf:invite:" + token);
  return json({ ok: true });
}
__name(handleUitnodigingIntrekken, "handleUitnodigingIntrekken");
async function handleFotograafRegister(request, env) {
  const { inviteToken, password, kleur } = await request.json().catch(() => ({}));
  if (!inviteToken || !password) return json({ error: "Invite token en wachtwoord verplicht" }, 400);
  const raw = await env.SUBSCRIBERS.get("fotograaf:invite:" + inviteToken);
  if (!raw) return json({ error: "Ongeldige of verlopen uitnodiging" }, 400);
  const invite = JSON.parse(raw);
  if (Date.now() > invite.expires) return json({ error: "Uitnodiging verlopen" }, 400);
  const id = randomToken(8);
  const passwordHash = await hashPassword(password);
  const account = { id, naam: invite.naam, email: invite.email, kleur: kleur || "#3b82f6", passwordHash, ts: Date.now() };
  await env.SUBSCRIBERS.put("fotograaf:account:" + id, JSON.stringify(account));
  await env.SUBSCRIBERS.delete("fotograaf:invite:" + inviteToken);
  const sessieToken = randomToken();
  await env.SUBSCRIBERS.put("fotograaf:token:" + sessieToken, id, { expirationTtl: 30 * 24 * 3600 });
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.FROM_EMAIL || "Zaans Licht <updates@zaanslicht.com>",
        to: account.email,
        subject: "Welkom bij Zaans Licht \u2014 jouw account is aangemaakt",
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
        <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111;">Welkom, ${account.naam}! \u{1F44B}</p>
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
</table></body></html>`
      })
    });
  } catch {
  }
  return json({ ok: true, token: sessieToken, naam: account.naam, kleur: account.kleur, id });
}
__name(handleFotograafRegister, "handleFotograafRegister");
async function handleFotograafLogin(request, env) {
  const { email, password } = await request.json().catch(() => ({}));
  if (!email || !password) return json({ error: "Email en wachtwoord verplicht" }, 400);
  let found = null;
  let cursor;
  do {
    const r = await env.SUBSCRIBERS.list({ prefix: "fotograaf:account:", cursor, limit: 100 });
    for (const key of r.keys) {
      const a = JSON.parse(await env.SUBSCRIBERS.get(key.name));
      if (a.email.toLowerCase() === email.toLowerCase()) {
        found = a;
        break;
      }
    }
    cursor = r.list_complete ? void 0 : r.cursor;
  } while (cursor && !found);
  if (!found) return json({ error: "Onbekend e-mailadres" }, 401);
  const ok = await verifyPassword(password, found.passwordHash);
  if (!ok) return json({ error: "Onjuist wachtwoord" }, 401);
  if (!found.passwordHash.startsWith("pbkdf2:")) {
    found.passwordHash = await hashPassword(password);
    await env.SUBSCRIBERS.put("fotograaf:account:" + found.id, JSON.stringify(found));
  }
  const geblokkeerd = await env.SUBSCRIBERS.get("fotograaf:geblokkeerd:" + found.id);
  if (geblokkeerd === "1") return json({ error: "Je account is tijdelijk geblokkeerd. Neem contact op met de beheerder." }, 403);
  const sessieToken = randomToken();
  await env.SUBSCRIBERS.put("fotograaf:token:" + sessieToken, found.id, { expirationTtl: 30 * 24 * 3600 });
  return json({ ok: true, token: sessieToken, naam: found.naam, kleur: found.kleur, id: found.id });
}
__name(handleFotograafLogin, "handleFotograafLogin");
async function handleFotoUpload(request, env) {
  const authToken = request.headers.get("X-Fotograaf-Token");
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: "Niet ingelogd" }, 401);
  const geblokkeerd = await env.SUBSCRIBERS.get("fotograaf:geblokkeerd:" + fotograaf.id);
  if (geblokkeerd === "1") return json({ error: "Je account is tijdelijk geblokkeerd." }, 403);
  const formData = await request.formData().catch(() => null);
  if (!formData) return json({ error: "Geen formData" }, 400);
  const file = formData.get("foto");
  const categorie = (formData.get("categorie") || "eigen").toLowerCase().replace(/[^a-z0-9]/g, "-");
  const map = (formData.get("map") || "Mijn foto's").substring(0, 80);
  if (!file || !file.name) return json({ error: "Geen bestand" }, 400);
  const naam_lower = file.name.toLowerCase();
  const toegestaan = naam_lower.endsWith(".webp") || naam_lower.endsWith(".jpg") || naam_lower.endsWith(".jpeg");
  if (!toegestaan) return json({ error: "Alleen WebP of JPG bestanden toegestaan" }, 400);
  const contentType = naam_lower.endsWith(".webp") ? "image/webp" : "image/jpeg";
  if (file.size > 15 * 1024 * 1024) return json({ error: "Bestand te groot (max 15MB)" }, 400);
  const veiligNaam = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const r2Key = `fotografen/${fotograaf.id}/${categorie}/${encodeURIComponent(map)}/${veiligNaam}`;
  await env.FOTOS.put(r2Key, file.stream(), {
    httpMetadata: { contentType },
    customMetadata: { fotograafId: fotograaf.id, fotograafNaam: fotograaf.naam, map, categorie }
  });
  const mappenRaw = await env.SUBSCRIBERS.get("fotograaf:mappen:" + fotograaf.id);
  const mappen = mappenRaw ? JSON.parse(mappenRaw) : [];
  if (!mappen.find((m) => m.map === map && m.categorie === categorie)) {
    mappen.push({ map, categorie, ts: Date.now() });
    await env.SUBSCRIBERS.put("fotograaf:mappen:" + fotograaf.id, JSON.stringify(mappen));
  }
  return json({ ok: true, key: r2Key, naam: veiligNaam });
}
__name(handleFotoUpload, "handleFotoUpload");
async function handleFotosLijst(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const categorie = url.searchParams.get("categorie");
  if (!id) return json({ error: "id verplicht" }, 400);
  const prefix = categorie ? `fotografen/${id}/${categorie}/` : `fotografen/${id}/`;
  const lijst = await env.FOTOS.list({ prefix, limit: 500 });
  const [verborgenMappenRaw, verborgenFotosRaw] = await Promise.all([
    env.SUBSCRIBERS.get("fotograaf:verborgen-mappen:" + id),
    env.SUBSCRIBERS.get("fotograaf:verborgen-fotos:" + id)
  ]);
  const verborgenMappen = verborgenMappenRaw ? JSON.parse(verborgenMappenRaw) : [];
  const verborgenFotos = verborgenFotosRaw ? JSON.parse(verborgenFotosRaw) : [];
  const fotos = lijst.objects.filter((o) => !verborgenFotos.includes(o.key)).filter((o) => !verborgenMappen.some((m) => o.key.includes(`/${encodeURIComponent(m)}/`) || o.key.includes(`/${m}/`))).map((o) => ({
    key: o.key,
    naam: o.key.split("/").pop(),
    ts: o.uploaded?.getTime() || 0
  }));
  return json({ fotos });
}
__name(handleFotosLijst, "handleFotosLijst");
async function handleFotograafManifest(request, env) {
  const accounts = [];
  let cursor;
  do {
    const r = await env.SUBSCRIBERS.list({ prefix: "fotograaf:account:", cursor, limit: 100 });
    for (const key of r.keys) {
      const a = JSON.parse(await env.SUBSCRIBERS.get(key.name));
      const mappenRaw = await env.SUBSCRIBERS.get("fotograaf:mappen:" + a.id);
      const mappen = mappenRaw ? JSON.parse(mappenRaw) : [];
      accounts.push({ id: a.id, naam: a.naam, kleur: a.kleur, mappen });
    }
    cursor = r.list_complete ? void 0 : r.cursor;
  } while (cursor);
  return json({ fotografen: accounts });
}
__name(handleFotograafManifest, "handleFotograafManifest");
async function handleFotograafLijst(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const lijst = [];
  let cursor;
  do {
    const r = await env.SUBSCRIBERS.list({ prefix: "fotograaf:account:", cursor, limit: 100 });
    for (const key of r.keys) {
      const a = JSON.parse(await env.SUBSCRIBERS.get(key.name));
      const mappenRaw = await env.SUBSCRIBERS.get("fotograaf:mappen:" + a.id);
      lijst.push({ id: a.id, naam: a.naam, email: a.email, kleur: a.kleur, ts: a.ts, aantalMappen: mappenRaw ? JSON.parse(mappenRaw).length : 0 });
    }
    cursor = r.list_complete ? void 0 : r.cursor;
  } while (cursor);
  return json({ fotografen: lijst });
}
__name(handleFotograafLijst, "handleFotograafLijst");
async function handleFotograafVerwijderen(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const { id } = await request.json().catch(() => ({}));
  if (!id) return json({ error: "id verplicht" }, 400);
  await env.SUBSCRIBERS.delete("fotograaf:account:" + id);
  await env.SUBSCRIBERS.delete("fotograaf:mappen:" + id);
  const lijst = await env.FOTOS.list({ prefix: `fotografen/${id}/`, limit: 1e3 });
  for (const obj of lijst.objects) {
    await env.FOTOS.delete(obj.key);
  }
  return json({ ok: true });
}
__name(handleFotograafVerwijderen, "handleFotograafVerwijderen");
async function handleFotoVerwijderen(request, env) {
  const authToken = request.headers.get("X-Fotograaf-Token");
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: "Niet ingelogd" }, 401);
  const { key } = await request.json().catch(() => ({}));
  if (!key) return json({ error: "key verplicht" }, 400);
  if (!key.startsWith(`fotografen/${fotograaf.id}/`)) return json({ error: "Geen toegang tot dit bestand" }, 403);
  await env.FOTOS.delete(key);
  return json({ ok: true });
}
__name(handleFotoVerwijderen, "handleFotoVerwijderen");
async function handleBlokkeer(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const { id, geblokkeerd } = await request.json().catch(() => ({}));
  if (!id) return json({ error: "id verplicht" }, 400);
  if (geblokkeerd) {
    await env.SUBSCRIBERS.put("fotograaf:geblokkeerd:" + id, "1");
  } else {
    await env.SUBSCRIBERS.delete("fotograaf:geblokkeerd:" + id);
  }
  return json({ ok: true, geblokkeerd });
}
__name(handleBlokkeer, "handleBlokkeer");
async function handleVerborgeMap(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const { id, map, verborgen } = await request.json().catch(() => ({}));
  if (!id || !map) return json({ error: "id en map verplicht" }, 400);
  const raw = await env.SUBSCRIBERS.get("fotograaf:verborgen-mappen:" + id);
  let lijst = raw ? JSON.parse(raw) : [];
  if (verborgen) {
    if (!lijst.includes(map)) lijst.push(map);
  } else {
    lijst = lijst.filter((m) => m !== map);
  }
  await env.SUBSCRIBERS.put("fotograaf:verborgen-mappen:" + id, JSON.stringify(lijst));
  return json({ ok: true });
}
__name(handleVerborgeMap, "handleVerborgeMap");
async function handleVerborgeFoto(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const { id, key, verborgen } = await request.json().catch(() => ({}));
  if (!id || !key) return json({ error: "id en key verplicht" }, 400);
  const raw = await env.SUBSCRIBERS.get("fotograaf:verborgen-fotos:" + id);
  let lijst = raw ? JSON.parse(raw) : [];
  if (verborgen) {
    if (!lijst.includes(key)) lijst.push(key);
  } else {
    lijst = lijst.filter((k) => k !== key);
  }
  await env.SUBSCRIBERS.put("fotograaf:verborgen-fotos:" + id, JSON.stringify(lijst));
  return json({ ok: true });
}
__name(handleVerborgeFoto, "handleVerborgeFoto");
async function handleVerborgeLijst(request, env) {
  if (!requireSecret(request, env)) return json({ error: "Geen toegang" }, 401);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "id verplicht" }, 400);
  const [mappen, fotos, geblokkeerd] = await Promise.all([
    env.SUBSCRIBERS.get("fotograaf:verborgen-mappen:" + id),
    env.SUBSCRIBERS.get("fotograaf:verborgen-fotos:" + id),
    env.SUBSCRIBERS.get("fotograaf:geblokkeerd:" + id)
  ]);
  return json({
    geblokkeerd: geblokkeerd === "1",
    verborgenMappen: mappen ? JSON.parse(mappen) : [],
    verborgenFotos: fotos ? JSON.parse(fotos) : []
  });
}
__name(handleVerborgeLijst, "handleVerborgeLijst");
async function handleAccountVerwijderen(request, env) {
  const authToken = request.headers.get("X-Fotograaf-Token");
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: "Niet ingelogd" }, 401);
  const lijst = await env.FOTOS.list({ prefix: `fotografen/${fotograaf.id}/`, limit: 1e3 });
  for (const obj of lijst.objects) {
    await env.FOTOS.delete(obj.key);
  }
  await env.SUBSCRIBERS.delete("fotograaf:account:" + fotograaf.id);
  await env.SUBSCRIBERS.delete("fotograaf:mappen:" + fotograaf.id);
  await env.SUBSCRIBERS.delete("fotograaf:token:" + authToken);
  return json({ ok: true });
}
__name(handleAccountVerwijderen, "handleAccountVerwijderen");
async function handleGalleryVolgorde(request, env) {
  const secret = request.headers.get("X-Worker-Secret");
  if (!secret || secret !== env.WORKER_SECRET) return json({ error: "Niet toegestaan" }, 401);
  const body = await request.json().catch(() => ({}));
  if (!body.voetbal && !body.nosports) return json({ error: "voetbal of nosports verplicht" }, 400);
  if (body.voetbal) await env.SUBSCRIBERS.put("gallery:volgorde:voetbal", JSON.stringify(body.voetbal));
  if (body.nosports) await env.SUBSCRIBERS.put("gallery:volgorde:nosports", JSON.stringify(body.nosports));
  return json({ ok: true });
}
__name(handleGalleryVolgorde, "handleGalleryVolgorde");
async function handleGetGalleryVolgorde(request, env) {
  const voetbal = await env.SUBSCRIBERS.get("gallery:volgorde:voetbal");
  const nosports = await env.SUBSCRIBERS.get("gallery:volgorde:nosports");
  return json({
    voetbal: voetbal ? JSON.parse(voetbal) : null,
    nosports: nosports ? JSON.parse(nosports) : null
  });
}
__name(handleGetGalleryVolgorde, "handleGetGalleryVolgorde");
async function handleMappenVolgorde(request, env) {
  const adminSecret = request.headers.get("X-Worker-Secret");
  const isAdmin = adminSecret && adminSecret === env.WORKER_SECRET;
  let fotograafId;
  let mappen;
  if (isAdmin) {
    const body = await request.json().catch(() => ({}));
    fotograafId = body.id;
    const volgorde = body.volgorde;
    if (!fotograafId || !Array.isArray(volgorde)) return json({ error: "id en volgorde verplicht" }, 400);
    const huidigeRaw = await env.SUBSCRIBERS.get("fotograaf:mappen:" + fotograafId);
    const huidigeMappen = huidigeRaw ? JSON.parse(huidigeRaw) : [];
    mappen = volgorde.map((mapNaam) => huidigeMappen.find((m) => m.map === mapNaam)).filter(Boolean);
    huidigeMappen.forEach((m) => {
      if (!mappen.find((x) => x.map === m.map)) mappen.push(m);
    });
  } else {
    const authToken = request.headers.get("X-Fotograaf-Token");
    const fotograaf = await getFotograafByToken(authToken, env);
    if (!fotograaf) return json({ error: "Niet ingelogd" }, 401);
    fotograafId = fotograaf.id;
    const body = await request.json().catch(() => ({}));
    mappen = body.mappen;
    if (!Array.isArray(mappen)) return json({ error: "mappen verplicht" }, 400);
  }
  await env.SUBSCRIBERS.put("fotograaf:mappen:" + fotograafId, JSON.stringify(mappen));
  return json({ ok: true });
}
__name(handleMappenVolgorde, "handleMappenVolgorde");
async function handleFotograafKleur(request, env) {
  const authToken = request.headers.get("X-Fotograaf-Token");
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: "Niet ingelogd" }, 401);
  const { kleur } = await request.json().catch(() => ({}));
  if (!kleur || !/^#[0-9a-fA-F]{6}$/.test(kleur)) return json({ error: "Ongeldige kleur" }, 400);
  fotograaf.kleur = kleur;
  await env.SUBSCRIBERS.put("fotograaf:account:" + fotograaf.id, JSON.stringify(fotograaf));
  return json({ ok: true, kleur });
}
__name(handleFotograafKleur, "handleFotograafKleur");
async function handleBioOpslaan(request, env) {
  const authToken = request.headers.get("X-Fotograaf-Token");
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: "Niet ingelogd" }, 401);
  const { bio } = await request.json().catch(() => ({}));
  if (typeof bio !== "string") return json({ error: "bio verplicht" }, 400);
  if (bio.length > 1e3) return json({ error: "Bio mag maximaal 1000 tekens zijn" }, 400);
  await env.SUBSCRIBERS.put("fotograaf:bio:" + fotograaf.id, JSON.stringify({ bio: bio.trim(), ts: Date.now() }));
  return json({ ok: true });
}
__name(handleBioOpslaan, "handleBioOpslaan");
async function handleProfielfotoUpload(request, env) {
  const authToken = request.headers.get("X-Fotograaf-Token");
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: "Niet ingelogd" }, 401);
  const formData = await request.formData().catch(() => null);
  if (!formData) return json({ error: "Geen formData" }, 400);
  const file = formData.get("foto");
  if (!file || !file.name) return json({ error: "Geen bestand" }, 400);
  const naam = file.name.toLowerCase();
  if (!naam.endsWith(".webp") && !naam.endsWith(".jpg") && !naam.endsWith(".jpeg")) {
    return json({ error: "Alleen WebP of JPG toegestaan" }, 400);
  }
  if (file.size > 5 * 1024 * 1024) return json({ error: "Max 5MB voor profielfoto" }, 400);
  const contentType = naam.endsWith(".webp") ? "image/webp" : "image/jpeg";
  const ext = naam.endsWith(".webp") ? "webp" : "jpg";
  const r2Key = `fotografen/${fotograaf.id}/profiel.${ext}`;
  await env.FOTOS.put(r2Key, file.stream(), {
    httpMetadata: { contentType },
    customMetadata: { fotograafId: fotograaf.id }
  });
  await env.SUBSCRIBERS.put("fotograaf:profielfoto:" + fotograaf.id, r2Key);
  return json({ ok: true, key: r2Key });
}
__name(handleProfielfotoUpload, "handleProfielfotoUpload");
async function handleComment(request, env) {
  try {
    const body = await request.json().catch((e) => null);
    if (!body) return json({ error: "Geen geldige JSON" }, 400);
    const { naam, tekst, photoKey, src } = body;
    if (!tekst) return json({ error: "Bericht vereist" }, 400);
    if (!photoKey) return json({ error: "Foto niet geselecteerd" }, 400);
    const timestamp = Date.now();
    const commentId = Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const commentKey = `comment:${photoKey}:${commentId}`;
    await env.SUBSCRIBERS.put(
      commentKey,
      JSON.stringify({ naam: naam || "Anoniem", tekst, ts: timestamp, src, photoKey }),
      { expirationTtl: 7776e3 }
      // 90 dagen
    );
    await env.SUBSCRIBERS.put(
      `recent:${commentId}`,
      JSON.stringify({ naam: naam || "Anoniem", tekst, ts: timestamp, photoKey, src }),
      { expirationTtl: 7776e3 }
    );
    return json({ ok: true, id: commentId });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
__name(handleComment, "handleComment");
async function handleComments(request, env) {
  try {
    const url = new URL(request.url);
    const photoKey = url.searchParams.get("key");
    if (!photoKey) return json({ error: "Photo key vereist" }, 400);
    const comments = [];
    let cursor;
    do {
      const r = await env.SUBSCRIBERS.list({ prefix: `comment:${photoKey}:`, cursor, limit: 100 });
      for (const key of r.keys) {
        const c = JSON.parse(await env.SUBSCRIBERS.get(key.name));
        comments.push(c);
      }
      cursor = r.list_complete ? void 0 : r.cursor;
    } while (cursor);
    comments.sort((a, b) => b.ts - a.ts);
    return json({ comments });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
__name(handleComments, "handleComments");
async function handleProfielen(request, env) {
  const profielen = [];
  let cursor;
  do {
    const r = await env.SUBSCRIBERS.list({ prefix: "fotograaf:account:", cursor, limit: 100 });
    for (const key of r.keys) {
      const a = JSON.parse(await env.SUBSCRIBERS.get(key.name));
      const bioRaw = await env.SUBSCRIBERS.get("fotograaf:bio:" + a.id);
      const fotoKey = await env.SUBSCRIBERS.get("fotograaf:profielfoto:" + a.id);
      const bio = bioRaw ? JSON.parse(bioRaw).bio : "";
      const fotoUrl = fotoKey ? `/foto/${fotoKey}` : null;
      if (bio || fotoUrl) {
        profielen.push({ id: a.id, naam: a.naam, kleur: a.kleur, bio, fotoUrl });
      }
    }
    cursor = r.list_complete ? void 0 : r.cursor;
  } while (cursor);
  return json({ profielen });
}
__name(handleProfielen, "handleProfielen");
async function handleFotoServe(request, env) {
  const url = new URL(request.url);
  const key = url.pathname.replace("/foto/", "");
  if (!key.startsWith("fotografen/")) return new Response("Niet gevonden", { status: 404 });
  const object = await env.FOTOS.get(key);
  if (!object) return new Response("Niet gevonden", { status: 404 });
  const ext = key.split(".").pop().toLowerCase();
  const contentTypes = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "png": "image/png",
    "gif": "image/gif",
    "heic": "image/heic"
  };
  const contentType = object.httpMetadata?.contentType || contentTypes[ext] || "image/jpeg";
  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(handleFotoServe, "handleFotoServe");
var cloudflare_worker_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    if (url.pathname === "/subscribe" && request.method === "POST") return handleSubscribe(request, env);
    if (url.pathname === "/unsubscribe" && request.method === "POST") return handleUnsubscribe(request, env);
    if (url.pathname === "/count" && request.method === "GET") return handleCount(request, env);
    if (url.pathname === "/subscribers" && request.method === "GET") return handleSubscribers(request, env);
    if (url.pathname === "/delete-subscriber" && request.method === "POST") return handleDeleteSubscriber(request, env);
    if (url.pathname === "/ban" && request.method === "POST") return handleBan(request, env);
    if (url.pathname === "/pause" && request.method === "POST") return handlePause(request, env);
    if (url.pathname === "/pause" && request.method === "GET") return handleGetPause(request, env);
    if (url.pathname === "/send" && request.method === "POST") return handleSend(request, env);
    if (url.pathname === "/fotograaf/uitnodigen" && request.method === "POST") return handleFotograafUitnodiging(request, env);
    if (url.pathname === "/fotograaf/uitnodigingen" && request.method === "GET") return handleUitnodigingenLijst(request, env);
    if (url.pathname === "/fotograaf/intrekken" && request.method === "POST") return handleUitnodigingIntrekken(request, env);
    if (url.pathname === "/fotograaf/register" && request.method === "POST") return handleFotograafRegister(request, env);
    if (url.pathname === "/fotograaf/login" && request.method === "POST") return handleFotograafLogin(request, env);
    if (url.pathname === "/fotograaf/upload" && request.method === "POST") return handleFotoUpload(request, env);
    if (url.pathname === "/fotograaf/fotos" && request.method === "GET") return handleFotosLijst(request, env);
    if (url.pathname === "/fotograaf/manifest" && request.method === "GET") return handleFotograafManifest(request, env);
    if (url.pathname === "/fotograaf/lijst" && request.method === "GET") return handleFotograafLijst(request, env);
    if (url.pathname === "/fotograaf/verwijderen" && request.method === "POST") return handleFotograafVerwijderen(request, env);
    if (url.pathname === "/fotograaf/foto-delete" && request.method === "POST") return handleFotoVerwijderen(request, env);
    if (url.pathname === "/fotograaf/kleur" && request.method === "POST") return handleFotograafKleur(request, env);
    if (url.pathname === "/fotograaf/delete-account" && request.method === "POST") return handleAccountVerwijderen(request, env);
    if (url.pathname === "/fotograaf/blokkeer" && request.method === "POST") return handleBlokkeer(request, env);
    if (url.pathname === "/fotograaf/verberg-map" && request.method === "POST") return handleVerborgeMap(request, env);
    if (url.pathname === "/fotograaf/verberg-foto" && request.method === "POST") return handleVerborgeFoto(request, env);
    if (url.pathname === "/comment" && request.method === "POST") return handleComment(request, env);
    if (url.pathname === "/comments" && request.method === "GET") return handleComments(request, env);
    if (url.pathname === "/fotograaf/verborgen" && request.method === "GET") return handleVerborgeLijst(request, env);
    if (url.pathname === "/fotograaf/mappen-volgorde" && request.method === "POST") return handleMappenVolgorde(request, env);
    if (url.pathname === "/gallery/volgorde" && request.method === "POST") return handleGalleryVolgorde(request, env);
    if (url.pathname === "/gallery/volgorde" && request.method === "GET") return handleGetGalleryVolgorde(request, env);
    if (url.pathname === "/fotograaf/bio-opslaan" && request.method === "POST") return handleBioOpslaan(request, env);
    if (url.pathname === "/fotograaf/profielfoto" && request.method === "POST") return handleProfielfotoUpload(request, env);
    if (url.pathname === "/fotograaf/profielen" && request.method === "GET") return handleProfielen(request, env);
    if (url.pathname.startsWith("/foto/fotografen/")) return handleFotoServe(request, env);
    return new Response("Zaans Licht Worker", { status: 200, headers: CORS_HEADERS });
  }
};
export {
  cloudflare_worker_default as default
};
//# sourceMappingURL=cloudflare-worker.js.map
