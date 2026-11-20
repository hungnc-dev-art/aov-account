/**
 * Sao chép văn bản có thể cần tải trước (mật khẩu lấy từ API).
 * Dùng ClipboardItem với Promise khi được hỗ trợ để giữ "user activation" trên Safari.
 */
export async function copyText(source: string | (() => Promise<string>)): Promise<void> {
  if (typeof source === 'string') {
    await navigator.clipboard.writeText(source)
    return
  }
  if (typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function') {
    const blob = source().then((value) => new Blob([value], { type: 'text/plain' }))
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
    return
  }
  await navigator.clipboard.writeText(await source())
}
