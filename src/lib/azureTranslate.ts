import type { AppSettings, TranslateProxyRequest, TranslateProxyResponse } from '../types/storage'

const API_VERSION = '3.0'

/** Endpoint global hoặc theo vùng (Azure Portal → Keys and Endpoint → Region / Location). */
export function getAzureTranslatorBaseUrl(region?: string): string {
  const r = region?.trim().toLowerCase()
  if (!r || r === 'global') {
    return 'https://api.cognitive.microsofttranslator.com'
  }
  return `https://${r}.api.cognitive.microsofttranslator.com`
}

type AzureTranslateResponseItem = {
  detectedLanguage?: { language: string; score?: number }
  translations?: { text: string; to: string }[]
}

/**
 * Microsoft Translator (Azure Cognitive Services) Text API v3.
 * Miễn phí F0: ~2M ký tự/tháng (theo hạn mức Azure).
 * Key + region lấy từ Azure Portal; gọi từ service worker (chỉ nên dùng extension cá nhân).
 */
export async function translateWithAzure(
  settings: AppSettings,
  body: TranslateProxyRequest,
): Promise<TranslateProxyResponse> {
  const key = settings.azureTranslatorKey?.trim()
  if (!key) {
    throw new Error('Thiếu Azure Translator subscription key trong Options.')
  }

  const to = (body.targetLang || 'vi').trim()
  const params = new URLSearchParams({
    'api-version': API_VERSION,
    to,
  })
  if (body.sourceLang && String(body.sourceLang).toLowerCase() !== 'auto') {
    params.set('from', String(body.sourceLang).trim())
  }

  const base = getAzureTranslatorBaseUrl(settings.azureTranslatorRegion)
  const url = `${base.replace(/\/$/, '')}/translate?${params.toString()}`

  const headers: Record<string, string> = {
    'Ocp-Apim-Subscription-Key': key,
    'Content-Type': 'application/json; charset=UTF-8',
  }
  const regionHdr = settings.azureTranslatorRegion?.trim()
  if (regionHdr && regionHdr.toLowerCase() !== 'global') {
    headers['Ocp-Apim-Subscription-Region'] = regionHdr
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify([{ Text: body.text }]),
  })

  const rawText = await res.text()
  let data: unknown
  try {
    data = JSON.parse(rawText) as unknown
  } catch {
    if (!res.ok) {
      throw new Error(rawText.slice(0, 200) || `Azure Translator ${res.status}`)
    }
    throw new Error('Azure Translator: phản hồi không phải JSON.')
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data
        ? JSON.stringify((data as { error: unknown }).error)
        : rawText.slice(0, 400)
    throw new Error(`Azure Translator ${res.status}: ${msg}`)
  }

  const arr = data as AzureTranslateResponseItem[]
  const first = Array.isArray(arr) ? arr[0] : undefined
  const line = first?.translations?.[0]?.text
  if (!line) {
    throw new Error('Azure Translator: không có bản dịch trong phản hồi.')
  }

  return {
    translatedText: line,
    detectedSourceLang: first?.detectedLanguage?.language,
  }
}
