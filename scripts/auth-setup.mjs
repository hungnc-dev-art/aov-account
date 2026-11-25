#!/usr/bin/env node
// Sinh giá trị cho biến môi trường xác thực. KHÔNG commit kết quả.
//
//   node scripts/auth-setup.mjs secret            → AUTH_SESSION_SECRET (ngẫu nhiên 48 byte)
//   node scripts/auth-setup.mjs hash < pw.txt     → AUTH_OWNER_PASSWORD_HASH từ mật khẩu qua stdin
//   node scripts/auth-setup.mjs hash              → nhập mật khẩu (ẩn) trong terminal
//
// Thuật toán phải khớp src/lib/auth/password.ts (scrypt N=2^15, r=8, p=1, 32 byte).
import { randomBytes, scrypt } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const PARAMS = { N: 2 ** 15, r: 8, p: 1 }

export function hashOwnerPassword(password) {
  if (!password || password.length < 8 || password.length > 256) {
    return Promise.reject(new Error('Mật khẩu chủ sở hữu cần 8–256 ký tự.'))
  }
  const salt = randomBytes(16)
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, 32, { ...PARAMS, maxmem: 256 * PARAMS.N * PARAMS.r }, (error, key) => {
      if (error) return reject(error)
      resolve(['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64url'), key.toString('base64url')].join('$'))
    })
  })
}

export function generateSessionSecret() {
  return randomBytes(48).toString('base64url')
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '')
  }
  process.stderr.write('Mật khẩu chủ sở hữu (không hiển thị): ')
  process.stdin.setRawMode(true)
  let value = ''
  for await (const chunk of process.stdin) {
    for (const char of chunk.toString('utf8')) {
      if (char === '\r' || char === '\n') {
        process.stdin.setRawMode(false)
        process.stderr.write('\n')
        return value
      }
      if (char === '\u0003') process.exit(130)
      value = char === '\u007f' ? value.slice(0, -1) : value + char
    }
  }
  return value
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const command = process.argv[2]
  if (command === 'secret') {
    process.stdout.write(`${generateSessionSecret()}\n`)
  } else if (command === 'hash') {
    hashOwnerPassword(await readPassword())
      .then((hash) => process.stdout.write(`${hash}\n`))
      .catch((error) => {
        process.stderr.write(`${error.message}\n`)
        process.exit(1)
      })
  } else {
    process.stderr.write('Dùng: node scripts/auth-setup.mjs <secret|hash>\n')
    process.exit(2)
  }
}
