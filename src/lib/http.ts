// Phản hồi JSON và xử lý lỗi dùng chung cho Route Handler.
// Không bao giờ trả message nội bộ (Prisma, JSON.parse, driver) cho client.

export class HttpError extends Error {
  readonly status: number
  readonly code: string
  readonly headers?: Record<string, string>

  constructor(status: number, code: string, message: string, headers?: Record<string, string>) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.headers = headers
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(400, code, message)
    this.name = 'ValidationError'
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, code = 'CONFLICT') {
    super(409, code, message)
    this.name = 'ConflictError'
  }
}

export const NO_STORE = 'no-store, max-age=0'

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('cache-control', NO_STORE)
  return Response.json(data, { ...init, headers })
}

export function jsonError(status: number, code: string, message: string, headers?: Record<string, string>): Response {
  return json({ error: message, code }, { status, headers })
}

const encoder = new TextEncoder()

/** Đọc body JSON có giới hạn kích thước; lỗi parse trả message chung. */
export async function readJson(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên quá lớn.')
  }
  const text = await request.text()
  if (encoder.encode(text).byteLength > maxBytes) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên quá lớn.')
  }
  if (!text.trim()) throw new ValidationError('Thiếu dữ liệu gửi lên.')
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ValidationError('Dữ liệu gửi lên không phải JSON hợp lệ.')
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Mã lỗi Prisma (P2002, P2025…) nếu có, không phụ thuộc class generated. */
export function prismaErrorCode(error: unknown): string | undefined {
  if (!isRecord(error) && !(error instanceof Error)) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : undefined
}

/** Log an toàn: chỉ tên lỗi và mã, không message, không dữ liệu người dùng. */
export function logSafe(scope: string, error: unknown, meta: Record<string, string | number | boolean> = {}): void {
  console.error(`[${scope}]`, {
    name: error instanceof Error ? error.name : typeof error,
    code: prismaErrorCode(error) ?? (error instanceof HttpError ? error.code : undefined),
    ...meta,
  })
}

export function errorResponse(error: unknown, scope: string): Response {
  if (error instanceof HttpError) {
    return jsonError(error.status, error.code, error.message, error.headers)
  }
  const code = prismaErrorCode(error)
  if (code === 'P2002') return jsonError(409, 'USERNAME_TAKEN', 'Tên đăng nhập đã tồn tại.')
  if (code === 'P2025') return jsonError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản.')
  logSafe(scope, error)
  return jsonError(500, 'INTERNAL_ERROR', 'Máy chủ gặp lỗi. Dữ liệu chưa bị thay đổi, vui lòng thử lại sau.')
}
