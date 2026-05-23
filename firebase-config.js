// ── Firebase configuratie voor Zaans Licht ─────────────────────────────────
// Vul hieronder jouw Firebase config in (te vinden in Project settings → Your apps)
// Deze waarden zijn veilig om te publiceren — beveiliging loopt via Firebase Rules.

const FIREBASE_CONFIG = {
  apiKey:            "JOUW_API_KEY",
  authDomain:        "JOUW_PROJECT.firebaseapp.com",
  databaseURL:       "https://JOUW_PROJECT-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "JOUW_PROJECT",
  storageBucket:     "JOUW_PROJECT.appspot.com",
  messagingSenderId: "JOUW_SENDER_ID",
  appId:             "JOUW_APP_ID"
};

// Initialiseer Firebase (één keer voor de hele site)
if (!firebase.apps || !firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}
const db = firebase.database();
