// ── Firebase configuratie voor Zaans Licht ─────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCZaZmZ2GqLk7VmqGtdOdsICfY21V_Sbc0",
  authDomain:        "zaanslicht-0001.firebaseapp.com",
  databaseURL:       "https://zaanslicht-0001-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "zaanslicht-0001",
  storageBucket:     "zaanslicht-0001.firebasestorage.app",
  messagingSenderId: "361049638000",
  appId:             "1:361049638000:web:e909e888d10f1e6be3a0b5"
};

if (!firebase.apps || !firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}
var db = firebase.database();
