/**
 * Storage / domain types — History, Wordbook, Settings (no offline API cache).
 */

export type LookupKind = 'dictionary' | 'translate'

export interface WordSense {
  partOfSpeech?: string
  definitions: string[]
  examples?: string[]
}

/** Normalized dictionary result (multiple providers map into this). */
export interface WordEntry {
  word: string
  ipa?: string
  senses: WordSense[]
  providerId: string
  rawNote?: string
}

export interface HistoryItem {
  id: string
  kind: LookupKind
  query: string
  title: string
  summary: string
  url?: string
  contextSentence?: string
  createdAt: number
  /** Short snapshot for display (not a full API cache layer). */
  snapshot?: unknown
}

export interface WordbookEntry {
  id: string
  wordEntry: WordEntry
  contextSentence?: string
  sourceUrl?: string
  createdAt: number
}

export type DictionaryProviderId = 'dictionarypi-dev' | 'custom-rest'

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  dictionaryProvider: DictionaryProviderId
  /** Base URL for custom REST dictionary adapter (user-defined). */
  customDictionaryUrlTemplate?: string
  /**
   * Tùy chọn: backend proxy của bạn — POST /translate (JSON giống extension).
   */
  translateProxyUrl?: string
  /**
   * Microsoft Translator (Azure Cognitive Services) — subscription key.
   * Lưu sync; chỉ nên dùng extension cá nhân (key có thể bị trích từ gói).
   */
  azureTranslatorKey?: string
  /**
   * Vùng resource (vd. eastus, japaneast). Để trống hoặc `global` = endpoint global.
   * Nhiều resource bắt buộc header Ocp-Apim-Subscription-Region — khi đó điền đúng region từ Azure Portal.
   */
  azureTranslatorRegion?: string
  sourceLanguage: string
  targetLanguage: string
  defaultVoice: 'en-US' | 'en-GB'
  historyRetentionDays: number
}

export interface TranslateProxyRequest {
  text: string
  sourceLang?: string | null
  targetLang: string
}

export interface TranslateProxyResponse {
  translatedText: string
  detectedSourceLang?: string
}

export interface TranslateSessionState {
  status: 'loading' | 'done' | 'error'
  /** true = vừa nhấn icon, đang chờ user bôi đen (chưa gọi API). */
  awaitingSelection?: boolean
  query: string
  pageUrl?: string
  translatedText?: string
  error?: string
  updatedAt: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  dictionaryProvider: 'dictionarypi-dev',
  customDictionaryUrlTemplate: undefined,
  translateProxyUrl: undefined,
  azureTranslatorKey: undefined,
  azureTranslatorRegion: undefined,
  sourceLanguage: 'auto',
  targetLanguage: 'vi',
  defaultVoice: 'en-US',
  historyRetentionDays: 30,
}
