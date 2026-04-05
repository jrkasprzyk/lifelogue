function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export function toFieldKey(name) {
  const base = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return base || 'field'
}

export function toUniqueFieldKey(name, usedKeys) {
  const root = toFieldKey(name)
  let key = root
  let n = 2

  while (usedKeys.has(key)) {
    key = `${root}_${n}`
    n += 1
  }

  usedKeys.add(key)
  return key
}

export function normalizeField(field, usedKeys) {
  const name = String(field?.name || '').trim()
  const aliases = Array.isArray(field?.aliases)
    ? [...new Set(field.aliases.map(a => String(a || '').trim()).filter(Boolean))]
    : []

  const rawKey = field?.key && String(field.key).trim() ? String(field.key).trim() : ''
  const key = rawKey && !usedKeys.has(rawKey)
    ? rawKey
    : toUniqueFieldKey(name, usedKeys)

  if (!usedKeys.has(key)) usedKeys.add(key)

  return {
    key,
    name,
    type: field?.type || 'text',
    aliases,
  }
}

export function getFieldCandidates(field) {
  return [field?.key, field?.name, ...(field?.aliases || [])]
    .map(v => String(v || '').trim())
    .filter(Boolean)
}

export function getFieldMatch(data, field) {
  const row = data && typeof data === 'object' ? data : {}
  const candidates = getFieldCandidates(field)

  for (const candidate of candidates) {
    if (hasOwn(row, candidate)) return { key: candidate, value: row[candidate] }
  }

  const expected = toFieldKey(field?.name || field?.key || '')
  if (!expected) return null

  const canonicalMatch = Object.keys(row).find(key => toFieldKey(key) === expected)
  if (canonicalMatch) return { key: canonicalMatch, value: row[canonicalMatch] }

  return null
}

export function getFieldValue(data, field) {
  const match = getFieldMatch(data, field)
  if (match) return match.value

  return undefined
}

export function buildMigratedData(data, fields) {
  const row = data && typeof data === 'object' ? { ...data } : {}
  let changed = false

  for (const field of fields || []) {
    const stableKey = String(field?.key || '').trim()
    if (!stableKey) continue
    if (hasOwn(row, stableKey)) continue

    const value = getFieldValue(row, field)
    if (value !== undefined) {
      row[stableKey] = value
      changed = true
    }
  }

  return { data: row, changed }
}
