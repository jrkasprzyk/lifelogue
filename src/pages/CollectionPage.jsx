import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buildAppUrl } from '../lib/appRoutes'
import { buildMigratedData, getFieldMatch, getFieldValue } from '../lib/collectionFields'
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
  const [showMapper, setShowMapper] = useState(false)
  const [mapping, setMapping] = useState({})
  const [promoting, setPromoting] = useState(false)
  const [mapperMessage, setMapperMessage] = useState(null)
  const [mapperError, setMapperError] = useState(null)
  const [shareMessage, setShareMessage] = useState(null)
  const [shareError, setShareError] = useState(null)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    const [colResult, entriesResult] = await Promise.all([
      supabase.from('collections').select('*').eq('id', id).single(),
      supabase.from('entries').select('*').eq('collection_id', id).order('created_at', { ascending: false })
    ])

    const collectionData = colResult.data
    const entriesData = entriesResult.data || []

    if (collectionData) {
      setCollection(collectionData)
    }

    if (collectionData && entriesData.length > 0) {
      const fields = collectionData.fields || []
      const updatedEntries = [...entriesData]

      for (let i = 0; i < updatedEntries.length; i += 1) {
        const entry = updatedEntries[i]
        const { data: migratedData, changed } = buildMigratedData(entry.data, fields)
        if (!changed) continue

        updatedEntries[i] = { ...entry, data: migratedData }
        // Best-effort backfill so old renamed keys keep working permanently.
        await supabase.from('entries').update({ data: migratedData }).eq('id', entry.id)
      }

      setEntries(updatedEntries)
    } else {
      setEntries(entriesData)
    }

    setLoading(false)
  }

  const deleteEntry = async (entryId, e) => {
    e.stopPropagation()
    if (!confirm('Delete this entry?')) return
    await supabase.from('entries').delete().eq('id', entryId)
    setEntries(prev => prev.filter(e => e.id !== entryId))
  }

  const legacyKeyStats = useMemo(() => {
    if (!collection) return []

    const counts = {}
    const fields = collection.fields || []

    for (const entry of entries) {
      const data = entry.data && typeof entry.data === 'object' ? entry.data : {}
      const matchedKeys = new Set()

      for (const field of fields) {
        const match = getFieldMatch(data, field)
        if (match?.key) matchedKeys.add(match.key)
      }

      for (const key of Object.keys(data)) {
        if (!matchedKeys.has(key)) {
          counts[key] = (counts[key] || 0) + 1
        }
      }
    }

    return Object.entries(counts)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  }, [collection, entries])

  const handleMappingChange = (legacyKey, targetKey) => {
    setMapping(prev => ({ ...prev, [legacyKey]: targetKey }))
  }

  const applyLegacyMappings = async () => {
    if (!collection) return

    const selectedMappings = Object.entries(mapping).filter(([, target]) => target)
    if (selectedMappings.length === 0) {
      setMapperError('Pick at least one mapping before applying.')
      return
    }

    setPromoting(true)
    setMapperError(null)
    setMapperMessage(null)

    const updatedEntries = [...entries]
    let updatedCount = 0
    let conflictCount = 0

    for (let i = 0; i < updatedEntries.length; i += 1) {
      const entry = updatedEntries[i]
      const data = entry.data && typeof entry.data === 'object' ? { ...entry.data } : {}
      let changed = false

      for (const [legacyKey, targetKey] of selectedMappings) {
        if (!Object.prototype.hasOwnProperty.call(data, legacyKey)) continue

        const legacyValue = data[legacyKey]
        const hasTarget = Object.prototype.hasOwnProperty.call(data, targetKey)

        if (!hasTarget) {
          data[targetKey] = legacyValue
          delete data[legacyKey]
          changed = true
          continue
        }

        if (data[targetKey] === legacyValue) {
          delete data[legacyKey]
          changed = true
        } else {
          conflictCount += 1
        }
      }

      if (!changed) continue

      const { error: updateError } = await supabase
        .from('entries')
        .update({ data })
        .eq('id', entry.id)

      if (updateError) {
        setMapperError(updateError.message)
        setPromoting(false)
        return
      }

      updatedEntries[i] = { ...entry, data }
      updatedCount += 1
    }

    setEntries(updatedEntries)
    setMapperMessage(`Updated ${updatedCount} entr${updatedCount === 1 ? 'y' : 'ies'}${conflictCount ? `, skipped ${conflictCount} conflict${conflictCount === 1 ? '' : 's'}` : ''}.`)
    setPromoting(false)
  }

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  const ensureShareCode = async () => {
    if (!collection) return null
    if (collection.share_code) return collection.share_code

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const nextCode = generateInviteCode()
      const { error: updateError } = await supabase
        .from('collections')
        .update({ share_code: nextCode })
        .eq('id', collection.id)
        .eq('user_id', session.user.id)

      if (!updateError) {
        setCollection(prev => ({ ...prev, share_code: nextCode }))
        return nextCode
      }

      if (updateError.code !== '23505') {
        setShareError(updateError.message)
        return null
      }
    }

    setShareError('Could not generate a unique invite code. Try again.')
    return null
  }

  const copyInviteLink = async () => {
    const code = await ensureShareCode()
    if (!code) return

    const link = buildAppUrl(`/join/${collection.id}/${code}`)
    try {
      await navigator.clipboard.writeText(link)
      setShareMessage('Invite link copied.')
      setShareError(null)
    } catch {
      setShareError('Could not copy automatically. You can copy the link manually below.')
    }
  }

  const rotateInviteCode = async () => {
    if (!collection) return
    setShareMessage(null)
    setShareError(null)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const nextCode = generateInviteCode()
      const { error: updateError } = await supabase
        .from('collections')
        .update({ share_code: nextCode })
        .eq('id', collection.id)
        .eq('user_id', session.user.id)

      if (!updateError) {
        setCollection(prev => ({ ...prev, share_code: nextCode }))
        setShareMessage('Invite code regenerated.')
        return
      }

      if (updateError.code !== '23505') {
        setShareError(updateError.message)
        return
      }
    }

    setShareError('Could not regenerate invite code right now.')
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
  const isOwner = collection.user_id === session.user.id
  const shareLink = collection.share_code
    ? buildAppUrl(`/join/${collection.id}/${collection.share_code}`)
    : ''

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
            {isOwner && (
              <button onClick={() => navigate(`/collections/${id}/edit`)}>
                Edit Schema
              </button>
            )}
            <button className="primary" onClick={() => navigate(`/collections/${id}/entries/new`)}>
              + New Entry
            </button>
          </div>
        </div>

        {isOwner && (
          <div className={styles.shareCard}>
            <div className={styles.shareHeader}>
              <div>
                <p className={styles.shareTitle}>Share Collection</p>
                <p className={styles.shareSubtitle}>Invite others with this link so they can access and edit entries.</p>
              </div>
              <div className={styles.shareActions}>
                <button onClick={copyInviteLink}>Copy Invite Link</button>
                <button onClick={rotateInviteCode}>Regenerate Code</button>
              </div>
            </div>

            {shareLink && <p className={styles.shareLink}>{shareLink}</p>}
            {shareError && <p className={styles.mapperError}>{shareError}</p>}
            {shareMessage && <p className={styles.mapperMessage}>{shareMessage}</p>}
          </div>
        )}

        {legacyKeyStats.length > 0 && (
          <div className={styles.mapperCard}>
            <div className={styles.mapperHeader}>
              <div>
                <p className={styles.mapperTitle}>Legacy fields detected</p>
                <p className={styles.mapperSubtitle}>Choose how old keys should map to your current schema.</p>
              </div>
              <button onClick={() => setShowMapper(prev => !prev)}>
                {showMapper ? 'Hide Mapper' : 'Map Legacy Fields'}
              </button>
            </div>

            {showMapper && (
              <div className={styles.mapperBody}>
                {legacyKeyStats.map(item => (
                  <div key={item.key} className={styles.mapperRow}>
                    <div className={styles.mapperLegacy}>
                      <span className={styles.mapperKey}>{item.key}</span>
                      <span className={styles.mapperCount}>{item.count} entr{item.count === 1 ? 'y' : 'ies'}</span>
                    </div>
                    <select
                      value={mapping[item.key] || ''}
                      onChange={(e) => handleMappingChange(item.key, e.target.value)}
                    >
                      <option value="">Do not map</option>
                      {collection.fields.map(field => (
                        <option key={field.key || field.name} value={field.key || field.name}>
                          {field.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

                {mapperError && <p className={styles.mapperError}>{mapperError}</p>}
                {mapperMessage && <p className={styles.mapperMessage}>{mapperMessage}</p>}

                <div className={styles.mapperActions}>
                  <button onClick={() => setShowMapper(false)}>Close</button>
                  <button className="primary" onClick={applyLegacyMappings} disabled={promoting}>
                    {promoting ? 'Applying...' : 'Apply Mapping'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
                          className={styles.editBtn}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/collections/${id}/entries/${entry.id}/edit`)
                          }}
                        >
                          Edit
                        </button>
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
                      {(() => {
                        const matchedKeys = new Set()

                        const mappedFields = collection.fields.map(field => {
                          const match = getFieldMatch(entry.data, field)
                          const value = match?.value
                          if (match?.key) matchedKeys.add(match.key)
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
                        })

                        const legacyFields = Object.entries(entry.data || {}).map(([key, value]) => {
                          if (matchedKeys.has(key)) return null
                          if (!value && value !== 0) return null

                          return (
                            <div key={`legacy-${entry.id}-${key}`} className={styles.fieldDisplay}>
                              <span className={styles.fieldLabel}>{key} (legacy)</span>
                              <span className={styles.fieldValue}>{String(value)}</span>
                            </div>
                          )
                        })

                        return [...mappedFields, ...legacyFields]
                      })()}
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
