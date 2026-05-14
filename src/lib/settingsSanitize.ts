/**
 * Chuẩn hóa URL người dùng hay dán nhầm (ngoặc quanh URL, khoảng trắng).
 */
export function stripWrappingParens(s: string): string {
  let t = s.trim()
  while (t.length >= 2 && t.startsWith('(') && t.endsWith(')')) {
    t = t.slice(1, -1).trim()
  }
  return t
}

export function normalizeDictionaryUrlTemplate(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  return stripWrappingParens(raw)
}

/** Proxy dịch: chỉ trim; không đổi nội dung (tránh “sửa” URL sai thành URL sai khác). */
export function normalizeTranslateProxyBase(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  return raw.trim().replace(/\/$/, '')
}

/** Endpoint Translator từ Portal (chỉ gốc, không kèm path). Dùng khi resource là *.cognitiveservices.azure.com. */
export function normalizeAzureTranslatorEndpoint(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  let t = stripWrappingParens(raw).trim()
  while (t.endsWith('/')) t = t.slice(0, -1).trim()
  if (!/^https?:\/\//i.test(t)) t = `https://${t}`
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined
    return u.origin
  } catch {
    return undefined
  }
}
  const u = url.toLowerCase()
  return (
    u.includes('dictionaryapi.dev') ||
    u.includes('/api/v2/entries') ||
    u.includes('/entries/en/') ||
    u.includes('<word>')
  )
}
