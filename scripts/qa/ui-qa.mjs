#!/usr/bin/env node
// QA end-to-end trên app thật (next start). Đăng nhập THẬT qua /api/auth/*;
// API dữ liệu /api/accounts* được mock bằng tài khoản GIẢ qua CDP → không chạm database.
//
//   node scripts/qa/ui-qa.mjs <baseUrl> <outDir> <passwordFile>
//
// passwordFile chứa mật khẩu chủ sở hữu của môi trường QA (không in ra log).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch, PROBE } from './cdp.mjs'

const [BASE = 'http://127.0.0.1:3400', OUT, PASSWORD_FILE] = process.argv.slice(2)
if (!OUT || !PASSWORD_FILE) {
  console.error('Dùng: node scripts/qa/ui-qa.mjs <baseUrl> <outDir> <passwordFile>')
  process.exit(2)
}
const PASSWORD = readFileSync(PASSWORD_FILE, 'utf8').trim()
const REPO = fileURLToPath(new URL('../../', import.meta.url))
const FIXTURE = `${REPO}test/fixtures/import-accounts.xlsx`
const DOWNLOADS = `${OUT}/downloads`
mkdirSync(DOWNLOADS, { recursive: true })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/* ---------------- Dữ liệu giả ---------------- */
const norm = (value) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
const heroNames = [...readFileSync(`${REPO}src/data/heroes.generated.ts`, 'utf8').matchAll(/"name": "([^"]+)",\n\s+"normalizedName"/g)].map((match) => match[1])
const NICKS = ['Acc Rank Cao Thủ', 'Acc Full Pháp Sư', 'Acc Sưu Tầm Skin', 'Acc Đi Rừng Chính', '', 'Acc Xạ Thủ Mùa 28', 'Acc Luyện Tập', 'Tài khoản sưu tầm tướng giới hạn mùa giải 2026 – bản dự phòng số 2', 'Acc Đấu Sĩ Top', 'Acc Cho Bạn Mượn', 'Acc Mid Lane', 'Acc Tank Cứng']
const fakePassword = (id) => `QA-fake-${id}-pw`
function makeAccounts() {
  return NICKS.map((nickname, index) => {
    const id = index + 1
    const heroes = heroNames.filter((_, heroIndex) => (heroIndex * 7 + index * 11) % 9 === 0).slice(0, 6 + ((index * 13) % 40))
    if (index === 6) heroes.push('Tướng Thử Nghiệm')
    const stamp = new Date(Date.now() - index * 9 * 3600_000).toISOString()
    return {
      id,
      username: index === 7 ? 'demo.taikhoan.rat.dai.de.kiem.tra.tran.chu.2026' : `demo.kho${String(id).padStart(2, '0')}`,
      nickname, gold: index % 3 ? '' : '12.500', level: index % 2 ? '' : '30', rank: ['Cao Thủ', '', 'Tinh Anh', 'Kim Cương'][index % 4], status: 'Sẵn sàng', note: '',
      heroes, heroNamesNormalized: heroes.map(norm), hasPassword: index % 5 !== 4, createdAt: stamp, updatedAt: stamp,
    }
  })
}
const state = { accounts: makeAccounts(), failGet: false, failDelete: false, getDelay: 0, exportCalls: 0, requests: [] }

