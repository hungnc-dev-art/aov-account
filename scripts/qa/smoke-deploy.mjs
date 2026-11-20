#!/usr/bin/env node
// Smoke test KHÔNG PHÁ HUỶ cho một deployment Vercel (qua `vercel curl`, tự bypass Deployment Protection).
// Chỉ đọc, hoặc gửi request ghi mà server phải TỪ CHỐI trước khi chạm database.
// Không in dữ liệu tài khoản; chỉ in status code / số lượng.
//
//   node scripts/qa/smoke-deploy.mjs <deploymentUrl> <passwordFile> <workDir> [--skip-wrong-password]
//
// passwordFile: dòng thứ 2 là mật khẩu chủ sở hữu. Chạy từ thư mục đã `vercel link`.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const [deployment, passwordFile, workDir] = process.argv.slice(2)
const skipWrong = process.argv.includes('--skip-wrong-password')
if (!deployment || !passwordFile || !workDir) {
  console.error('Dùng: node scripts/qa/smoke-deploy.mjs <deploymentUrl> <passwordFile> <workDir>')
  process.exit(2)
}
mkdirSync(workDir, { recursive: true })
const origin = new URL(deployment).origin
const jar = path.join(workDir, 'cookies.txt')
const bodyFile = path.join(workDir, 'body.json')
const outFile = path.join(workDir, 'out.json')
const headFile = path.join(workDir, 'head.txt')
// curl coi `-b <file chưa tồn tại>` là CHUỖI cookie → tạo file rỗng trước.
writeFileSync(jar, '')

function call(route, { method = 'GET', body, headers = {}, cookies = true, keep = false } = {}) {
  const args = ['--yes', 'vercel@66.6.0', 'curl', route, '--deployment', deployment, '--', '-s', '-o', keep ? outFile : (process.platform === 'win32' ? 'NUL' : '/dev/null'), '-D', headFile, '-w', '%{http_code}', '--request', method]
  if (cookies) args.push('-b', jar, '-c', jar)
  for (const [key, value] of Object.entries(headers)) args.push('--header', `${key}: ${value}`)
  if (body !== undefined) {
    writeFileSync(bodyFile, typeof body === 'string' ? body : JSON.stringify(body))
    args.push('--data-binary', `@${bodyFile}`)
  }
  // Windows cần shell để chạy npx.cmd; khi đó phải tự bọc ngoặc kép (header có dấu cách).
  const isWindows = process.platform === 'win32'
  const result = spawnSync('npx', isWindows ? args.map((arg) => `"${arg}"`) : args, { encoding: 'utf8', shell: isWindows })
  rmSync(bodyFile, { force: true })
  const status = Number((result.stdout.match(/(\d{3})\s*$/) ?? [])[1] ?? 0)
  const headersText = (() => { try { return readFileSync(headFile, 'utf8') } catch { return '' } })()
  return { status, headers: headersText, json: keep ? (() => { try { return JSON.parse(readFileSync(outFile, 'utf8')) } catch { return null } })() : null }
}

