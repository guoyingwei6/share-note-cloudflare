import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Env, UserRow, ApiKeyRow, FileRow } from './types'
import { sha1, sha256, shortHash, generateUniqueFilename, getMimeType } from './helpers'
import { WebNote } from './templates'

type Variables = {
  user: UserRow
  pluginVersion?: string
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// Enable CORS for API routes
app.use('/v1/*', cors())

// Health check endpoint
app.get('/v1/ping', (c) => c.text('ok'))

// Homepage / Service Status
app.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Share Note Server</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --primary: #2563eb;
      --success: #16a34a;
      --badge-bg: #dcfce7;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --card-bg: #1e293b;
        --text: #f8fafc;
        --muted: #94a3b8;
        --border: #334155;
        --primary: #3b82f6;
        --success: #22c55e;
        --badge-bg: rgba(34, 197, 94, 0.15);
      }
    }
    body {
      margin: 0;
      padding: 40px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 80px);
    }
    .container {
      width: 100%;
      max-width: 540px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .title {
      font-size: 1.4rem;
      font-weight: 700;
      margin: 0;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--success);
      background: var(--badge-bg);
      border-radius: 9999px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
    }
    p {
      color: var(--muted);
      line-height: 1.6;
      margin: 0 0 16px 0;
      font-size: 0.95rem;
    }
    .info-box {
      background: rgba(37, 99, 235, 0.05);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      margin-bottom: 8px;
    }
    .info-item:last-child { margin-bottom: 0; }
    .label { color: var(--muted); }
    .val { font-weight: 600; font-family: monospace; }
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      font-size: 0.85rem;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    a {
      color: var(--primary);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">Share Note Server</h1>
      <span class="badge"><span class="dot"></span>运行正常</span>
    </div>
    <p>这是专为 <strong>Obsidian Share Note</strong> 插件部署的私人独立后端服务，托管于 Cloudflare 全球边缘网络。</p>
    <div class="info-box">
      <div class="info-item"><span class="label">运行时</span><span class="val">Cloudflare Workers</span></div>
      <div class="info-item"><span class="label">数据库</span><span class="val">Cloudflare D1 (SQLite)</span></div>
      <div class="info-item"><span class="label">存储后端</span><span class="val">Cloudflare R2 (Storage)</span></div>
      <div class="info-item"><span class="label">服务状态</span><span class="val" style="color:var(--success)">200 OK</span></div>
    </div>
    <p style="font-size:0.9rem;">
      <strong>连接提示</strong>：在 Obsidian 插件设置中将服务地址配置为 <code>${c.env.BASE_WEB_URL}</code>，点击 Connect 即可配对。
    </p>
    <div class="footer">
      <span>Powered by Cloudflare Serverless</span>
      <a href="https://github.com/guoyingwei6/share-note-cloudflare" target="_blank">GitHub 仓库</a>
    </div>
  </div>
</body>
</html>`;
  return c.html(html)
})

// ---------------------------------------------------------------------------
// Account Registration / API Key Pairing
// ---------------------------------------------------------------------------
app.get('/v1/account/get-key', async (c) => {
  const uid = c.req.query('id')
  if (!uid) {
    return c.text('Missing ID parameter', 400)
  }

  const allowNewUsers = c.env.ALLOW_NEW_USERS?.toLowerCase() !== 'false'

  // Look for existing user
  let user = await c.env.DB.prepare('SELECT * FROM users WHERE uid = ? LIMIT 1')
    .bind(uid)
    .first<UserRow>()

  if (!user) {
    if (!allowNewUsers) {
      return c.text('New user registration is disabled', 403)
    }
    const res = await c.env.DB.prepare('INSERT INTO users (uid, created) VALUES (?, unixepoch())')
      .bind(uid)
      .run()
    const newId = res.meta.last_row_id as number
    user = {
      id: newId,
      uid,
      created: Math.floor(Date.now() / 1000)
    }
  }

  // Revoke previous active keys for this user
  await c.env.DB.prepare('UPDATE api_keys SET revoked = unixepoch() WHERE users_id = ? AND revoked IS NULL')
    .bind(user.id)
    .run()

  // Generate new 32-character API key
  const newApiKey = await shortHash(`${user.id}-${Date.now()}-${crypto.randomUUID()}`)
  await c.env.DB.prepare('INSERT INTO api_keys (users_id, api_key, created) VALUES (?, ?, unixepoch())')
    .bind(user.id, newApiKey)
    .run()

  // HTML page redirecting to Obsidian with the API key
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Share Note Connected</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Refresh" content="3; URL=obsidian://share-note?key=${newApiKey}" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 520px;
      margin: 80px auto;
      padding: 24px;
      line-height: 1.6;
      color: #24292f;
      background: #fafbfc;
    }
    .card {
      background: #ffffff;
      border: 1px solid #d0d7de;
      border-radius: 8px;
      padding: 28px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    h3 { margin-top: 0; color: #0969da; }
    code {
      display: inline-block;
      margin-top: 8px;
      background: #f6f8fa;
      border: 1px solid #d0d7de;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 1.05em;
      color: #cf222e;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="card">
    <h3>Successfully connected Share Note!</h3>
    <p>This will only happen once 😊</p>
    <p>You should now be automatically sent back to Obsidian to complete setup.</p>
    <p>If not redirected automatically, copy and paste this key into the plugin settings:</p>
    <code>${newApiKey}</code>
  </div>
</body>
</html>`

  return c.html(html)
})

