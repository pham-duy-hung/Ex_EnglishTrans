import type { TranslateIpaWordRow, WordEntry, WordSense } from '../../types/storage'
import type { DictionaryLookupInput, DictionaryProvider } from './types'
import { extractGbUsIpaFromPhonetics } from './phoneticsGbUs'

/** Free Dictionary API — https://dictionaryapi.dev */
const BASE = 'https://api.dictionaryapi.dev/api/v2/entries'

type ApiMeaning = {
  partOfSpeech?: string
  definitions?: { definition?: string; example?: string }[]
}

type ApiEntry = {
  word: string
  phonetic?: string
  phonetics?: { text?: string; audio?: string }[]
  meanings?: ApiMeaning[]
}

function mapEntry(json: ApiEntry[], query: string): WordEntry {
  const first = json[0]
  const gbUs = extractGbUsIpaFromPhonetics(first?.phonetics, first?.phonetic)
  const fallbackIpa =
    first?.phonetics?.map((p) => p.text).find(Boolean) ??
    first?.phonetics?.find((p) => p.audio)?.text ??
    first?.phonetic
  const ipa =
    gbUs.gb && gbUs.us && gbUs.gb !== gbUs.us
      ? `${gbUs.gb} · ${gbUs.us}`
      : (gbUs.gb ?? gbUs.us ?? fallbackIpa?.trim() ?? undefined)

  const senses: WordSense[] =
    first?.meanings?.map((m) => {
      const defs = (m.definitions ?? [])
        .map((d) => d.definition)
        .filter((x): x is string => Boolean(x))
      const examples = (m.definitions ?? [])
        .map((d) => d.example)
        .filter((x): x is string => Boolean(x))
      return {
        partOfSpeech: m.partOfSpeech,
        definitions: defs,
        examples: examples.length ? examples : undefined,
      }
    }) ?? []

  return {
    word: first?.word ?? query,
    ipa: ipa || undefined,
    ipaGb: gbUs.gb,
    ipaUs: gbUs.us,
    senses,
    providerId: 'dictionarypi-dev',
  }
}

/** Gọi DictionaryAPI (chỉ từ đơn) — dùng sau dịch cụm để gắn IPA GB/US. */
export async function fetchEnglishWordGbUsIpaFromApi(
  word: string,
  signal?: AbortSignal,
): Promise<{ gb?: string; us?: string } | null> {
  const tokenForUrl = word.trim().toLowerCase().split(/\s+/)[0] ?? ''
  if (!tokenForUrl) return null
  const url = `${BASE}/en/${encodeURIComponent(tokenForUrl)}`
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = (await res.json()) as ApiEntry[]
    if (!Array.isArray(data) || !data.length) return null
    const first = data[0]
    return extractGbUsIpaFromPhonetics(first.phonetics, first.phonetic)
  } catch {
    return null
  }
}

export async function fetchEnglishWordsGbUsIpaRows(
  tokens: string[],
  signal?: AbortSignal,
): Promise<TranslateIpaWordRow[]> {
  const pairs = await Promise.all(
    tokens.map(async (w) => {
      const ip = await fetchEnglishWordGbUsIpaFromApi(w, signal)
      return { w, ip } as const
    }),
  )
  const out: TranslateIpaWordRow[] = []
  for (const { w, ip } of pairs) {
    if (!ip?.gb && !ip?.us) continue
    out.push({ word: w, gb: ip.gb, us: ip.us })
  }
  return out
}

export class DictionaryApiDevProvider implements DictionaryProvider {
  readonly id = 'dictionarypi-dev' as const

  async lookup(input: DictionaryLookupInput): Promise<WordEntry> {
    const lang = input.language ?? 'en'
    const q = input.query.trim().toLowerCase()
    const tokenForUrl = q.split(/\s+/)[0] ?? q
    const url = `${BASE}/${encodeURIComponent(lang)}/${encodeURIComponent(tokenForUrl)}`
    let res: Response
    try {
      res = await fetch(url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(
        msg === 'Failed to fetch'
          ? 'Không gọi được DictionaryAPI (mạng, DNS hoặc máy chủ). Kiểm tra kết nối hoặc thử lại sau.'
          : `Lỗi mạng từ điển: ${msg}`,
      )
    }
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          'Không có mục từ điển cho từ này (404). Thử một từ tiếng Anh khác, hoặc bôi đen từ 2 từ trở lên để dịch (Side panel).',
        )
      }
      throw new Error(`Dictionary API ${res.status}`)
    }
    const data = (await res.json()) as ApiEntry[]
    if (!Array.isArray(data) || !data.length) {
      throw new Error('Empty dictionary response')
    }
    return mapEntry(data, input.query)
  }
}
