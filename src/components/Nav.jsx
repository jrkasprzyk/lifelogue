import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './Nav.module.css'

export default function Nav({ session }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <nav className={styles.nav}>
      <button className={styles.wordmark} onClick={() => navigate('/')}>
        LOGBOOK
      </button>
      <div className={styles.right}>
        <span className={styles.email}>{session?.user?.email}</span>
        <button onClick={handleLogout} className={styles.logout}>Sign Out</button>
      </div>
    </nav>
  )
}
