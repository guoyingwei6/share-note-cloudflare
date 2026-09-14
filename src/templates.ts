import { checkVersion } from './helpers'

export const NOTE_HTML_TEMPLATE = `<!DOCTYPE HTML>
<html TEMPLATE_HTML>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1'>
    <title>TEMPLATE_TITLE</title>
    TEMPLATE_OG_TITLE
    TEMPLATE_META_DESCRIPTION
    <link rel='icon' type='image/x-icon' href='/favicon.ico'>
    <style>
        TEMPLATE_WIDTH
    </style>
    <link rel='stylesheet' href='TEMPLATE_CSS'>
    <link rel='stylesheet' href='TEMPLATE_ASSETS_WEBROOT/global-note-styles.css'>
    <script src='TEMPLATE_ASSETS_WEBROOT/app.js'></script>
    TEMPLATE_SCRIPTS
</head>
<body TEMPLATE_BODY>
<div class='app-container'>
    <div class='horizontal-main-container'>
        <div class='workspace'>
            <div class='workspace-split mod-vertical mod-root'>
                <div class='workspace-leaf mod-active'>
                    <div class='workspace-leaf-content'>
                        <div class='view-content'>
                            <div class='markdown-reading-view' style='height:100%;width:100%;'>
                                <div TEMPLATE_PREVIEW>
                                    <div class='markdown-preview-sizer markdown-preview-section'>
                                        <div TEMPLATE_PUSHER></div>
                                        TEMPLATE_NOTE_CONTENT
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class='status-bar' style='display:flex !important;position:fixed !important;'>
        <div class='status-bar-item'>
            <span class='status-bar-item-segment'><a href='https://note.sx/' target='_blank'>Share Note</a> for Obsidian</span>
            <span id='theme-mode-toggle' class='status-bar-item-segment'>🌓</span>
            <a id='save-to-obsidian' class='status-bar-item-segment' hidden title='Requires Obsidian with the Share Note plugin'>💾 Save note</a>
        </div>
    </div>
</div>
TEMPLATE_ENCRYPTED_DATA
TEMPLATE_DECRYPTION_FUNCTIONS
</body>
</html>`

export const DECRYPT_JS_LATEST = `<script>
function base64ToArrayBuffer (base64) {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

async function decryptString ({ ciphertext, ivs }, secret) {
  const aesKey = await window.crypto.subtle.importKey('raw', base64ToArrayBuffer(secret), {
    name: 'AES-GCM',
    length: 256
  }, false, ['decrypt'])

  const plaintext = []
  for (let index = 0; index < ciphertext.length; index++) {
    const ciphertextBuf = base64ToArrayBuffer(ciphertext[index])
    const iv = new Uint8Array(base64ToArrayBuffer(ivs[index]))
    const plaintextChunk = await window.crypto.subtle
      .decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertextBuf)
    plaintext.push(new TextDecoder().decode(plaintextChunk))
  }
  return plaintext.join('')
}

const encryptedData = document.getElementById('encrypted-data').innerText.trim()
const payload = encryptedData ? JSON.parse(encryptedData) : ''
const secret = window.location.hash.slice(1)
if (payload && secret) {
  decryptString(payload, secret)
    .then(text => {
      const data = JSON.parse(text)
      const contentEl = document.getElementById('template-user-data')
      if (contentEl) contentEl.outerHTML = data.content
      document.title = data.basename
      initDocument({ hasSource: typeof data.markdown === 'string' })
    })
    .catch(() => {
      const contentEl = document.getElementById('template-user-data')
      if (contentEl) contentEl.innerHTML = 'Unable to decrypt using this key.'
    })
}
</script>`

export const DECRYPT_JS_V142 = `<script>
function base64ToArrayBuffer (base64) {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

function indexToIv (int) {
  const iv = new Uint8Array(12)
  for (let i = 0; i < iv.length; i++) {
    iv[i] = int % 256
    int = Math.floor(int / 256)
  }
  return iv
}

async function decryptString (ciphertextArray, secret) {
  const aesKey = await window.crypto.subtle.importKey('raw', base64ToArrayBuffer(secret), {
    name: 'AES-GCM',
    length: 256
  }, false, ['decrypt'])

  const plaintext = []
  for (let index = 0; index < ciphertextArray.length; index++) {
    const ciphertextChunk = ciphertextArray[index]
    const ciphertextBuf = base64ToArrayBuffer(ciphertextChunk)
    const plaintextChunk = await window.crypto.subtle
      .decrypt({
        name: 'AES-GCM',
        iv: indexToIv(index)
      }, aesKey, ciphertextBuf)
    plaintext.push(new TextDecoder().decode(plaintextChunk))
  }
  return plaintext.join('')
}

const encryptedData = document.getElementById('encrypted-data').innerText.trim()
const payload = encryptedData ? JSON.parse(encryptedData) : ''
const secret = window.location.hash.slice(1)
if (payload && secret) {
  decryptString(payload.ciphertext, secret)
    .then(text => {
      const data = JSON.parse(text)
      const contentEl = document.getElementById('template-user-data')
      if (contentEl) contentEl.outerHTML = data.content
      document.title = data.basename
      initDocument()
    })
    .catch(() => {
      const contentEl = document.getElementById('template-user-data')
      if (contentEl) contentEl.innerHTML = 'Unable to decrypt using this key.'
    })
}
</script>`

