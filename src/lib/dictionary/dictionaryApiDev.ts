import type { WordEntry, WordSense } from '../../types/storage'
import type { DictionaryLookupInput, DictionaryProvider } from './types'

/** Free Dictionary API — https://dictionaryapi.dev */
const BASE = 'https://api.dictionaryapi.dev/api/v2/entries'

type ApiMeaning = {
  partOfSpeech?: string
  definitions?: { definition?: string; example?: string }[]
}

type ApiEntry = {
  word: string
  phonetics?: { text?: string; audio?: string }[]
  meanings?: ApiMeaning[]
}

function mapEntry(json: ApiEntry[], query: string): WordEntry {
  const first = json[0]
  const ipa =
    first?.phonetics?.map((p) => p.text).find(Boolean) ??
    first?.phonetics?.find((p) => p.audio)?.text

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
    senses,
    providerId: 'dictionarypi-dev',
  }
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
