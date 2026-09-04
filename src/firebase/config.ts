import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'

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

// reCAPTCHA Enterprise site keys are public by design (same trust level as
// the Firebase config above) — the secret half lives server-side in Firebase.
// This must be the key registered against this app under Firebase Console ->
// App Check -> Apps (reCAPTCHA Enterprise, not the deprecated v3 provider) —
// a mismatch between the provider class and what's registered in Console
// fails App Check token exchange with "App not registered", which silently
// breaks every App-Check-enforced Cloud Function call (submitMissionResult,
// resetProgress, purchaseUpgrade).
const RECAPTCHA_ENTERPRISE_SITE_KEY = '6Lfa0KUtAAAAACvIBnmtEwdKJqtztXa95LYKMQa0'

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
export const functions = getFunctions(firebaseApp)

// `npm run dev` talks to the Local Emulator Suite (`firebase emulators:start`,
// or `npm run emulators`) instead of the live `fireline-lf` project — the
// production build (import.meta.env.DEV is false) always talks to the real
// backend. This is what makes it safe to test things like App Check
// enforcement locally without risking the live app: flip enforcement in
// prod only after it's been exercised end-to-end against the emulators.
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8180)
  connectFunctionsEmulator(functions, '127.0.0.1', 5101)
}

// In dev, App Check would otherwise reject every request from localhost.
// Setting this before initializeAppCheck makes the SDK log an unregistered
// debug token to the console on first run — register it once in Firebase
// Console -> App Check -> Manage debug tokens and local dev keeps working
// even after enforcement is turned on for Firestore/Auth. Needed even
// against the emulators: App Check token *generation* still goes through
// the real reCAPTCHA service (there's no local emulator for that part).
if (import.meta.env.DEV) {
  ;(self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN = true
}

initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
  isTokenAutoRefreshEnabled: true,
})
