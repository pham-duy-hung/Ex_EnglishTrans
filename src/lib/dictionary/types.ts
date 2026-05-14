import type { WordEntry } from '../../types/storage'

export interface DictionaryLookupInput {
  query: string
  language?: string
}

export interface DictionaryProvider {
  readonly id: string
  lookup(input: DictionaryLookupInput): Promise<WordEntry>
}
