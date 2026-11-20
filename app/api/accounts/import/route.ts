import { requireOwner } from '../../../../src/lib/auth/guard'
import { errorResponse, json, readJson } from '../../../../src/lib/http'
import { IMPORT_LIMITS, parseImportRequest, runImport, type ImportDb } from '../../../../src/lib/import-service'
import { prisma } from '../../../../src/lib/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const basic = await requireOwner(request, { write: true })
  if (!basic.ok) return basic.response
  try {
    const importRequest = parseImportRequest(await readJson(request, IMPORT_LIMITS.maxBodyBytes))
    if (importRequest.mode === 'replace') {
      // Thay thế toàn bộ kho: bắt buộc vừa nhập lại mật khẩu.
      const strict = await requireOwner(request, { write: true, recentAuth: true })
      if (!strict.ok) return strict.response
    }
    const summary = await runImport(prisma as unknown as ImportDb, importRequest)
    return json(summary)
  } catch (error) {
    return errorResponse(error, 'accounts:import')
  }
}