// ---------------------------------------------------------------------------
// Authentication Middleware for /v1/file/*
// ---------------------------------------------------------------------------
app.use('/v1/file/*', async (c, next) => {
  const uid = c.req.header('x-sharenote-id')
  const userHash = c.req.header('x-sharenote-key')
  const nonce = c.req.header('x-sharenote-nonce')
  const version = c.req.header('x-sharenote-version')

  if (version) {
    c.set('pluginVersion', version)
  }

  if (!uid || !userHash || !nonce) {
    return c.text('Unauthorized', 401)
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE uid = ? LIMIT 1')
    .bind(uid)
    .first<UserRow>()

  if (!user) {
    return c.text('Unauthorized', 401)
  }

  const apiKey = await c.env.DB.prepare(
    'SELECT * FROM api_keys WHERE users_id = ? AND revoked IS NULL LIMIT 1'
  )
    .bind(user.id)
    .first<ApiKeyRow>()

  if (!apiKey) {
    return c.text('Unauthorized', 401)
  }

  const expectedHash = await sha256(`${nonce}${apiKey.api_key}`)
  if (expectedHash.toLowerCase() !== userHash.toLowerCase()) {
    // 462 prompts the Obsidian plugin to automatically renew its API key
    return c.text('Invalid auth hash', 462 as any)
  }

  c.set('user', user)
  await next()
})

// ---------------------------------------------------------------------------
// Helper: get CSS filename for a user
// ---------------------------------------------------------------------------
async function getUserCssFilename(env: Env, uid: string): Promise<string> {
  return shortHash((env.HASH_SALT || '') + uid)
}

// ---------------------------------------------------------------------------
// File API Routes
// ---------------------------------------------------------------------------

// Check if the user's custom CSS is already uploaded
app.post('/v1/file/check-css', async (c) => {
  const user = c.get('user')
  const cssName = await getUserCssFilename(c.env, user.uid)
  const file = await c.env.DB.prepare(
    "SELECT id FROM files WHERE filename = ? AND filetype = 'css' LIMIT 1"
  )
    .bind(cssName)
    .first()

  return c.json({ success: !!file })
})

// Check single file
app.post('/v1/file/check-file', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ filetype: string; hash: string }>()
  const { filetype, hash } = body

  let targetFilename: string | null = null
  if (filetype === 'css') {
    targetFilename = await getUserCssFilename(c.env, user.uid)
  }

  let query = 'SELECT filename, filetype FROM files WHERE filetype = ? AND hash = ?'
  const params: any[] = [filetype, hash]
  if (targetFilename) {
    query += ' AND filename = ?'
    params.push(targetFilename)
  }
  query += ' LIMIT 1'

  const match = await c.env.DB.prepare(query).bind(...params).first<{ filename: string; filetype: string }>()
  if (match) {
    const url = filetype === 'html'
      ? `${c.env.BASE_WEB_URL}/${match.filename}`
      : `${c.env.BASE_WEB_URL}/${filetype === 'css' ? 'css' : 'files'}/${match.filename}.${filetype}`
    return c.json({ success: true, url })
  }

  return c.json({ success: false, url: null })
})

