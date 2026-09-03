import { useState, type FormEvent } from 'react'
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from '../firebase/auth'

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account already exists for that email — try signing in instead.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/invalid-email':
      return 'That email address looks invalid.'
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was closed before completing.'
    default:
      return 'Something went wrong signing in. Please try again.'
  }
}

export function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleGoogle = async () => {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password)
      } else {
        await signInWithEmail(email, password)
      }
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen menu-screen">
      <div className="menu-content">
        <h1 className="title">FIRELINE</h1>
        <p className="subtitle">Helicopter Gunner</p>
        <p className="menu-blurb">Sign in to save your progression and get in the fight.</p>

        <button className="btn btn-primary" onClick={handleGoogle} disabled={busy}>
          Continue with Google
        </button>

        <div className="login-divider">or</div>

        <form className="login-form" onSubmit={handleEmailSubmit}>
          <input
            className="login-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={6}
            required
          />
          {error && <p className="login-error">{error}</p>}
          <button className="btn btn-secondary" type="submit" disabled={busy}>
            {mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button
          className="login-toggle"
          onClick={() => {
            setMode(mode === 'signup' ? 'signin' : 'signup')
            setError(null)
          }}
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : "Need an account? Create one"}
        </button>
      </div>
    </div>
  )
}
