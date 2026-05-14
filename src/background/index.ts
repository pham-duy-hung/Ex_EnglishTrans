import { TRANSLATE_SESSION_KEY } from '../lib/sessionKeys'
import { getDictionaryProvider, loadSettings } from '../lib/dictionary/factory'
import { appendHistory, appendWordbook, summarizeWordEntry } from '../lib/repo'
import type { BackgroundMessage, LookupDictionaryMessage, TranslateOpenPanelMessage } from '../lib/messages'
import { MSG } from '../lib/messages'
import type {
  AppSettings,
  TranslateProxyRequest,
  TranslateProxyResponse,
  TranslateSessionState,
  WordEntry,
} from '../types/storage'
import { isLikelyDictionaryUrlNotTranslateProxy } from '../lib/settingsSanitize'
import { translateWithAzure } from '../lib/azureTranslate'

async function translateViaProxy(
  proxyBase: string,
  body: TranslateProxyRequest,
): Promise<TranslateProxyResponse> {
  if (isLikelyDictionaryUrlNotTranslateProxy(proxyBase)) {
    throw new Error(
      'Translate proxy đang trỏ nhầm sang API từ điển (DictionaryAPI). Ô này phải là URL server của bạn nhận POST /translate (JSON { text, sourceLang?, targetLang } → { translatedText }).',
    )
  }
  const base = proxyBase.replace(/\/$/, '')
  const url = base.endsWith('/translate') ? base : `${base}/translate`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `Proxy ${res.status}`)
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new Error('Proxy trả về không phải JSON. Kiểm tra endpoint POST /translate.')
  }
  return data as TranslateProxyResponse
}

function hasValidTranslateProxy(settings: { translateProxyUrl?: string }): boolean {
  const u = settings.translateProxyUrl
  return Boolean(u && !isLikelyDictionaryUrlNotTranslateProxy(u))
}

async function translateWithSettings(settings: AppSettings, body: TranslateProxyRequest): Promise<TranslateProxyResponse> {
  if (hasValidTranslateProxy(settings)) {
    return translateViaProxy(settings.translateProxyUrl!, body)
  }
  if (settings.azureTranslatorKey?.trim()) {
    return translateWithAzure(settings, body)
  }
  throw new Error(
    'Chưa cấu hình dịch. Trong Options: (1) Translate proxy tùy chọn, hoặc (2) Azure Translator — subscription key (+ region nếu Portal yêu cầu).',
  )
}

async function setSession(partial: Omit<TranslateSessionState, 'updatedAt'> & { updatedAt?: number }) {
  await chrome.storage.session.set({
    [TRANSLATE_SESSION_KEY]: { ...partial, updatedAt: Date.now() },
  })
}

chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  void (async () => {
    try {
      if (message.type === MSG.LOOKUP_DICTIONARY) {
        const m = message as LookupDictionaryMessage
        const settings = await loadSettings()
        const provider = getDictionaryProvider(settings)
        let entry: WordEntry = await provider.lookup({ query: m.query, language: 'en' })
        if (m.query.trim().includes(' ')) {
          entry = { ...entry, word: m.query.trim() }
        }
        await appendHistory({
          kind: 'dictionary',
          query: m.query,
          ...summarizeWordEntry(entry),
          url: m.pageUrl,
          contextSentence: m.contextSentence,
          snapshot: entry,
        })
        sendResponse({ ok: true as const, entry })
        return
      }

      if (message.type === MSG.TRANSLATE_OPEN_PANEL) {
        const m = message as TranslateOpenPanelMessage
        const settings = await loadSettings()
        if (!hasValidTranslateProxy(settings) && !settings.azureTranslatorKey?.trim()) {
          sendResponse({
            ok: false as const,
            error:
              'Chưa cấu hình dịch. Trong Options: điền Azure Translator (subscription key) hoặc Translate proxy tùy chọn.',
          })
          return
        }
        const tabId = sender.tab?.id
        if (tabId == null) {
          sendResponse({ ok: false as const, error: 'No tab' })
          return
        }

        await setSession({
          status: 'loading',
          awaitingSelection: false,
          query: m.text,
          pageUrl: m.pageUrl,
        })

        sendResponse({ ok: true as const })

        void (async () => {
          try {
            const req: TranslateProxyRequest = {
              text: m.text,
              sourceLang: settings.sourceLanguage === 'auto' ? null : settings.sourceLanguage,
              targetLang: settings.targetLanguage,
            }
            const res = await translateWithSettings(settings, req)
            await setSession({
              status: 'done',
              awaitingSelection: false,
              query: m.text,
              pageUrl: m.pageUrl,
              translatedText: res.translatedText,
            })
            await appendHistory({
              kind: 'translate',
              query: m.text,
              title: m.text.slice(0, 80),
              summary: res.translatedText.slice(0, 200),
              url: m.pageUrl,
              contextSentence: m.contextSentence,
            })
          } catch (err) {
            await setSession({
              status: 'error',
              awaitingSelection: false,
              query: m.text,
              pageUrl: m.pageUrl,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        })()
        return
      }

      if (message.type === MSG.SAVE_WORDBOOK_FROM_CONTENT) {
        await appendWordbook({
          wordEntry: message.wordEntry,
          contextSentence: message.contextSentence,
          sourceUrl: message.sourceUrl,
        })
        sendResponse({ ok: true as const })
      }
    } catch (err) {
      sendResponse({
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })()
  return true
})

const CONTEXT_OPTIONS = 'english-lookup-open-options'

function registerActionContextMenu() {
  chrome.contextMenus.create(
    {
      id: CONTEXT_OPTIONS,
      title: 'Cài đặt (Options)',
      contexts: ['action'],
    },
    () => void chrome.runtime.lastError,
  )
}

chrome.runtime.onInstalled.addListener(registerActionContextMenu)
registerActionContextMenu()

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === CONTEXT_OPTIONS) void chrome.runtime.openOptionsPage()
})

chrome.action.onClicked.addListener(() => {
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !tab.url?.startsWith('http')) {
      void chrome.runtime.openOptionsPage()
      return
    }
    const tabId = tab.id
    try {
      await chrome.sidePanel.setOptions({ tabId, enabled: true })
      await chrome.sidePanel.open({ tabId })
    } catch (e) {
      console.warn('[EnglishLookup] sidePanel.open on icon click:', e)
    }
    await setSession({
      status: 'loading',
      awaitingSelection: true,
      query: 'Trên trang web: bôi đen đoạn cần dịch (hơn 5 từ), rồi thả chuột. Tra ≤5 từ thì không cần mở panel này.',
      pageUrl: tab.url,
      translatedText: undefined,
      error: undefined,
    })
    try {
      await chrome.tabs.sendMessage(tabId, { type: MSG.START_PICK_MODE })
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            window.alert(
              'English Lookup: chưa chạy trên tab này. Hãy tải lại trang (F5), rồi nhấn lại icon extension.',
            )
          },
        })
      } catch (e2) {
        console.warn('[EnglishLookup] inject fallback:', e2)
        void chrome.runtime.openOptionsPage()
      }
    }
  })()
})