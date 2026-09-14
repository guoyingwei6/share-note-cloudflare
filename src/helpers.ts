async function sha(algorithm: string, data: string | Uint8Array | ArrayBuffer): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const hash = await crypto.subtle.digest(algorithm, buffer as BufferSource)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function sha256(data: string | ArrayBuffer): Promise<string> {
  return sha('SHA-256', data)
}

export async function sha1(data: string | ArrayBuffer): Promise<string> {
  return sha('SHA-1', data)
}

export async function shortHash(text: string): Promise<string> {
  return (await sha256(text)).slice(0, 32)
}

export type Semver = [number, number, number]

export function checkVersion(version: string, minimumRequired: Semver): boolean {
  const userVersion = (version || '').split('.')
  if (userVersion.length === 3) {
    for (let i = 0; i < 3; i++) {
      const u = parseInt(userVersion[i], 10) || 0
      if (u > minimumRequired[i]) return true
      if (u < minimumRequired[i]) return false
    }
    return true
  }
  return false
}

export async function generateUniqueFilename(
  length: number,
  isOccupied: (name: string) => Promise<boolean>
): Promise<string> {
  const maxAttempts = 10
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(length))
    let name = ''
    for (let i = 0; i < bytes.length; i++) {
      name += Math.floor(bytes[i] * 0.140625).toString(36)
    }
    if (!(await isOccupied(name))) {
      return name
    }
  }
  throw new Error('Filename space collision saturation. Increase FILENAME_LENGTH_HTML.')
}

const MIME_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  webm: 'video/webm',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf'
}

export function getMimeType(ext: string): string {
  const cleanExt = (ext || '').replace(/^\./, '').toLowerCase()
  return MIME_TYPES[cleanExt] || 'application/octet-stream'
}
