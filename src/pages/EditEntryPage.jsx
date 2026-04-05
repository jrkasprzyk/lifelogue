import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getFieldValue } from '../lib/collectionFields'
import Nav from '../components/Nav'
import styles from './NewEntryPage.module.css'

function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(null)
  const display = hovered ?? value

  return (
    <div className={styles.starPicker}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={styles.starBtn}
          style={{ color: n <= display ? 'var(--accent)' : 'var(--text-dim)' }}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onChange(n === value ? 0 : n)}
        >
          ★
        </button>
      ))}
      {value > 0 && (
        <span className={styles.starLabel}>{value}/5</span>
      )}
    </div>
  )
}

export default function EditEntryPage({ session }) {
  const { id, entryId } = useParams()
  const navigate = useNavigate()

  const [collection, setCollection] = useState(null)
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [title, setTitle] = useState('')
  const [fieldValues, setFieldValues] = useState({})

  useEffect(() => {
    fetchData()
  }, [id, entryId])

  const fetchData = async () => {
    const [collectionResult, entryResult] = await Promise.all([
      supabase.from('collections').select('*').eq('id', id).single(),
      supabase.from('entries').select('*').eq('id', entryId).eq('collection_id', id).single(),
    ])

    if (!collectionResult.data || !entryResult.data) {
      setLoading(false)
      return
    }

    const collectionData = collectionResult.data
    const entryData = entryResult.data

    setCollection(collectionData)
    setEntry(entryData)
    setTitle(entryData.title || '')

    const initial = {}
    ;(collectionData.fields || []).forEach(field => {
      const fieldKey = field.key || field.name
      const value = getFieldValue(entryData.data, field)
      initial[fieldKey] = value ?? (field.type === 'stars' ? 0 : '')
    })
    setFieldValues(initial)
    setLoading(false)
  }

  const setField = (fieldKey, value) => {
    setFieldValues(prev => ({ ...prev, [fieldKey]: value }))
  }

  const handleSave = async () => {
    if (!title.trim()) return setError('Every entry needs a title.')

    setSaving(true)
    setError(null)

    const cleanData = {}
    Object.entries(fieldValues).forEach(([key, value]) => {
      if (value !== '' && value !== 0) cleanData[key] = value
    })

    const { error: updateError } = await supabase
      .from('entries')
      .update({
        title: title.trim(),
        data: cleanData,
      })
      .eq('id', entryId)
      .eq('collection_id', id)
      .eq('user_id', session.user.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    navigate(`/collections/${id}`)
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <Nav session={session} />
        <main className={styles.main}>
          <p className={styles.loading}>Loading...</p>
        </main>
      </div>
    )
  }

  if (!collection || !entry) {
    return (
      <div className={styles.page}>
        <Nav session={session} />
        <main className={styles.main}><p>Entry not found.</p></main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Nav session={session} />
      <main className={styles.main}>
        <div className={styles.header}>
          <button className={styles.back} onClick={() => navigate(`/collections/${id}`)}>
            ← {collection.emoji} {collection.name}
          </button>
          <h1 className={styles.title}>Edit Entry</h1>
          <p className={styles.subtitle}>Update this entry and keep your log accurate.</p>
        </div>

        <div className={styles.form}>
          <div className={`field ${styles.titleField}`}>
            <label>Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Give this entry a title..."
              autoFocus
              className={styles.titleInput}
            />
          </div>

          {(collection.fields || []).length > 0 && <hr />}

          {(collection.fields || []).map(field => {
            const fieldKey = field.key || field.name
            return (
              <div key={fieldKey} className="field">
                <label>{field.name}</label>
                <FieldInput
                  field={field}
                  value={fieldValues[fieldKey] ?? (field.type === 'stars' ? 0 : '')}
                  onChange={value => setField(fieldKey, value)}
                  styles={styles}
                />
              </div>
            )
          })}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button onClick={() => navigate(`/collections/${id}`)}>Cancel</button>
            <button className="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes →'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function FieldInput({ field, value, onChange, styles }) {
  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={`Enter ${field.name.toLowerCase()}...`}
          rows={4}
          className={styles.textarea}
        />
      )
    case 'stars':
      return <StarPicker value={value} onChange={onChange} />
    case 'number':
      return (
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
        />
      )
    case 'date':
      return (
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      )
    default:
      return (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={`Enter ${field.name.toLowerCase()}...`}
        />
      )
  }
}