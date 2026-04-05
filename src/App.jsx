import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import CollectionPage from './pages/CollectionPage'
import NewCollectionPage from './pages/NewCollectionPage'
import NewEntryPage from './pages/NewEntryPage'
import EditCollectionPage from './pages/EditCollectionPage'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
          LOADING...
        </span>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/auth"
        element={!session ? <AuthPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/"
        element={session ? <DashboardPage session={session} /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/collections/new"
        element={session ? <NewCollectionPage session={session} /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/collections/:id"
        element={session ? <CollectionPage session={session} /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/collections/:id/entries/new"
        element={session ? <NewEntryPage session={session} /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/collections/:id/edit"
        element={session ? <EditCollectionPage session={session} /> : <Navigate to="/auth" replace />}
      />
    </Routes>
  )
}
