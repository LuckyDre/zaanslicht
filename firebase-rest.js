// firebase-rest.js — plain REST-toegang tot Firebase Realtime Database
// Vervangt db.ref(...).once('value') / .transaction(...) op pagina's die alleen
// losse likes/comments-reads en -writes nodig hebben (geen live listeners).
//
// Waarom: de Firebase JS SDK zet voor .once()/.transaction() een long-polling
// verbinding op (.../.lp). Die verbinding kreeg op de live site continu HTTP 503
// (vermoedelijk geblokkeerd door adblock/privacy-extensies) en resolvede nooit,
// waardoor likes nooit écht werden opgeslagen of gesorteerd. Gewone REST-calls
// naar dezelfde database (…/pad.json) werken wel gewoon.

const FIREBASE_DB_URL = 'https://zaanslicht-0001-default-rtdb.europe-west1.firebasedatabase.app';

async function fbGet(path, query = '') {
  try {
    const res = await fetch(`${FIREBASE_DB_URL}/${path}.json${query}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fbSet(path, value) {
  try {
    const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Niet atomair (geen server-side transactie via REST), maar voor het aantal
// gelijktijdige likes op deze site ruim voldoende betrouwbaar.
async function fbIncrement(path, delta) {
  const current = (await fbGet(path)) || 0;
  const next = Math.max(0, current + delta);
  await fbSet(path, next);
  return next;
}

async function fbDelete(path) {
  try {
    const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}