// Batch check files and CSS
app.post('/v1/file/check-files', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ files: Array<{ filetype: string; hash: string; byteLength: number; url?: string | null }> }>()
  const filesToCheck = body.files || []

  for (const item of filesToCheck) {
    const match = await c.env.DB.prepare(
      'SELECT filename, filetype FROM files WHERE filetype = ? AND hash = ? LIMIT 1'
    )
      .bind(item.filetype, item.hash)
      .first<{ filename: string; filetype: string }>()

    if (match) {
      item.url = `${c.env.BASE_WEB_URL}/files/${match.filename}.${match.filetype}`
    } else {
      item.url = null
    }
  }

  // Check CSS
  const cssName = await getUserCssFilename(c.env, user.uid)
  const cssRow = await c.env.DB.prepare(
    "SELECT hash FROM files WHERE filename = ? AND filetype = 'css' LIMIT 1"
  )
    .bind(cssName)
    .first<{ hash: string }>()

  return c.json({
    success: true,
    files: filesToCheck,
    css: cssRow
      ? {
          url: `${c.env.BASE_WEB_URL}/css/${cssName}.css`,
          hash: cssRow.hash
        }
      : null
  })
})

// Upload raw attachment or CSS
app.post('/v1/file/upload', async (c) => {
  const user = c.get('user')
  const filetype = c.req.header('x-sharenote-filetype') || 'bin'
  const fileHash = c.req.header('x-sharenote-hash') || ''
  const bodyBuffer = await c.req.arrayBuffer()

  const maxMb = parseFloat(c.env.MAXIMUM_UPLOAD_SIZE_MB || '5') || 5
  if (bodyBuffer.byteLength > maxMb * 1024 * 1024) {
    return c.text(`File too large (exceeds ${maxMb}MB)`, 413)
  }

  let filename = ''
  if (filetype === 'css') {
    filename = await getUserCssFilename(c.env, user.uid)
  } else {
    // Check if identical hash already exists
    const existing = await c.env.DB.prepare(
      'SELECT filename FROM files WHERE filetype = ? AND hash = ? LIMIT 1'
    )
      .bind(filetype, fileHash)
      .first<{ filename: string }>()

    if (existing) {
      return c.json({
        success: true,
        url: `${c.env.BASE_WEB_URL}/files/${existing.filename}.${filetype}`
      })
    }

    filename = await generateUniqueFilename(20, async (name) => {
      const row = await c.env.DB.prepare('SELECT 1 FROM files WHERE filename = ? LIMIT 1')
        .bind(name)
        .first()
      return !!row
    })
  }

  const r2Key = filetype === 'css' ? `css/${filename}.css` : `files/${filename}.${filetype}`
  const mimeType = getMimeType(filetype)

  await c.env.R2.put(r2Key, bodyBuffer, {
    httpMetadata: {
      contentType: mimeType
    }
  })

  // Register in D1
  await c.env.DB.prepare(`
    INSERT INTO files (users_id, filename, filetype, bytes, encrypted, hash, created, updated)
    VALUES (?, ?, ?, ?, 0, ?, unixepoch(), unixepoch())
    ON CONFLICT(filename, filetype) DO UPDATE SET
      bytes = excluded.bytes,
      hash = excluded.hash,
      updated = unixepoch()
  `)
    .bind(user.id, filename, filetype, bodyBuffer.byteLength, fileHash)
    .run()

  const publicUrl = filetype === 'css'
    ? `${c.env.BASE_WEB_URL}/css/${filename}.css`
    : `${c.env.BASE_WEB_URL}/files/${filename}.${filetype}`

  return c.json({ success: true, url: publicUrl })
})

