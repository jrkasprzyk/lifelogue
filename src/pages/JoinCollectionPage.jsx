import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import styles from './NewEntryPage.module.css'

export default function JoinCollectionPage({ session }) {
  const { collectionId, code } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('joining')
  const [message, setMessage] = useState('Joining collection...')

  useEffect(() => {
    joinCollection()
  }, [collectionId, code])

  const joinCollection = async () => {
    const payload = {
      collection_id: collectionId,
      user_id: session.user.id,
      invite_code: code,
    }

    const { error } = await supabase.from('collection_memberships').insert(payload)

    // If the user is already a member, treat it as success.
    if (error && error.code !== '23505') {
      setStatus('error')
      setMessage('This invite is invalid, expired, or you do not have access.')
      return
    }

    setStatus('success')
    setMessage('Joined successfully. Redirecting...')
    setTimeout(() => navigate(`/collections/${collectionId}`), 500)
  }

  return (
    <div className={styles.page}>
      <Nav session={session} />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Join Collection</h1>
          <p className={styles.subtitle}>{message}</p>
        </div>

        <div className={styles.form}>
          {status === 'error' ? (
            <>
              <p className={styles.error}>Could not join this collection.</p>
              <div className={styles.actions}>
                <button onClick={() => navigate('/')}>Back to Dashboard</button>
              </div>
            </>
          ) : (
            <p className={styles.loading}>Please wait...</p>
          )}
        </div>
      </main>
    </div>
  )
}
