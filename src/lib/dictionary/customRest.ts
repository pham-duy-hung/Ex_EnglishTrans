import type { WordEntry } from '../../types/storage'
import type { DictionaryLookupInput, DictionaryProvider } from './types'

function applyTemplate(tpl: string, word: string): string {
  return tpl.replaceAll('{{word}}', encodeURIComponent(word)).replaceAll('{{raw}}', word)
}

/**
 * Custom REST dictionary (plan: adapter + optional Custom URL).
 * - If URL contains `{{word}}` or `{{raw}}`, substitutes the selected token (trimmed).
 * - Expects JSON: either a full `WordEntry`, or `{ word, ipa, senses: [...] }` minimal shape.
 */
export class CustomRestDictionaryProvider implements DictionaryProvider {
  readonly id = 'custom-rest' as const

  constructor(private readonly urlTemplate: string) {}

  async lookup(input: DictionaryLookupInput): Promise<WordEntry> {
    const q = input.query.trim()
    const url = applyTemplate(this.urlTemplate, q)
    try {
      new URL(url)
    } catch {
      throw new Error(
        'URL từ điển tùy chỉnh không hợp lệ. Bỏ ngoặc () quanh URL, dùng {{word}} hoặc {{raw}} (không dùng <word>).',
      )
    }
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          'Không có mục từ điển (404). Kiểm tra URL template / từ tra; với DictionaryAPI chỉ tra được **một từ** tiếng Anh.',
        )
      }
      throw new Error(`Custom dictionary ${res.status}`)
    }
    const data = (await res.json()) as unknown
    if (isWordEntry(data)) {
      return { ...data, providerId: 'custom-rest' }
    }
    if (isMinimal(data)) {
      return {
        word: data.word,
        ipa: data.ipa,
        senses: data.senses,
        providerId: 'custom-rest',
      }
    }
    throw new Error('Unrecognized custom dictionary JSON')
  }
}

function isWordEntry(x: unknown): x is WordEntry {
  if (!x || typeof x !== 'object') return false
  const o = x as WordEntry
  return (
    typeof o.word === 'string' &&
    Array.isArray(o.senses) &&
    typeof o.providerId === 'string'
  )
}

function isMinimal(x: unknown): x is Pick<WordEntry, 'word' | 'ipa' | 'senses'> {
  if (!x || typeof x !== 'object') return false
  const o = x as { word?: unknown; senses?: unknown }
  return typeof o.word === 'string' && Array.isArray(o.senses)
}
