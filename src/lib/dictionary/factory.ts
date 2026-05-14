import type { AppSettings } from '../../types/storage'
import { DEFAULT_SETTINGS } from '../../types/storage'
import { CustomRestDictionaryProvider } from './customRest'
import { DictionaryApiDevProvider } from './dictionaryApiDev'
import type { DictionaryProvider } from './types'
import {
  isLikelyDictionaryUrlNotTranslateProxy,
  normalizeDictionaryUrlTemplate,
  normalizeTranslateProxyBase,
} from '../settingsSanitize'
import { DEFAULT_DICTIONARY_CUSTOM_URL_TEMPLATE } from '../defaults'

const builtin = new DictionaryApiDevProvider()

export function getDictionaryProvider(settings: AppSettings): DictionaryProvider {
  if (settings.dictionaryProvider === 'custom-rest') {
    const tpl =
      normalizeDictionaryUrlTemplate(settings.customDictionaryUrlTemplate) ??
      DEFAULT_DICTIONARY_CUSTOM_URL_TEMPLATE
    // Free Dictionary (DictionaryAPI.dev) chỉ **một từ** trong path; CustomRest thay {{word}}=cả cụm → 404.
    if (isLikelyDictionaryUrlNotTranslateProxy(tpl)) {
      return builtin
    }
    return new CustomRestDictionaryProvider(tpl)
  }
  return builtin
}

export async function loadSettings(): Promise<AppSettings> {
  const { settings } = await chrome.storage.sync.get('settings')
  const merged = { ...DEFAULT_SETTINGS, ...(settings as AppSettings | undefined) }
  const azureKey = merged.azureTranslatorKey?.trim()
  const azureReg = merged.azureTranslatorRegion?.trim()
  return {
    ...merged,
    customDictionaryUrlTemplate: normalizeDictionaryUrlTemplate(merged.customDictionaryUrlTemplate),
    translateProxyUrl: normalizeTranslateProxyBase(merged.translateProxyUrl),
    azureTranslatorKey: azureKey || undefined,
    azureTranslatorRegion: azureReg || undefined,
  }
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await loadSettings()
  const azureKey =
    patch.azureTranslatorKey !== undefined ? patch.azureTranslatorKey.trim() || undefined : current.azureTranslatorKey
  const azureReg =
    patch.azureTranslatorRegion !== undefined
      ? patch.azureTranslatorRegion.trim() || undefined
      : current.azureTranslatorRegion

  const next: AppSettings = {
    ...current,
    ...patch,
    customDictionaryUrlTemplate: normalizeDictionaryUrlTemplate(
      patch.customDictionaryUrlTemplate ?? current.customDictionaryUrlTemplate,
    ),
    translateProxyUrl: normalizeTranslateProxyBase(
      patch.translateProxyUrl !== undefined ? patch.translateProxyUrl : current.translateProxyUrl,
    ),
    azureTranslatorKey: azureKey,
    azureTranslatorRegion: azureReg,
  }
  await chrome.storage.sync.set({ settings: next })
  return next
}
