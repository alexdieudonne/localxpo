// Node Imports
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { dataDir } from './db'

const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** 16 random letters/digits (~95 bits): safe in URLs and as CLI arguments (never starts with "-"). */
export const newId = (length = 16): string => {
  const bytes = crypto.randomBytes(length * 2)
  let id = ''

  // Rejection sampling keeps the distribution uniform over 62 symbols.
  for (let i = 0; i < bytes.length && id.length < length; i++) if (bytes[i] < 248) id += ID_ALPHABET[bytes[i] % 62]

  return id.length === length ? id : newId(length)
}

export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex')

// ---------- Passwords (scrypt, no native deps) ----------

const SCRYPT_N = 16384
const SCRYPT_KEYLEN = 64

export const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N })

  return `scrypt$${SCRYPT_N}$${salt.toString('base64')}$${hash.toString('base64')}`
}

// Async variants: scrypt runs on the libuv pool instead of blocking every other request.
const scryptAsync = (password: string, salt: Buffer, keylen: number, n: number) =>
  new Promise<Buffer>((resolve, reject) => crypto.scrypt(password, salt, keylen, { N: n }, (err, key) => (err ? reject(err) : resolve(key))))

export const hashPasswordAsync = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(16)
  const hash = await scryptAsync(password, salt, SCRYPT_KEYLEN, SCRYPT_N)

  return `scrypt$${SCRYPT_N}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export const verifyPasswordAsync = async (password: string, stored: string): Promise<boolean> => {
  const [algo, n, saltB64, hashB64] = stored.split('$')

  if (algo !== 'scrypt' || !n || !saltB64 || !hashB64) return false

  const expected = Buffer.from(hashB64, 'base64')
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, Number(n))

  return crypto.timingSafeEqual(expected, actual)
}

export const verifyPassword = (password: string, stored: string): boolean => {
  const [algo, n, saltB64, hashB64] = stored.split('$')

  if (algo !== 'scrypt' || !n || !saltB64 || !hashB64) return false

  const expected = Buffer.from(hashB64, 'base64')
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n) })

  return crypto.timingSafeEqual(expected, actual)
}

// ---------- Secret encryption (AES-256-GCM) ----------
// Key comes from LOCALXPO_SECRET, or is generated once into data/.secret for local use.

let cachedKey: Buffer | null = null

const getKey = (): Buffer => {
  if (cachedKey) return cachedKey

  let secret = process.env.LOCALXPO_SECRET

  // A hosted server (shared database, ephemeral disk) must not invent its own key: saved store keys would become
  // unreadable on the next instance. Only a single self-hosted machine may generate one into data/.secret.
  if (!secret && (process.env.LOCALXPO_MODE === 'cloud' || process.env.DATABASE_URL || process.env.VERCEL))
    throw new Error('LOCALXPO_SECRET is not set. Set it (32+ random characters) before saving or reading store credentials.')

  if (!secret) {
    const file = path.join(/*turbopackIgnore: true*/ dataDir(), '.secret')

    fs.mkdirSync(dataDir(), { recursive: true })

    if (fs.existsSync(file)) {
      secret = fs.readFileSync(file, 'utf8').trim()
    } else {
      secret = crypto.randomBytes(32).toString('base64')
      fs.writeFileSync(file, secret, { mode: 0o600 })
    }
  }

  cachedKey = crypto.createHash('sha256').update(secret).digest()

  return cachedKey
}

export const encryptSecret = (plain: string): string => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])

  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.')
}

export const decryptSecret = (payload: string): string => {
  const [version, ivB64, tagB64, dataB64] = payload.split('.')

  if (version !== 'v1') throw new Error('Unknown secret format')

  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'))

  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))

  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}
