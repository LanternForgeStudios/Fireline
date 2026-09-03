import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Firebase web config is not a secret — it identifies the project, not an
// access credential. Actual access control lives in firestore.rules. Safe
// to check in and ship in the client bundle (this is Firebase's own
// documented guidance).
const firebaseConfig = {
  apiKey: 'AIzaSyATsdHhSID6aW8pdb5bv9NkeRkDW2cVjoc',
  authDomain: 'fireline-lf.firebaseapp.com',
  projectId: 'fireline-lf',
  storageBucket: 'fireline-lf.firebasestorage.app',
  messagingSenderId: '643236089836',
  appId: '1:643236089836:web:81b5e92d625b0096c53ac9',
  measurementId: 'G-CQN30RRKXG',
}

// reCAPTCHA v3 site keys are public by design (same trust level as the
// Firebase config above) — the secret half lives server-side in Firebase.
const RECAPTCHA_V3_SITE_KEY = '6Lfa0KUtAAAAACvIBnmtEwdKJqtztXa95LYKMQa0'

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)

// In dev, App Check would otherwise reject every request from localhost.
// Setting this before initializeAppCheck makes the SDK log an unregistered
// debug token to the console on first run — register it once in Firebase
// Console -> App Check -> Manage debug tokens and local dev keeps working
// even after enforcement is turned on for Firestore/Auth.
if (import.meta.env.DEV) {
  ;(self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN = true
}

initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaV3Provider(RECAPTCHA_V3_SITE_KEY),
  isTokenAutoRefreshEnabled: true,
})
