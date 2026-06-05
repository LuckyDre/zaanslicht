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
        html
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
  const enc = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
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
  return json({ ok: true, link });
}
__name(handleFotograafUitnodiging, "handleFotograafUitnodiging");
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
  const hash = await hashPassword(password);
  if (hash !== found.passwordHash) return json({ error: "Onjuist wachtwoord" }, 401);
  const sessieToken = randomToken();
  await env.SUBSCRIBERS.put("fotograaf:token:" + sessieToken, found.id, { expirationTtl: 30 * 24 * 3600 });
  return json({ ok: true, token: sessieToken, naam: found.naam, kleur: found.kleur, id: found.id });
}
__name(handleFotograafLogin, "handleFotograafLogin");
async function handleFotoUpload(request, env) {
  const authToken = request.headers.get("X-Fotograaf-Token");
  const fotograaf = await getFotograafByToken(authToken, env);
  if (!fotograaf) return json({ error: "Niet ingelogd" }, 401);
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
  const fotos = lijst.objects.map((o) => ({
    key: o.key,
    naam: o.key.split("/").pop(),
    url: `https://zaanslicht-fotos.${env.CF_ACCOUNT_ID || ""}.r2.cloudflarestorage.com/${o.key}`,
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
async function handleFotoServe(request, env) {
  const url = new URL(request.url);
  const key = url.pathname.replace("/foto/", "");
  if (!key.startsWith("fotografen/")) return new Response("Niet gevonden", { status: 404 });
  const object = await env.FOTOS.get(key);
  if (!object) return new Response("Niet gevonden", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": "image/webp",
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
    if (url.pathname === "/fotograaf/register" && request.method === "POST") return handleFotograafRegister(request, env);
    if (url.pathname === "/fotograaf/login" && request.method === "POST") return handleFotograafLogin(request, env);
    if (url.pathname === "/fotograaf/upload" && request.method === "POST") return handleFotoUpload(request, env);
    if (url.pathname === "/fotograaf/fotos" && request.method === "GET") return handleFotosLijst(request, env);
    if (url.pathname === "/fotograaf/manifest" && request.method === "GET") return handleFotograafManifest(request, env);
    if (url.pathname === "/fotograaf/lijst" && request.method === "GET") return handleFotograafLijst(request, env);
    if (url.pathname === "/fotograaf/verwijderen" && request.method === "POST") return handleFotograafVerwijderen(request, env);
    if (url.pathname === "/fotograaf/foto-delete" && request.method === "POST") return handleFotoVerwijderen(request, env);
    if (url.pathname === "/fotograaf/kleur" && request.method === "POST") return handleFotograafKleur(request, env);
    if (url.pathname.startsWith("/foto/fotografen/")) return handleFotoServe(request, env);
    return new Response("Zaans Licht Worker", { status: 200, headers: CORS_HEADERS });
  }
};
export {
  cloudflare_worker_default as default
};
//# sourceMappingURL=cloudflare-worker.js.map
