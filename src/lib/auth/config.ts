// Cấu hình xác thực chủ sở hữu. Chỉ đọc từ biến môi trường phía server.

export const SESSION_TTL_SECONDS = 12 * 60 * 60
/** Thao tác nguy hiểm (replace, export kèm mật khẩu) cần đã nhập mật khẩu trong 5 phút. */
export const REAUTH_WINDOW_SECONDS = 5 * 60
export const MIN_SECRET_LENGTH = 32

export interface AuthConfig {
  secret: string
  ownerPasswordHash: string
}

/** Trả `null` khi thiếu hoặc sai cấu hình → mọi route bảo vệ đều từ chối (fail closed). */
export function getAuthConfig(): AuthConfig | null {
  // Trim: giá trị dán/pipe vào Vercel CLI có thể kèm xuống dòng.
  const secret = (process.env.AUTH_SESSION_SECRET ?? '').trim()
  const ownerPasswordHash = (process.env.AUTH_OWNER_PASSWORD_HASH ?? '').trim()
  if (secret.length < MIN_SECRET_LENGTH || !ownerPasswordHash.startsWith('scrypt$')) return null
  return { secret, ownerPasswordHash }
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}
