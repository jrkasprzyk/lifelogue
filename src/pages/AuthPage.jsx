import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './AuthPage.module.css'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account.')
    }

    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.rule} />
          <h1 className={styles.title}>LIFELOGUE</h1>
          <p className={styles.subtitle}>A journal for things worth remembering.</p>
          <div className={styles.rule} />
        </div>

        <div className={styles.form}>
          <div className={styles.modeTabs}>
            <button
              className={mode === 'login' ? styles.activeTab : styles.tab}
              onClick={() => setMode('login')}
            >
              Sign In
            </button>
            <button
              className={mode === 'signup' ? styles.activeTab : styles.tab}
              onClick={() => setMode('signup')}
            >
              Create Account
            </button>
          </div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="you@example.com"
              autoFocus
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="••••••••"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.success}>{message}</p>}

          <button className="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Working...' : mode === 'login' ? 'Enter' : 'Create Account'}
          </button>
        </div>

        <p className={styles.footer}>
          Your entries. Your opinions. Nobody else's business.
        </p>
      </div>
    </div>
  )
}