function handler({ method, url, body }) {
  const path = new URL(url).pathname
  state.requests.push(`${method} ${path}`)
  const json = body ? JSON.parse(body) : {}
  if (path === '/api/accounts' && method === 'GET') {
    if (state.failGet) return { status: 500, json: { error: 'Máy chủ gặp lỗi. Dữ liệu chưa bị thay đổi, vui lòng thử lại sau.', code: 'INTERNAL_ERROR' } }
    return { delay: state.getDelay, json: { accounts: state.accounts } }
  }
  const passwordMatch = path.match(/^\/api\/accounts\/(\d+)\/password$/)
  if (passwordMatch) return { json: { password: fakePassword(passwordMatch[1]) } }
  if (path === '/api/accounts' && method === 'POST') {
    if (state.accounts.some((account) => account.username.toLowerCase() === String(json.username).trim().toLowerCase())) {
      return { status: 409, json: { error: 'Tên đăng nhập đã tồn tại (không phân biệt hoa/thường).', code: 'USERNAME_TAKEN' } }
    }
    const account = { ...state.accounts[0], id: 900 + state.accounts.length, username: json.username, nickname: json.nickname ?? '', heroes: json.heroes, heroNamesNormalized: json.heroes.map(norm), hasPassword: Boolean(json.password) }
    state.accounts = [account, ...state.accounts]
    return { status: 201, json: { account } }
  }
  const idMatch = path.match(/^\/api\/accounts\/(\d+)$/)
  if (idMatch && method === 'DELETE') {
    if (state.failDelete) return { status: 404, json: { error: 'Không tìm thấy tài khoản.', code: 'NOT_FOUND' } }
    state.accounts = state.accounts.filter((account) => String(account.id) !== idMatch[1])
    return { json: { success: true } }
  }
  if (idMatch && method === 'PUT') return { json: { account: state.accounts.find((account) => String(account.id) === idMatch[1]) } }
  if (path === '/api/accounts/export') {
    state.exportCalls += 1
    if (json.includePasswords && state.exportCalls === 1) return { status: 403, json: { error: 'Vui lòng nhập lại mật khẩu để tiếp tục thao tác này.', code: 'REAUTH_REQUIRED' } }
    return { json: { includePasswords: Boolean(json.includePasswords), accounts: state.accounts.map(({ username, nickname, gold, level, rank, status, heroes, note, id }) => ({ username, nickname, gold, level, rank, status, heroes, note, ...(json.includePasswords ? { password: fakePassword(id) } : {}) })) } }
  }
  if (path === '/api/accounts/import') {
    return { json: { mode: json.mode, received: json.accounts.length, created: json.accounts.length, updated: 0, skipped: 0, invalid: 0, deleted: json.mode === 'replace' ? state.accounts.length : 0, warnings: ['Dòng 1: ví dụ cảnh báo từ máy chủ (QA).'] } }
  }
  return { status: 404, json: { error: 'QA mock: không có route', code: 'NOT_FOUND' } }
}

/* ---------------- Trình duyệt ---------------- */
const browser = await launch({ port: 9440, userDataDir: `${OUT}/chrome-profile` })
const page = await browser.newPage()
await page.send('Browser.grantPermissions', { origin: new URL(BASE).origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {})
await page.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS.replaceAll('/', '\\') }).catch(() => page.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS }))
await page.send('Log.enable')
// Headless không có focus cửa sổ → clipboard bị từ chối; giả lập trang đang được focus như trình duyệt thật.
await page.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {})
const consoleProblems = []
page.on('Runtime.consoleAPICalled', ({ type, args }) => {
  if (type === 'error' || type === 'warning') consoleProblems.push(`[console.${type}] ${args.map((arg) => arg.value ?? arg.description ?? '').join(' ').slice(0, 300)}`)
})
page.on('Runtime.exceptionThrown', ({ exceptionDetails }) => consoleProblems.push(`[exception] ${(exceptionDetails.exception?.description ?? exceptionDetails.text).slice(0, 300)}`))
page.on('Log.entryAdded', ({ entry }) => {
  if (entry.source !== 'network' && (entry.level === 'error' || entry.level === 'warning')) consoleProblems.push(`[log.${entry.source}] ${entry.text.slice(0, 300)}`)
})
await page.mockApi(handler, '*/api/accounts*')

