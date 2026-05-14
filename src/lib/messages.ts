export const MSG = {
  /** Content script: bật chế độ bôi đen (con trỏ kính lúp / zoom-in). */
  START_PICK_MODE: 'START_PICK_MODE',
  LOOKUP_DICTIONARY: 'LOOKUP_DICTIONARY',
  TRANSLATE_OPEN_PANEL: 'TRANSLATE_OPEN_PANEL',
  OPEN_OPTIONS: 'OPEN_OPTIONS',
  SAVE_WORDBOOK_FROM_CONTENT: 'SAVE_WORDBOOK_FROM_CONTENT',
} as const

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
