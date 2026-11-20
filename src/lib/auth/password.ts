// Hash mật khẩu chủ sở hữu bằng scrypt (node:crypto). Chỉ dùng phía server.
// Mật khẩu tài khoản game KHÔNG đi qua module này (vẫn cần đọc lại được).
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto'

export const MAX_PASSWORD_LENGTH = 256
const DEFAULT_PARAMS = { N: 2 ** 15, r: 8, p: 1 }
const KEY_LENGTH = 32

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key)))
  })
}

const memoryFor = (N: number, r: number) => 256 * N * r

export async function hashPassword(password: string, params = DEFAULT_PARAMS): Promise<string> {
  if (!password || password.length > MAX_PASSWORD_LENGTH) throw new Error('Mật khẩu không hợp lệ.')
  const salt = randomBytes(16)
  const key = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...params, maxmem: memoryFor(params.N, params.r) })
  return ['scrypt', params.N, params.r, params.p, salt.toString('base64url'), key.toString('base64url')].join('$')
}

/** So sánh constant-time; chuỗi hash sai định dạng → false (không ném lỗi). */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (typeof password !== 'string' || !password || password.length > MAX_PASSWORD_LENGTH) return false
  const parts = encoded.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [N, r, p] = parts.slice(1, 4).map(Number)
  const validN = Number.isInteger(N) && N >= 2 ** 14 && N <= 2 ** 20 && (N & (N - 1)) === 0
  if (!validN || !Number.isInteger(r) || r < 1 || r > 32 || !Number.isInteger(p) || p < 1 || p > 16) return false
  const salt = Buffer.from(parts[4], 'base64url')
  const expected = Buffer.from(parts[5], 'base64url')
  if (salt.length < 16 || expected.length < 16) return false
  const actual = await scrypt(password.normalize('NFKC'), salt, expected.length, { N, r, p, maxmem: memoryFor(N, r) })
  return timingSafeEqual(actual, expected)
}