// Create or update shared note
app.post('/v1/file/create-note', async (c) => {
  const user = c.get('user')
  const pluginVersion = c.get('pluginVersion') || '1.5.0'
  const post = await c.req.json<any>()
  const template = post.template || {}

  let filename = post.filename ? String(post.filename).replace(/[^a-z0-9]/g, '') : ''

  if (filename) {
    const existing = await c.env.DB.prepare(
      "SELECT users_id FROM files WHERE filename = ? AND filetype = 'html' LIMIT 1"
    )
      .bind(filename)
      .first<{ users_id: number }>()

    if (existing && existing.users_id !== user.id) {
      return c.text('Forbidden: Note is owned by another user', 403)
    }
  }

  const htmlLength = parseInt(c.env.FILENAME_LENGTH_HTML || '8', 10) || 8
  if (!filename) {
    filename = await generateUniqueFilename(htmlLength, async (name) => {
      const row = await c.env.DB.prepare('SELECT 1 FROM files WHERE filename = ? LIMIT 1')
        .bind(name)
        .first()
      return !!row
    })
  }

  // Construct WebNote HTML
  const webNote = new WebNote(c.env.BASE_WEB_URL)
  const cssFilename = await getUserCssFilename(c.env, user.uid)
  webNote.setCss(`${c.env.BASE_WEB_URL}/css/${cssFilename}.css`)
  webNote.setWidth(template.width)
  webNote.enableMathjax(!!template.mathJax)

  if (template.encrypted === false) {
    webNote.addUnencryptedContents(template.content)
    webNote.setTitle(template.title)
    webNote.setMetaDescription(template.description)
  } else {
    webNote.addEncryptedData(template.content, pluginVersion)
  }

  if (Array.isArray(template.elements)) {
    template.elements.forEach((el: any) => {
      webNote.setClassAndStyle(el?.element, el?.classes, el?.style)
    })
  }

  const finalHtml = webNote.contents()
  const contentHash = await sha1(finalHtml)

  // Write to R2
  await c.env.R2.put(`notes/${filename}.html`, finalHtml, {
    httpMetadata: {
      contentType: 'text/html; charset=utf-8'
    }
  })

  // Upsert to D1
  await c.env.DB.prepare(`
    INSERT INTO files (users_id, filename, filetype, bytes, encrypted, hash, created, updated)
    VALUES (?, ?, 'html', ?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(filename, filetype) DO UPDATE SET
      bytes = excluded.bytes,
      encrypted = excluded.encrypted,
      hash = excluded.hash,
      updated = unixepoch()
  `)
    .bind(user.id, filename, finalHtml.length, template.encrypted === false ? 0 : 1, contentHash)
    .run()

  const noteUrl = `${c.env.BASE_WEB_URL}/${filename}`
  return c.json({ success: true, url: noteUrl })
})

// Delete shared note
app.post('/v1/file/delete', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ filename?: string; filetype?: string }>()
  const filename = body.filename

  if (!filename) {
    return c.text('Missing filename', 400)
  }

  const file = await c.env.DB.prepare(
    "SELECT id, users_id FROM files WHERE filename = ? AND filetype = 'html' LIMIT 1"
  )
    .bind(filename)
    .first<{ id: number; users_id: number }>()

  if (file && file.users_id === user.id) {
    await c.env.R2.delete(`notes/${filename}.html`)
    await c.env.DB.prepare("DELETE FROM files WHERE filename = ? AND filetype = 'html'")
      .bind(filename)
      .run()
  }

  return c.json({ success: true })
})

// ---------------------------------------------------------------------------
// Public Note and Asset Serving Routes
// ---------------------------------------------------------------------------

// Serve user CSS
app.get('/css/:filename', async (c) => {
  const rawFilename = c.req.param('filename')
  const cleanName = rawFilename.endsWith('.css') ? rawFilename.slice(0, -4) : rawFilename
  const r2Key = `css/${cleanName}.css`

  const object = await c.env.R2.get(r2Key)
  if (!object) return c.text('Not found', 404)

  const headers = new Headers()
  headers.set('Content-Type', 'text/css; charset=utf-8')
  headers.set('Cache-Control', 'public, max-age=86400')
  if (object.httpEtag) headers.set('ETag', object.httpEtag)

  return new Response(object.body, { headers })
})

// Serve media attachments
app.get('/files/:filename', async (c) => {
  const fullFilename = c.req.param('filename')
  const r2Key = `files/${fullFilename}`

  const object = await c.env.R2.get(r2Key)
  if (!object) return c.text('Not found', 404)

  const ext = fullFilename.split('.').pop() || ''
  const headers = new Headers()
  headers.set('Content-Type', getMimeType(ext))
  headers.set('Cache-Control', 'public, max-age=604800, immutable')
  if (object.httpEtag) headers.set('ETag', object.httpEtag)

  return new Response(object.body, { headers })
})

// Serve shared note HTML
app.get('/:filename', async (c) => {
  const filename = c.req.param('filename')

  // Prevent directory traversal or invalid paths
  if (!filename || filename.match(/[^a-z0-9]/i)) {
    return c.text('Not found', 404)
  }

  const r2Key = `notes/${filename}.html`
  const object = await c.env.R2.get(r2Key)
  if (!object) return c.text('Note not found', 404)

  // Track access timestamp asynchronously without blocking response
  c.executionCtx.waitUntil(
    c.env.DB.prepare("UPDATE files SET accessed = unixepoch() WHERE filename = ? AND filetype = 'html'")
      .bind(filename)
      .run()
      .catch((e) => console.error('Error logging access:', e))
  )

  const headers = new Headers()
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Cache-Control', 'public, max-age=300')
  if (object.httpEtag) headers.set('ETag', object.httpEtag)

  return new Response(object.body, { headers })
})

export default app
