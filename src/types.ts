export interface Env {
  DB: D1Database
  R2: R2Bucket
  ASSETS?: Fetcher
  BASE_WEB_URL: string
  HASH_SALT: string
  ALLOW_NEW_USERS?: string
  FILENAME_LENGTH_HTML?: string
  MAXIMUM_UPLOAD_SIZE_MB?: string
}

export interface UserRow {
  id: number
  uid: string
  created: number
}

export interface ApiKeyRow {
  id: number
  users_id: number
  api_key: string
  created: number
  validated: number | null
  revoked: number | null
}

export interface FileRow {
  id: number
  users_id: number
  filename: string
  filetype: string
  bytes: number | null
  encrypted: number | null
  hash: string | null
  created: number
  updated: number
  expires: number | null
  accessed: number | null
}
