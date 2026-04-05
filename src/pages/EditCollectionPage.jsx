import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getFieldValue, normalizeField } from '../lib/collectionFields'
import Nav from '../components/Nav'
import styles from './NewCollectionPage.module.css'

const FIELD_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text / notes' },
  { value: 'number', label: 'Number' },
  { value: 'stars', label: 'Star rating (1-5)' },
  { value: 'date', label: 'Date' },
]

const EMOJIS = ['📓', '🏎️', '🎬', '🎵', '📚', '🍽️', '🏔️', '🎮', '🧪', '🌍', '🎨', '⚽', '🏀', '🎭', '✈️', '🏋️']

export default function EditCollectionPage({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('📓')
  const [fields, setFields] = useState([])

  useEffect(() => {
    fetchCollection()
  }, [id])

  const fetchCollection = async () => {
    const { data, error: fetchError } = await supabase
      .from('collections')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !data) {
      setError(fetchError?.message || 'Collection not found.')
      setLoading(false)
      return
    }

    setName(data.name || '')
    setDescription(data.description || '')
    setEmoji(data.emoji || '📓')
    setFields((data.fields || []).map((f, idx) => ({
      ...f,
      id: Date.now() + idx,
      originalName: f.name || '',
    })))
    setLoading(false)
  }

  const addField = () => {
    setFields(prev => [...prev, { id: Date.now(), name: '', type: 'text', aliases: [] }])
  }

  const updateField = (fieldId, key, value) => {
    setFields(prev => prev.map(f => (f.id === fieldId ? { ...f, [key]: value } : f)))
  }

  const removeField = (fieldId) => {
    setFields(prev => prev.filter(f => f.id !== fieldId))
  }

  const moveField = (fieldId, dir) => {
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === fieldId)
      const swap = idx + dir
      if (idx < 0 || swap < 0 || swap >= prev.length) return prev

      const next = [...prev]
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  const handleSave = async () => {
    if (!name.trim()) return setError('Give your collection a name.')
    if (fields.some(f => !f.name.trim())) return setError('All fields need a name.')

    const normalizedNames = fields.map(f => f.name.trim().toLowerCase())
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      return setError('Field names must be unique.')
    }

    setSaving(true)
    setError(null)

    const usedKeys = new Set()
    const normalizedFields = fields.map((field) => {
      const base = normalizeField(field, usedKeys)
      const nextName = base.name
      const prevName = String(field.originalName || '').trim()
      const aliases = [...base.aliases]

      if (prevName && prevName !== nextName && !aliases.includes(prevName)) {
        aliases.push(prevName)
      }

      return {
        ...base,
        aliases,
      }
    })

    const { error: updateError } = await supabase
      .from('collections')
      .update({
        name: name.trim(),
        description: description.trim(),
        emoji,
        fields: normalizedFields,
      })
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    const { data: entries, error: entriesError } = await supabase
      .from('entries')
      .select('id, data')
      .eq('collection_id', id)

    if (entriesError) {
      setError(entriesError.message)
      setSaving(false)
      return
    }

    const pendingUpdates = []

    for (const entry of entries || []) {
      const data = entry.data && typeof entry.data === 'object' ? { ...entry.data } : {}
      let changed = false

      for (const field of normalizedFields) {
        if (Object.prototype.hasOwnProperty.call(data, field.key)) continue

        const resolvedValue = getFieldValue(data, field)
        if (resolvedValue !== undefined) {
          data[field.key] = resolvedValue
          changed = true
        }
      }

      if (changed) pendingUpdates.push({ id: entry.id, data })
    }

    for (const update of pendingUpdates) {
      const { error: entryUpdateError } = await supabase
        .from('entries')
        .update({ data: update.data })
        .eq('id', update.id)

      if (entryUpdateError) {
        setError(entryUpdateError.message)
        setSaving(false)
        return
      }
    }

    navigate(`/collections/${id}`)
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <Nav session={session} />
        <main className={styles.main}>
          <p className={styles.fieldsHint}>Loading collection...</p>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Nav session={session} />
      <main className={styles.main}>
        <div className={styles.header}>
          <button className={styles.back} onClick={() => navigate(`/collections/${id}`)}>← Back to Collection</button>
          <h1 className={styles.title}>Edit Collection Schema</h1>
          <p className={styles.subtitle}>Update fields any time as your tracking needs evolve.</p>
        </div>

        <div className={styles.form}>
          <div className="field">
            <label>Icon</label>
            <div className={styles.emojiGrid}>
              {EMOJIS.map(e => (
                <button
                  key={e}
                  className={emoji === e ? styles.emojiActive : styles.emojiBtn}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Collection Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. F1 Races 2025" />
          </div>

          <div className="field">
            <label>Description (optional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this collection for?" />
          </div>

          <hr />

          <div className={styles.fieldsHeader}>
            <label style={{ margin: 0 }}>Fields</label>
            <button onClick={addField}>+ Add Field</button>
          </div>

          <p className={styles.fieldsHint}>
            Renames keep old values by migrating entry data to stable field keys.
          </p>

          {fields.length === 0 && (
            <div className={styles.emptyFields}>
              <p>No custom fields yet. Add some or keep it simple.</p>
            </div>
          )}

          {fields.map((field, idx) => (
            <div key={field.id} className={styles.fieldRow}>
              <div className={styles.fieldRowControls}>
                <div className={styles.moveButtons}>
                  <button onClick={() => moveField(field.id, -1)} disabled={idx === 0} className={styles.moveBtn}>↑</button>
                  <button onClick={() => moveField(field.id, 1)} disabled={idx === fields.length - 1} className={styles.moveBtn}>↓</button>
                </div>
                <div className={styles.fieldInputs}>
                  <input
                    value={field.name}
                    onChange={e => updateField(field.id, 'name', e.target.value)}
                    placeholder="Field name"
                  />
                  <select
                    value={field.type}
                    onChange={e => updateField(field.id, 'type', e.target.value)}
                  >
                    {FIELD_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <button className="danger" onClick={() => removeField(field.id)} style={{ padding: '0.5rem 0.7rem' }}>×</button>
              </div>
            </div>
          ))}

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