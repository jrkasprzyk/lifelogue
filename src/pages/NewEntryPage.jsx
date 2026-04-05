import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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

export default function NewEntryPage({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [collection, setCollection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Entry state
  const [title, setTitle] = useState('')
  const [fieldValues, setFieldValues] = useState({})

  useEffect(() => {
    fetchCollection()
  }, [id])

  const fetchCollection = async () => {
    const { data } = await supabase
      .from('collections')
      .select('*')
      .eq('id', id)
      .single()

    if (data) {
      setCollection(data)
      // Initialize all fields to empty strings (stars to 0)
      const initial = {}
      ;(data.fields || []).forEach(f => {
        const fieldKey = f.key || f.name
        initial[fieldKey] = f.type === 'stars' ? 0 : ''
      })
      setFieldValues(initial)
    }
    setLoading(false)
  }

  const setField = (name, value) => {
    setFieldValues(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    if (!title.trim()) return setError('Every entry needs a title.')
    setSaving(true)
    setError(null)

    // Strip empty values before saving — no point storing blanks
    const cleanData = {}
    Object.entries(fieldValues).forEach(([k, v]) => {
      if (v !== '' && v !== 0) cleanData[k] = v
    })

    const { error: err } = await supabase.from('entries').insert({
      collection_id: id,
      user_id: session.user.id,
      title: title.trim(),
      data: cleanData,
    })

    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      navigate(`/collections/${id}`)
    }
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

  if (!collection) {
    return (
      <div className={styles.page}>
        <Nav session={session} />
        <main className={styles.main}><p>Collection not found.</p></main>
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
          <h1 className={styles.title}>New Entry</h1>
          <p className={styles.subtitle}>Log something worth remembering.</p>
        </div>

        <div className={styles.form}>
          {/* Title is always first */}
          <div className={`field ${styles.titleField}`}>
            <label>Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={getTitlePlaceholder(collection.name)}
              autoFocus
              className={styles.titleInput}
            />
          </div>

          {collection.fields.length > 0 && <hr />}

          {/* Dynamic fields */}
          {collection.fields.map(field => {
            const fieldKey = field.key || field.name
            return (
            <div key={fieldKey} className="field">
              <label>{field.name}</label>
              <FieldInput
                field={field}
                value={fieldValues[fieldKey] ?? (field.type === 'stars' ? 0 : '')}
                onChange={val => setField(fieldKey, val)}
                styles={styles}
              />
            </div>
            )
          })}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button onClick={() => navigate(`/collections/${id}`)}>Cancel</button>
            <button className="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Entry →'}
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
    default: // text
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

function getTitlePlaceholder(collectionName) {
  const name = collectionName.toLowerCase()
  if (name.includes('race') || name.includes('f1') || name.includes('indycar')) return 'e.g. Monaco Grand Prix'
  if (name.includes('movie') || name.includes('film')) return 'e.g. No Country for Old Men'
  if (name.includes('album') || name.includes('music')) return 'e.g. Nebraska — Bruce Springsteen'
  if (name.includes('book')) return 'e.g. Deliver Me from Nowhere'
  return 'Give this entry a title...'
}
