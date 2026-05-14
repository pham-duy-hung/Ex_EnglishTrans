/**
 * Dictionary providers (spec):
 * - dictionarypi-dev: Free Dictionary API — https://dictionaryapi.dev
 * - custom-rest: User HTTPS endpoint; URL template with {{word}} or {{raw}}; JSON → WordEntry
 */
export const DICTIONARY_PROVIDER_IDS = ['dictionarypi-dev', 'custom-rest'] as const
