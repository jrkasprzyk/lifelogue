import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getFieldValue } from '../lib/collectionFields'
import Nav from '../components/Nav'
import styles from './CollectionPage.module.css'

function StarDisplay({ value }) {
  return (
    <span className={styles.stars}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ color: n <= value ? 'var(--accent)' : 'var(--text-dim)' }}>★</span>
      ))}
    </span>
  )
}

export default function CollectionPage({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [collection, setCollection] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    const [colResult, entriesResult] = await Promise.all([
      supabase.from('collections').select('*').eq('id', id).single(),
      supabase.from('entries').select('*').eq('collection_id', id).order('created_at', { ascending: false })
    ])
    if (colResult.data) setCollection(colResult.data)
    if (entriesResult.data) setEntries(entriesResult.data)
    setLoading(false)
  }

  const deleteEntry = async (entryId, e) => {
    e.stopPropagation()
    if (!confirm('Delete this entry?')) return
    await supabase.from('entries').delete().eq('id', entryId)
    setEntries(prev => prev.filter(e => e.id !== entryId))
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <Nav session={session} />
        <main className={styles.main}><p className={styles.loading}>Loading...</p></main>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className={styles.page}>
        <Nav session={session} />
        <main className={styles.main}><p>Collection not found.</p></main>
      </div>
    )
  }

  const starField = (collection.fields || []).find(f => f.type === 'stars')

  return (
    <div className={styles.page}>
      <Nav session={session} />
      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.back} onClick={() => navigate('/')}>← Collections</button>
            <div className={styles.titleRow}>
              <span className={styles.emoji}>{collection.emoji}</span>
              <h1 className={styles.title}>{collection.name}</h1>
            </div>
            {collection.description && (
              <p className={styles.desc}>{collection.description}</p>
            )}
          </div>
          <div className={styles.headerActions}>
            <button onClick={() => navigate(`/collections/${id}/edit`)}>
              Edit Schema
            </button>
            <button className="primary" onClick={() => navigate(`/collections/${id}/entries/new`)}>
              + New Entry
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No entries yet.</p>
            <p className={styles.emptyDesc}>Log your first one.</p>
            <button className="primary" onClick={() => navigate(`/collections/${id}/entries/new`)}>
              Add Entry
            </button>
          </div>
        ) : (
          <div className={styles.entries}>
            {entries.map((entry, i) => {
              const isExpanded = expandedId === entry.id
              return (
                <div
                  key={entry.id}
                  className={`${styles.entry} ${isExpanded ? styles.expanded : ''}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div
                    className={styles.entryHeader}
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <div className={styles.entryMeta}>
                      <span className={styles.entryDate}>
                        {new Date(entry.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </span>
                      {starField && Number(getFieldValue(entry.data, starField)) > 0 && (
                        <StarDisplay value={parseInt(getFieldValue(entry.data, starField), 10)} />
                      )}
                    </div>
                    <div className={styles.entryTitleRow}>
                      <h2 className={styles.entryTitle}>{entry.title}</h2>
                      <div className={styles.entryActions}>
                        <span className={styles.toggle}>{isExpanded ? '↑' : '↓'}</span>
                        <button
                          className={`${styles.deleteBtn} danger`}
                          onClick={(e) => deleteEntry(entry.id, e)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className={styles.entryBody}>
                      {collection.fields.map(field => {
                        const value = getFieldValue(entry.data, field)
                        if (!value && value !== 0) return null
                        return (
                          <div key={field.key || field.name} className={styles.fieldDisplay}>
                            <span className={styles.fieldLabel}>{field.name}</span>
                            {field.type === 'stars' ? (
                              <StarDisplay value={parseInt(value)} />
                            ) : field.type === 'textarea' ? (
                              <p className={styles.fieldText}>{value}</p>
                            ) : (
                              <span className={styles.fieldValue}>{value}</span>
                            )}
                          </div>
                        )
                      })}
                      {entry.notes && (
                        <div className={styles.fieldDisplay}>
                          <span className={styles.fieldLabel}>Notes</span>
                          <p className={styles.fieldText}>{entry.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