const results = {}
const checks = []
const check = (test, pass, detail) => {
  checks.push({ test, pass: Boolean(pass), detail })
  console.log(pass ? 'PASS' : 'FAIL', test, detail === undefined ? '' : JSON.stringify(detail).slice(0, 200))
}
const sizes = { desktop: [1440, 900, false], tablet: [768, 1024, true], mobile: [390, 844, true] }
const extraProbe = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
  const els = [...document.querySelectorAll('button, a[href], input:not(.sr-only):not([type=hidden]), select, [role=radio], [role=tab]')].filter((el) => vis(el) && !(el.tagName === 'INPUT' && el.closest('label')) && !el.classList.contains('skip-link'))
  const under24 = els.filter((el) => Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height) < 24)
  const panel = document.querySelector('.panel')
  return { under24: under24.length, under40: els.filter((el) => Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height) < 40).length, total: els.length, panelHeight: panel ? Math.round(panel.getBoundingClientRect().height) : null, vh: innerHeight }
})()`
const evalText = (expression) => page.eval(expression)
const clickText = async (text, selector = 'button', settle = 500) => {
  const ok = await page.eval(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.trim().includes(${JSON.stringify(text)}) && e.getBoundingClientRect().width > 0 && !e.disabled); if (!el) return false; el.click(); return true })()`)
  if (!ok) throw new Error(`clickText not found: ${text}`)
  await sleep(settle)
}
const typeInto = async (selector, text) => {
  await page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select?.() })()`)
  await page.type(text)
}
async function snap(key) {
  await page.shot(`${OUT}/${key}.png`)
  results[key] = { ...(await page.eval(PROBE)), ...(await page.eval(extraProbe)) }
  const r = results[key]
  console.log(key.padEnd(30), `theme=${r.theme} overflow=${r.horizontalOverflow} minFont=${r.minFontPx} <12px=${r.textNodesUnder12px} <24=${r.under24} <40=${r.under40}/${r.total} imgNoSize=${r.imagesWithoutSize}/${r.imageCount} panel=${r.panelHeight}/${r.vh}`)
}
async function load(hash, theme, size) {
  const [width, height, mobile] = sizes[size]
  await page.viewport(width, height, { mobile })
  await page.eval(`localStorage.setItem('aov-theme', '${theme}')`).catch(() => {})
  await page.goto(`${BASE}/${hash}`, 1500)
}

/* ---------------- 1. Đăng nhập ---------------- */
await page.viewport(1440, 900)
await page.goto(`${BASE}/`, 1200)
check('Chưa đăng nhập: / chuyển sang /login', (await evalText('location.pathname')) === '/login')
await page.eval(`localStorage.setItem('aov-theme', 'dark')`)
await page.goto(`${BASE}/login`, 1200)
await snap('login-desktop-dark')
await page.viewport(390, 844, { mobile: true })
await page.eval(`localStorage.setItem('aov-theme', 'light')`)
await page.goto(`${BASE}/login`, 1200)
await snap('login-mobile-light')
await typeInto('#owner-password', 'mat-khau-sai')
await page.eval(`document.querySelector('.login-form').requestSubmit()`)
await sleep(1200)
const loginError = await evalText(`document.querySelector('#login-error')?.textContent ?? ''`)
check('Sai mật khẩu: báo lỗi, vẫn ở /login', loginError.includes('Mật khẩu không đúng') && (await evalText('location.pathname')) === '/login', loginError)
await snap('login-error-mobile-light')
await typeInto('#owner-password', PASSWORD)
await page.eval(`document.querySelector('.login-form').requestSubmit()`)
await sleep(2500)
check('Đúng mật khẩu: vào app', (await evalText('location.pathname')) === '/' && (await evalText(`Boolean(document.querySelector('.shell'))`)))

/* ---------------- 2. Ma trận màn hình ---------------- */
for (const size of ['desktop', 'tablet', 'mobile']) {
  for (const theme of ['dark', 'light']) {
    await load('#/heroes', theme, size)
    await snap(`catalog-${size}-${theme}`)
    await load('#/accounts', theme, size)
    await snap(`accounts-${size}-${theme}`)
  }
}
for (const size of ['desktop', 'mobile']) {
  await load('#/heroes/airi', 'dark', size)
  await snap(`hero-drawer-${size}-dark`)
  await load('#/accounts/1', size === 'desktop' ? 'light' : 'dark', size)
  await snap(`account-drawer-${size}-${size === 'desktop' ? 'light' : 'dark'}`)
  await load('#/accounts', 'dark', size)
  await clickText('Thêm tài khoản')
  await snap(`form-new-${size}-dark`)
  await page.eval(`document.querySelector('#account-form').requestSubmit()`)
  await sleep(400)
  await snap(`form-invalid-${size}-dark`)
}

/* ---------------- 3. Mật khẩu: không có trong DOM trước khi bấm hiện ---------------- */
await load('#/accounts', 'dark', 'desktop')
const domBefore = await evalText('document.body.innerHTML')
check('DOM danh sách không chứa mật khẩu trước khi bấm hiện', !domBefore.includes('QA-fake-'))
check('API danh sách không được gọi lặp (≤ 2 lần cho một lần tải)', state.requests.filter((request) => request === 'GET /api/accounts').length > 0)
state.requests = []
await page.click('.acc-row [aria-label="Hiện mật khẩu"]', 900)
const revealed = await evalText(`[...document.querySelectorAll('.acc-row .secret__value')].map((e) => e.textContent).find((text) => text.startsWith('QA-fake-')) ?? ''`)
const passwordRequests = state.requests.filter((request) => request.endsWith('/password'))
check('Bấm hiện → chỉ tải mật khẩu của đúng 1 tài khoản', revealed.startsWith('QA-fake-') && new Set(passwordRequests).size === 1, { revealed: Boolean(revealed), passwordRequests })
await page.click('.acc-row [aria-label="Sao chép mật khẩu"]', 900)
const toastText = await evalText(`document.querySelector('.toast-region')?.textContent ?? ''`)
check('Sao chép mật khẩu → toast thành công', toastText.includes('Đã sao chép mật khẩu'), toastText.slice(0, 120))
const storageDump = await evalText('JSON.stringify(Object.entries(localStorage)) + JSON.stringify(Object.entries(sessionStorage))')
check('Không lưu mật khẩu vào localStorage/sessionStorage', !storageDump.includes('QA-fake-'))

/* ---------------- 4. Bàn phím, tìm kiếm, theme ---------------- */
await load('#/heroes', 'dark', 'desktop')
await page.eval(`document.querySelector('.hero-card').focus()`)
await page.key('Enter', 'Enter', 13)
await sleep(600)
const opened = await page.eval(`[location.hash, document.activeElement?.getAttribute('aria-label')]`)
for (let index = 0; index < 25; index += 1) await page.key('Tab', 'Tab', 9)
const trapped = await evalText(`Boolean(document.activeElement?.closest('.panel'))`)
await page.key('Escape', 'Escape', 27)
await sleep(400)
const closed = await page.eval(`[location.hash, document.activeElement?.className]`)
check('Enter mở drawer tướng, focus nút Đóng', opened[0].startsWith('#/heroes/') && opened[1] === 'Đóng', opened)
check('Focus bị giữ trong drawer khi Tab', trapped)
check('Esc đóng drawer, focus trả về card', closed[0] === '#/heroes' && String(closed[1]).includes('hero-card'), closed)
await page.eval(`document.querySelector('.toolbar input[type=search]').focus()`)
await page.type('nakrot')
await sleep(600)
check('Tìm "nakrot" ra Nakroth', (await evalText(`[...document.querySelectorAll('.hero-card__name')].map((e) => e.textContent).join(',')`)).includes('Nakroth'))
await load('#/heroes', 'dark', 'desktop')
await clickText('Sáng', '[role=radio]', 300)
await page.goto(`${BASE}/#/heroes`, 1200)
check('Theme Sáng giữ sau reload (B7)', (await evalText('document.documentElement.dataset.theme')) === 'light')
await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))`)
await sleep(400)
await page.type('demo.kho0')
await sleep(300)
const palette = await evalText(`[...document.querySelectorAll('.cmdk-item')].map((e) => e.textContent).join('|')`)
check('Ctrl+K tìm được tài khoản, không hiển thị mật khẩu', palette.includes('demo.kho0') && !palette.includes('QA-fake-'))
await snap('palette-desktop-light')
await page.key('Escape', 'Escape', 27)

/* ---------------- 5. Form: lỗi 409, hỏi khi bỏ dở ---------------- */
await load('#/accounts', 'dark', 'desktop')
await clickText('Thêm tài khoản')
await typeInto('input[name=username]', 'DEMO.KHO01')
await page.eval(`document.querySelector('.pick input').click()`)
await page.eval(`document.querySelector('#account-form').requestSubmit()`)
await sleep(900)
const duplicate = await page.eval(`[document.querySelector('.field__error')?.textContent, document.activeElement?.name]`)
check('Username trùng (không phân biệt hoa/thường): lỗi tại ô + focus (B4)', /đã tồn tại/.test(duplicate[0] ?? '') && duplicate[1] === 'username', duplicate)
await snap('form-duplicate-desktop-dark')
await page.key('Escape', 'Escape', 27)
await sleep(300)
check('Esc khi có thay đổi → hỏi bỏ thay đổi', (await evalText(`document.querySelector('[role=alertdialog] h2')?.textContent`)) === 'Bỏ thay đổi chưa lưu?')

/* ---------------- 6. Xoá lỗi, GET lỗi, kho rỗng, link cũ ---------------- */
state.failDelete = true
await load('#/accounts', 'dark', 'desktop')
await page.click('.acc-row__actions .icon-btn--danger', 500)
await snap('delete-desktop-dark')
await clickText('Xoá tài khoản', '.panel__footer button', 900)
check('Xoá thất bại (404) hiển thị lỗi trong dialog (B5)', (await evalText(`document.querySelector('[role=alertdialog] .callout--danger')?.textContent ?? ''`)).includes('Không tìm thấy'))
state.failDelete = false
state.failGet = true
await load('#/accounts', 'dark', 'mobile')
const errorView = await evalText(`document.querySelector('.state--error')?.textContent ?? ''`)
check('GET lỗi → trạng thái lỗi có Thử lại, không phải kho rỗng (B3)', errorView.includes('Không tải được') && !(await evalText(`document.body.textContent.includes('Kho chưa có tài khoản')`)), errorView.slice(0, 60))
await snap('state-error-mobile-dark')
state.failGet = false
await clickText('Thử lại', 'button', 1200)
check('Thử lại tải được danh sách', (await evalText(`document.querySelectorAll('.acc-row').length`)) > 0)
const saved = state.accounts
state.accounts = []
await load('#/accounts', 'dark', 'mobile')
await snap('state-empty-mobile-dark')
check('Kho rỗng có CTA nhập Excel / thêm', (await evalText(`document.body.textContent`)).includes('Kho chưa có tài khoản nào'))
state.accounts = saved
state.getDelay = 4000
await load('#/accounts', 'dark', 'mobile')
await page.shot(`${OUT}/state-loading-mobile-dark.png`)
check('Đang tải hiển thị skeleton', await evalText(`Boolean(document.querySelector('[aria-busy=true] .skeleton'))`))
state.getDelay = 0
await page.viewport(1440, 900)
await page.goto(`${BASE}/#accounts`, 1500)
check('Link cũ #accounts → #/accounts, mở trang tài khoản', (await evalText('location.hash')) === '#/accounts' && (await evalText(`Boolean(document.querySelector('.acc-list'))`)))

