// Minimal Chrome DevTools Protocol driver (no dependencies, Node >= 22).
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launch({ port = 9333, userDataDir }) {
  mkdirSync(userDataDir, { recursive: true })
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
    '--disable-extensions', '--mute-audio', 'about:blank',
  ], { stdio: 'ignore' })
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) break
    } catch { /* not ready */ }
    await sleep(250)
  }
  return {
    port,
    proc,
    async newPage() {
      const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
      const target = await res.json()
      const page = new Page(target.webSocketDebuggerUrl)
      await page.ready
      await page.send('Page.enable')
      await page.send('Runtime.enable')
      return page
    },
    close() { proc.kill() },
  }
}

export class Page {
  constructor(wsUrl) {
    this.id = 0
    this.pending = new Map()
    this.listeners = new Map()
    this.ws = new WebSocket(wsUrl)
    this.ready = new Promise((resolve) => this.ws.addEventListener('open', resolve))
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.data ?? ''})`))
        else resolve(msg.result)
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params)
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, [])
    this.listeners.get(method).push(fn)
  }

  async viewport(width, height, { mobile = false, scale = 1 } = {}) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile })
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: mobile })
  }

  async colorScheme(value) {
    await this.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] })
  }

  async goto(url, settle = 1200) {
    // Force a real document load even when only the hash differs.
    await this.send('Page.navigate', { url: 'about:blank' })
    await sleep(150)
    const loaded = new Promise((resolve) => this.on('Page.loadEventFired', resolve))
    await this.send('Page.navigate', { url })
    await Promise.race([loaded, sleep(30000)])
    await sleep(settle)
  }

  async eval(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true,
    })
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    return result.value
  }

  async click(selector, settle = 400) {
    const ok = await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true })()`)
    if (!ok) throw new Error(`click: not found ${selector}`)
    await sleep(settle)
  }

  async key(key, code = key, keyCode = 0) {
    const text = key === 'Enter' ? '\r' : undefined
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, text })
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode })
    await sleep(150)
  }

  async type(text) {
    await this.send('Input.insertText', { text })
    await sleep(300)
  }

  async shot(file, { fullPage = false } = {}) {
    mkdirSync(path.dirname(file), { recursive: true })
    const params = { format: 'png' }
    if (fullPage) {
      const { cssContentSize } = await this.send('Page.getLayoutMetrics')
      params.captureBeyondViewport = true
      params.clip = { x: 0, y: 0, width: cssContentSize.width, height: Math.min(cssContentSize.height, 6000), scale: 1 }
    }
    const { data } = await this.send('Page.captureScreenshot', params)
    writeFileSync(file, Buffer.from(data, 'base64'))
  }

  async setFile(selector, filePath) {
    const { root } = await this.send('DOM.getDocument', { depth: -1, pierce: true })
    const { nodeId } = await this.send('DOM.querySelector', { nodeId: root.nodeId, selector })
    if (!nodeId) throw new Error('setFile: not found ' + selector)
    await this.send('DOM.setFileInputFiles', { nodeId, files: [filePath] })
    await sleep(400)
  }

  // Intercept /api/* and answer with a handler: ({ method, url, body }) => { status, json }
  async mockApi(handler, urlPattern = '*/api/*') {
    await this.send('Fetch.enable', { patterns: [{ urlPattern, requestStage: 'Request' }] })
    this.on('Fetch.requestPaused', async ({ requestId, request }) => {
      const { status = 200, json = {}, delay = 0 } = await handler({
        method: request.method, url: request.url, body: request.postData,
      })
      if (delay) await sleep(delay)
      try {
        await this.send('Fetch.fulfillRequest', {
          requestId, responseCode: status,
          responseHeaders: [{ name: 'content-type', value: 'application/json; charset=utf-8' }],
          body: Buffer.from(JSON.stringify(json)).toString('base64'),
        })
      } catch {
        // Request bị trình duyệt huỷ trong lúc trễ (điều hướng sang trang khác) → bỏ qua.
      }
    })
  }
}

// Layout/a11y probes evaluated in the page.
export const PROBE = `(() => {
  const vw = innerWidth
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const interactive = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), [role=button], label.hero-checkbox')].filter(visible)
  const small = interactive.filter((el) => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height) < 40 })
  const texts = [...document.querySelectorAll('body *')].filter((el) => visible(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
  const sizes = texts.map((el) => parseFloat(getComputedStyle(el).fontSize))
  const tiny = texts.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12)
  const imgs = [...document.querySelectorAll('img')]
  return {
    viewport: vw,
    horizontalOverflow: document.documentElement.scrollWidth > vw + 1,
    scrollWidth: document.documentElement.scrollWidth,
    interactiveCount: interactive.length,
    smallTargets: small.length,
    smallTargetExamples: [...new Set(small.slice(0, 40).map((el) => (el.getAttribute('aria-label') || el.className || el.tagName).toString().slice(0, 40)))].slice(0, 8),
    minFontPx: Math.min(...sizes),
    textNodesUnder12px: tiny.length,
    tinyExamples: [...new Set(tiny.slice(0, 60).map((el) => el.className?.toString().slice(0, 30) + ':' + getComputedStyle(el).fontSize))].slice(0, 8),
    imagesWithoutSize: imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length,
    imageCount: imgs.length,
    pageHeight: document.documentElement.scrollHeight,
    theme: document.documentElement.dataset.theme ?? null,
  }
})()`