export const DECRYPT_JS_V113 = `<script>
function base64ToArrayBuffer (base64) {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

async function decryptString (ciphertext, secret) {
  const aesKey = await window.crypto.subtle.importKey('raw', base64ToArrayBuffer(secret), {
    name: 'AES-GCM',
    length: 256
  }, false, ['decrypt'])
  const ciphertextBuf = base64ToArrayBuffer(ciphertext)
  const iv = new Uint8Array(12)
  const plaintextChunk = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertextBuf)
  return new TextDecoder().decode(plaintextChunk)
}

const encryptedData = document.getElementById('encrypted-data').innerText.trim()
const payload = encryptedData ? JSON.parse(encryptedData) : ''
const secret = window.location.hash.slice(1)
if (payload && secret) {
  decryptString(payload.ciphertext, secret)
    .then(text => {
      const data = JSON.parse(text)
      const contentEl = document.getElementById('template-user-data')
      if (contentEl) contentEl.outerHTML = data.content
      document.title = data.basename
      initDocument()
    })
    .catch(() => {
      const contentEl = document.getElementById('template-user-data')
      if (contentEl) contentEl.innerHTML = 'Unable to decrypt using this key.'
    })
}
</script>`

const PLAINTEXT_SCRIPT = '<script>initDocument();</script>'

export class WebNote {
  private html: string
  private baseWebUrl: string

  private placeholders: Record<string, string> = {
    css: 'TEMPLATE_CSS',
    width: 'TEMPLATE_WIDTH',
    title: 'TEMPLATE_TITLE',
    ogTitle: 'TEMPLATE_OG_TITLE',
    metaDescription: 'TEMPLATE_META_DESCRIPTION',
    encryptedData: 'TEMPLATE_ENCRYPTED_DATA',
    noteContent: 'TEMPLATE_NOTE_CONTENT',
    scripts: 'TEMPLATE_SCRIPTS',
    assetsWebroot: 'TEMPLATE_ASSETS_WEBROOT',
    decryptionFunctions: 'TEMPLATE_DECRYPTION_FUNCTIONS'
  }

  private elements: Record<string, string> = {
    html: 'TEMPLATE_HTML',
    body: 'TEMPLATE_BODY',
    preview: 'TEMPLATE_PREVIEW',
    pusher: 'TEMPLATE_PUSHER'
  }

  constructor(baseWebUrl: string) {
    this.baseWebUrl = baseWebUrl.replace(/\/+$/, '')
    this.html = NOTE_HTML_TEMPLATE
    this.replace(this.placeholders.assetsWebroot, this.baseWebUrl + '/assets')
  }

  private replace(variable: string, value: string) {
    this.html = this.html.replace(new RegExp(variable, 'g'), value)
  }

  private stringify(val: any): string {
    return typeof val === 'string' ? val : ''
  }

  private htmlQuote(str: string): string {
    return str
      .replace(/\s+/g, ' ')
      .replace(/[&<>'"]/g, (tag: string) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || ''))
  }

  setCss(url: string) {
    this.replace(this.placeholders.css, url)
  }

  setWidth(width: any) {
    let w = this.stringify(width).replace(/["']/g, '')
    if (w) {
      w = `.markdown-preview-sizer.markdown-preview-section { max-width: ${w} !important; margin: 0 auto; }`
    }
    this.replace(this.placeholders.width, w)
  }

  setTitle(title: any) {
    const t = this.htmlQuote(this.stringify(title))
    this.replace(this.placeholders.title, t)
    this.replace(this.placeholders.ogTitle, `<meta property="og:title" content="${t}">`)
  }

  setMetaDescription(desc: any) {
    const d = this.htmlQuote(this.stringify(desc))
    const meta = `<meta name="description" content="${d}"><meta content="${d}" property="og:description">`
    this.replace(this.placeholders.metaDescription, meta)
  }

  addUnencryptedContents(data: any) {
    if (typeof data === 'string') {
      this.replace(this.placeholders.noteContent, data)
    }
    this.replace(this.placeholders.decryptionFunctions, PLAINTEXT_SCRIPT)
  }

  addEncryptedData(data: any, pluginVersion: string) {
    if (typeof data === 'string') {
      const encDiv = `<div id='encrypted-data' style='display: none'>${data}</div>`
      this.replace(this.placeholders.encryptedData, encDiv)
    }
    this.replace(this.placeholders.noteContent, '<div id="template-user-data">Encrypted note</div>')

    if (!checkVersion(pluginVersion, [1, 2, 0])) {
      this.replace(this.placeholders.decryptionFunctions, DECRYPT_JS_V113)
    } else if (!checkVersion(pluginVersion, [1, 5, 0])) {
      this.replace(this.placeholders.decryptionFunctions, DECRYPT_JS_V142)
    } else {
      this.replace(this.placeholders.decryptionFunctions, DECRYPT_JS_LATEST)
    }
  }

  enableMathjax(enable = false) {
    if (enable) {
      this.replace(
        this.placeholders.scripts,
        `<link rel="stylesheet" href="${this.baseWebUrl}/assets/mathjax/mathjax.css">`
      )
    }
  }

  setClassAndStyle(elShortname: string, classes: any, style: any) {
    if (!this.elements[elShortname]) return

    let s = this.stringify(style).replace(/"/g, '')
    let clsArr = Array.isArray(classes) ? classes : []
    clsArr = clsArr.map((cls: any) => this.stringify(cls).replace(/[^\w-]/g, ''))

    const content: string[] = []
    if (clsArr.length) {
      content.push(`class="${clsArr.join(' ')}"`)
    }
    if (s) {
      content.push(`style="${s}"`)
    }
    this.replace(this.elements[elShortname], content.join(' '))
  }

  contents(): string {
    [...Object.values(this.placeholders), ...Object.values(this.elements)].forEach((placeholder) => {
      this.replace(placeholder, '')
    })
    return this.html
  }
}