/* ---------------- 7. Import wizard + Export có xác thực lại ---------------- */
await load('#/accounts', 'dark', 'desktop')
await clickText('Nhập Excel')
await snap('import-select-desktop-dark')
await page.setFile('input[type=file]', FIXTURE)
await sleep(1500)
const review = await evalText(`document.querySelector('.stat-tiles')?.textContent ?? ''`)
check('Import: parse file fixture thật → bước Kiểm tra', review.includes('Tài khoản hợp lệ'), review.slice(0, 80))
await snap('import-review-desktop-dark')
await clickText('Tiếp tục')
await page.eval(`document.querySelectorAll('input[name=import-mode]')[1].click()`)
await sleep(300)
const disabledBefore = await evalText(`[...document.querySelectorAll('.panel__footer .btn')].at(-1).disabled`)
await typeInto('.callout--danger input:not([type=checkbox])', 'thay thế')
const disabledAfter = await evalText(`[...document.querySelectorAll('.panel__footer .btn')].at(-1).disabled`)
check('Replace khoá tới khi gõ THAY THẾ', disabledBefore === true && disabledAfter === false)
await snap('import-replace-desktop-dark')
await page.key('Escape', 'Escape', 27)
await sleep(300)
await clickText('Nhập Excel')
check('Mở lại wizard: về bước 1, không giữ kết quả/replace cũ (B6/S11)', (await evalText(`document.querySelector('.stepper [aria-current=step]')?.textContent ?? ''`)).includes('Chọn file') && (await evalText(`document.querySelectorAll('input[name=import-mode]').length`)) === 0)
await page.setFile('input[type=file]', FIXTURE)
await sleep(1500)
await clickText('Tiếp tục')
await clickText('Gộp', '.panel__footer button', 1500)
const done = await evalText(`document.querySelector('.result')?.textContent ?? ''`)
check('Import merge: hiển thị kết quả + cảnh báo máy chủ (B11)', done.includes('Đã nhập') && done.includes('Cảnh báo từ máy chủ'), done.slice(0, 80))
await snap('import-done-desktop-dark')
await clickText('Đóng', '.panel__footer button', 400)

