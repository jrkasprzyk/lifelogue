import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import styles from './NewCollectionPage.module.css'

const FIELD_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text / notes' },
  { value: 'number', label: 'Number' },
  { value: 'stars', label: 'Star rating (1–5)' },
  { value: 'date', label: 'Date' },
]

const EMOJIS = ['📓','🏎️','🎬','🎵','📚','🍽️','🏔️','🎮','🧪','🌍','🎨','⚽','🏀','🎭','✈️','🏋️']

const STARTER_TEMPLATES = [
  {
    name: 'F1 / IndyCar Races',
    emoji: '🏎️',
    description: 'Race-by-race log with hot takes',
    fields: [
      { name: 'Series', type: 'text' },
      { name: 'Circuit', type: 'text' },
      { name: 'Race Date', type: 'date' },
      { name: 'P1', type: 'text' },
      { name: 'P2', type: 'text' },
      { name: 'P3', type: 'text' },
      { name: 'Hot Take', type: 'textarea' },
      { name: 'Race Rating', type: 'stars' },
    ]
  },
  {
    name: 'Movies',
    emoji: '🎬',
    description: 'Films watched with ratings and thoughts',
    fields: [
      { name: 'Director', type: 'text' },
      { name: 'Year', type: 'number' },
      { name: 'Where Watched', type: 'text' },
      { name: 'Rating', type: 'stars' },
      { name: 'Thoughts', type: 'textarea' },
    ]
  },
  {
    name: 'Albums',
    emoji: '🎵',
    description: 'Music log with hot takes',
    fields: [
      { name: 'Artist', type: 'text' },
      { name: 'Year', type: 'number' },
      { name: 'Genre', type: 'text' },
      { name: 'Rating', type: 'stars' },
      { name: 'Notes', type: 'textarea' },
    ]
  },
  {
    name: 'Books',
    emoji: '📚',
    description: 'Reading log',
    fields: [
      { name: 'Author', type: 'text' },
      { name: 'Year Published', type: 'number' },
      { name: 'Date Finished', type: 'date' },
      { name: 'Rating', type: 'stars' },
      { name: 'Notes', type: 'textarea' },
    ]
  },
  {
    name: 'Custom',
    emoji: '📓',
    description: 'Start from scratch',
    fields: []
  }
]

export default function NewCollectionPage({ session }) {
  const navigate = useNavigate()
  const [step, setStep] = useState('template') // 'template' | 'configure'
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('📓')
  const [fields, setFields] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const applyTemplate = (template) => {
    setName(template.name === 'Custom' ? '' : template.name)
    setEmoji(template.emoji)
    setDescription(template.description === 'Start from scratch' ? '' : template.description)
    setFields(template.fields.map((f, i) => ({ ...f, id: i })))
    setStep('configure')
  }

  const addField = () => {
    setFields(prev => [...prev, { id: Date.now(), name: '', type: 'text' }])
  }

  const updateField = (id, key, value) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, [key]: value } : f))
  }

  const removeField = (id) => {
    setFields(prev => prev.filter(f => f.id !== id))
  }

  const moveField = (id, dir) => {
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === id)
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  const handleSave = async () => {
    if (!name.trim()) return setError('Give your collection a name.')
    if (fields.some(f => !f.name.trim())) return setError('All fields need a name.')
    setSaving(true)
    setError(null)

    const { data, error: err } = await supabase.from('collections').insert({
      user_id: session.user.id,
      name: name.trim(),
      description: description.trim(),
      emoji,
      fields: fields.map(({ id, ...f }) => f), // strip local id before saving
    }).select().single()

    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      navigate(`/collections/${data.id}`)
    }
  }

  if (step === 'template') {
    return (
      <div className={styles.page}>
        <Nav session={session} />
        <main className={styles.main}>
          <div className={styles.header}>
            <button className={styles.back} onClick={() => navigate('/')}>← Back</button>
            <h1 className={styles.title}>New Collection</h1>
            <p className={styles.subtitle}>Start with a template or build your own.</p>
          </div>
          <div className={styles.templateGrid}>
            {STARTER_TEMPLATES.map(t => (
              <div key={t.name} className={styles.templateCard} onClick={() => applyTemplate(t)}>
                <span className={styles.templateEmoji}>{t.emoji}</span>
                <h3 className={styles.templateName}>{t.name}</h3>
                <p className={styles.templateDesc}>{t.description}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Nav session={session} />
      <main className={styles.main}>
        <div className={styles.header}>
          <button className={styles.back} onClick={() => setStep('template')}>← Templates</button>
          <h1 className={styles.title}>Configure Collection</h1>
          <p className={styles.subtitle}>Define what you want to track.</p>
        </div>

        <div className={styles.form}>
          {/* Emoji picker */}
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
            Every entry will have a title and date automatically. Add custom fields below.
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
            <button onClick={() => navigate('/')}>Cancel</button>
            <button className="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Create Collection →'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
