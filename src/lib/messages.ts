import type { TranslateIpaWordRow } from '../types/storage'

export const MSG = {
  /** Content script: bật chế độ bôi đen (con trỏ kính lúp / zoom-in). */
  START_PICK_MODE: 'START_PICK_MODE',
  LOOKUP_DICTIONARY: 'LOOKUP_DICTIONARY',
  TRANSLATE_OPEN_PANEL: 'TRANSLATE_OPEN_PANEL',
  /** Background → content: hiện kết quả dịch trên trang (Edge có thể không hiện Side panel). */
  TRANSLATE_RESULT_TO_TAB: 'TRANSLATE_RESULT_TO_TAB',
  OPEN_OPTIONS: 'OPEN_OPTIONS',
  SAVE_WORDBOOK_FROM_CONTENT: 'SAVE_WORDBOOK_FROM_CONTENT',
} as const

/** Tin nhắn từ service worker tới content script (không gửi vào `BackgroundMessage`). */
export type TranslateResultToTabMessage = {
  type: typeof MSG.TRANSLATE_RESULT_TO_TAB
  query: string
  translatedText?: string
  error?: string
  pageUrl?: string
  ipaByWord?: TranslateIpaWordRow[]
}

export type LookupDictionaryMessage = {
  type: typeof MSG.LOOKUP_DICTIONARY
  query: string
  pageUrl: string
  contextSentence?: string
}

export type TranslateOpenPanelMessage = {
  type: typeof MSG.TRANSLATE_OPEN_PANEL
  text: string
  pageUrl: string
  contextSentence?: string
}

export type SaveWordbookMessage = {
  type: typeof MSG.SAVE_WORDBOOK_FROM_CONTENT
  wordEntry: import('../types/storage').WordEntry
  contextSentence?: string
  sourceUrl?: string
}

export type BackgroundMessage =
  | LookupDictionaryMessage
  | TranslateOpenPanelMessage
  | SaveWordbookMessage
