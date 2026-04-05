import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import styles from './DashboardPage.module.css'

export default function DashboardPage({ session }) {
  const navigate = useNavigate()
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCollections()
  }, [])

  const fetchCollections = async () => {
    const { data, error } = await supabase
      .from('collections')
      .select('*, entries(count)')
      .order('created_at', { ascending: false })

    if (!error) setCollections(data || [])
    setLoading(false)
  }

  const deleteCollection = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Delete this collection and all its entries?')) return
    await supabase.from('collections').delete().eq('id', id)
    setCollections(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className={styles.page}>
      <Nav session={session} />
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Your Collections</h1>
            <p className={styles.subtitle}>What are you keeping track of?</p>
          </div>
          <button className="primary" onClick={() => navigate('/collections/new')}>
            + New Collection
          </button>
        </div>

        {loading ? (
          <p className={styles.empty}>Loading...</p>
        ) : collections.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>The pages are blank.</p>
            <p className={styles.emptyDesc}>Create your first collection to start logging.</p>
            <button className="primary" onClick={() => navigate('/collections/new')}>
              Start a Collection
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {collections.map((col, i) => {
              const isOwner = col.user_id === session.user.id

              return (
                <div
                  key={col.id}
                  className={styles.card}
                  onClick={() => navigate(`/collections/${col.id}`)}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.emoji}>{col.emoji || '📓'}</span>
                    {isOwner ? (
                      <button
                        className={`${styles.deleteBtn} danger`}
                        onClick={(e) => deleteCollection(col.id, e)}
                        title="Delete collection"
                      >
                        ×
                      </button>
                    ) : (
                      <span className={styles.sharedPill}>Shared</span>
                    )}
                  </div>
                  <h2 className={styles.cardTitle}>{col.name}</h2>
                  {col.description && (
                    <p className={styles.cardDesc}>{col.description}</p>
                  )}
                  <div className={styles.cardMeta}>
                    <span className={styles.count}>
                      {col.entries?.[0]?.count ?? 0} entries
                    </span>
                    <span className={styles.date}>
                      {new Date(col.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