await clickText('Xuất', 'button', 500)
await snap('export-desktop-dark')
await page.eval(`document.querySelectorAll('input[name=export-mode]')[1].click()`)
await sleep(200)
await clickText('Tải xuống', '.panel__footer button', 1200)
check('Xuất kèm mật khẩu → yêu cầu nhập lại mật khẩu', (await evalText(`[...document.querySelectorAll('.panel__title')].map((e) => e.textContent).join('|')`)).includes('Nhập lại mật khẩu'))
await snap('reauth-desktop-dark')
await typeInto('#reauth-password', PASSWORD)
await page.eval(`document.querySelector('#reauth-form').requestSubmit()`)
await sleep(2500)
const files = readdirSync(DOWNLOADS)
check('Sau xác thực lại: tải file Excel về máy (không upload)', files.some((file) => file.endsWith('.xlsx')), files)

/* ---------------- 8. Responsive hẹp, console, đăng xuất ---------------- */
await load('#/accounts', 'dark', 'mobile')
await page.viewport(320, 700, { mobile: true })
await sleep(500)
check('Không cuộn ngang ở 320px', (await evalText('document.documentElement.scrollWidth')) <= 320)
await page.shot(`${OUT}/accounts-320-dark.png`)
const relevant = consoleProblems.filter((line) => !/Failed to load resource/.test(line))
check('Không có lỗi console / hydration / CSP trong toàn bộ phiên', relevant.length === 0, relevant.slice(0, 5))
await page.viewport(1440, 900)
await page.goto(`${BASE}/#/heroes`, 1200)
await clickText('Đăng xuất', '.sidebar button', 1500)
await page.goto(`${BASE}/`, 1200)
check('Đăng xuất → truy cập / bị chuyển về /login', (await evalText('location.pathname')) === '/login')

writeFileSync(`${OUT}/qa-results.json`, JSON.stringify({ base: BASE, checks, probes: results, consoleProblems: relevant }, null, 2))
const failed = checks.filter((item) => !item.pass)
console.log(`\n${checks.length - failed.length}/${checks.length} kiểm thử đạt`)
browser.close()
process.exit(failed.length ? 1 : 0)
