const rawBasePath = import.meta.env.BASE_URL || '/'

export function getRouterBasename() {
  return rawBasePath === '/' ? '/' : rawBasePath.replace(/\/$/, '')
}

export function buildAppPath(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const basePath = getRouterBasename()

  return basePath === '/' ? normalizedPath : `${basePath}${normalizedPath}`
}

export function buildAppUrl(path) {
  return new URL(buildAppPath(path), window.location.origin).toString()
}