const checks = []
const check = (name, pass, detail = '') => {
  checks.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const json = { 'content-type': 'application/json', origin }

// 1. Chưa đăng nhập
let r = call('/login')
check('GET /login → 200', r.status === 200, String(r.status))
const head = r.headers.toLowerCase()
check('Header bảo mật trên /login (CSP nonce, XFO, nosniff, HSTS, không X-Powered-By)',
  head.includes("content-security-policy: default-src 'self'; script-src 'self' 'nonce-") && head.includes('x-frame-options: deny') &&
  head.includes('x-content-type-options: nosniff') && head.includes('strict-transport-security') && !head.includes('x-powered-by'))
r = call('/')
check('GET / chưa đăng nhập → chuyển /login', [302, 307, 308].includes(r.status) && /location: [^\r\n]*\/login/i.test(r.headers), String(r.status))
for (const route of ['/api/accounts', '/api/accounts/1/password']) {
  r = call(route)
  check(`GET ${route} chưa đăng nhập → 401`, r.status === 401, String(r.status))
}
r = call('/api/accounts/export', { method: 'POST', body: {}, headers: json })
check('POST /api/accounts/export chưa đăng nhập → 401', r.status === 401, String(r.status))
r = call('/api/auth/session', { keep: true })
check('GET /api/auth/session chưa đăng nhập → authenticated=false', r.status === 200 && r.json?.authenticated === false)

// 2. Đăng nhập
if (!skipWrong) {
  r = call('/api/auth/login', { method: 'POST', body: { password: 'sai-mat-khau-smoke-test' }, headers: json })
  check('Đăng nhập sai mật khẩu → 401', r.status === 401, String(r.status))
}
const password = readFileSync(passwordFile, 'utf8').split(/\r?\n/)[1]?.trim() ?? ''
r = call('/api/auth/login', { method: 'POST', body: { password }, headers: json })
const cookieLine = r.headers.split(/\r?\n/).find((line) => /^set-cookie: __Host-aov_session=/i.test(line)) ?? ''
check('Đăng nhập đúng → 200 + cookie __Host- HttpOnly Secure SameSite=Strict', r.status === 200 && /HttpOnly/i.test(cookieLine) && /Secure/i.test(cookieLine) && /SameSite=Strict/i.test(cookieLine), String(r.status))
r = call('/api/auth/session', { keep: true })
check('Phiên hợp lệ sau đăng nhập', r.json?.authenticated === true)

// 3. Đọc (không in dữ liệu)
r = call('/api/accounts', { keep: true })
const accounts = Array.isArray(r.json?.accounts) ? r.json.accounts : null
const keys = new Set((accounts ?? []).flatMap((account) => Object.keys(account)))
check('GET /api/accounts có phiên → 200, danh sách KHÔNG có trường password', r.status === 200 && accounts !== null && !keys.has('password') && keys.has('hasPassword'), `${accounts?.length ?? 0} tài khoản`)
rmSync(outFile, { force: true })
r = call('/')
check('GET / có phiên → 200', r.status === 200, String(r.status))

// 4. Ghi bị từ chối trước DB
r = call('/api/accounts', { method: 'POST', body: { username: 'smoke', heroes: [] }, headers: { 'content-type': 'text/plain', origin } })
check('POST text/plain → 415 (CSRF)', r.status === 415, String(r.status))
r = call('/api/accounts', { method: 'POST', body: { username: 'smoke', heroes: [] }, headers: { 'content-type': 'application/json', origin: 'https://evil.example' } })
check('POST origin lạ → 403 (CSRF)', r.status === 403, String(r.status))
r = call('/api/accounts', { method: 'POST', body: { username: 'smoke', heroes: [] }, headers: json, keep: true })
check('POST thiếu tướng → 400 (validate trước DB)', r.status === 400, String(r.status))
r = call('/api/accounts/abc', { method: 'DELETE', headers: { origin } })
check('DELETE id không hợp lệ → 400', r.status === 400, String(r.status))
r = call('/api/accounts/import', { method: 'POST', body: { mode: 'replace', accounts: [{ username: 'smoke', heroes: ['Nakroth'] }] }, headers: json, keep: true })
check('Import replace thiếu cụm xác nhận → 400 CONFIRMATION_REQUIRED', r.status === 400 && r.json?.code === 'CONFIRMATION_REQUIRED', String(r.status))
r = call('/api/accounts/import', { method: 'POST', body: { mode: 'replace', accounts: [{ username: 'smoke', heroes: ['Nakroth'] }], confirm: { phrase: 'THAY THẾ', expectedCount: -1 } }, headers: json, keep: true })
check('Import replace expectedCount sai → 400 (không chạm DB)', r.status === 400, String(r.status))
rmSync(outFile, { force: true })

// 5. Đăng xuất
r = call('/api/auth/logout', { method: 'POST', body: {}, headers: json })
check('Đăng xuất → 200', r.status === 200, String(r.status))
r = call('/api/accounts')
check('Sau đăng xuất → 401', r.status === 401, String(r.status))

rmSync(jar, { force: true })
rmSync(headFile, { force: true })
const failed = checks.filter((item) => !item.pass)
console.log(`\n${checks.length - failed.length}/${checks.length} smoke test đạt`)
process.exit(failed.length ? 1 : 0)
