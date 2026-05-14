import { TRANSLATE_SESSION_KEY } from '../lib/sessionKeys'
import { getDictionaryProvider, loadSettings } from '../lib/dictionary/factory'
import { appendHistory, appendWordbook, summarizeWordEntry } from '../lib/repo'
import type { BackgroundMessage, LookupDictionaryMessage, TranslateOpenPanelMessage } from '../lib/messages'
import { MSG, type TranslateResultToTabMessage } from '../lib/messages'
import { fetchEnglishWordsGbUsIpaRows } from '../lib/dictionary/dictionaryApiDev'
import type {
  AppSettings,
  TranslateIpaWordRow,
  TranslateProxyRequest,
  TranslateProxyResponse,
  TranslateSessionState,
  WordEntry,
} from '../types/storage'
import { isLikelyDictionaryUrlNotTranslateProxy } from '../lib/settingsSanitize'
import { translateWithAzure } from '../lib/azureTranslate'
import { toFriendlyNetworkError } from '../lib/fetchErrors'

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
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw toFriendlyNetworkError('Translate proxy', e, 'proxy')
  }
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

function hasTranslateEngine(settings: AppSettings): boolean {
  return hasValidTranslateProxy(settings) || Boolean(settings.azureTranslatorKey?.trim())
}

async function translateWithSettings(settings: AppSettings, body: TranslateProxyRequest): Promise<TranslateProxyResponse> {
  const hasProxy = hasValidTranslateProxy(settings)
  const hasAzure = Boolean(settings.azureTranslatorKey?.trim())

  /** Có cả hai thì gọi Azure trước — nhiều người để proxy dev cũ / sai URL gây Failed to fetch và chặn dịch. */
  if (hasAzure && hasProxy) {
    try {
      return await translateWithAzure(settings, body)
    } catch (azureErr) {
      try {
        return await translateViaProxy(settings.translateProxyUrl!, body)
      } catch (proxyErr) {
        const a = azureErr instanceof Error ? azureErr.message : String(azureErr)
        const p = proxyErr instanceof Error ? proxyErr.message : String(proxyErr)
        throw new Error(
          `Đã thử Azure rồi proxy — cả hai đều lỗi.\n\n【Azure】\n${a}\n\n【Proxy】\n${p}\n\nGợi ý: xóa «Translate proxy» nếu không dùng; kiểm tra key + Region Azure.`,
        )
      }
    }
  }

  if (hasProxy) {
    try {
      return await translateViaProxy(settings.translateProxyUrl!, body)
    } catch (proxyErr) {
      if (hasAzure) {
        try {
          return await translateWithAzure(settings, body)
        } catch (azureErr) {
          const p = proxyErr instanceof Error ? proxyErr.message : String(proxyErr)
          const a = azureErr instanceof Error ? azureErr.message : String(azureErr)
          throw new Error(
            `Đã thử proxy rồi Azure — cả hai đều lỗi.\n\n【Proxy】\n${p}\n\n【Azure】\n${a}\n\nGợi ý: xóa «Translate proxy» trong Options nếu không dùng; kiểm tra key + Region Azure.`,
          )
        }
      }
      throw proxyErr
    }
  }
  if (hasAzure) {
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

/** Tối đa `max` từ Latin (tiếng Anh) khác nhau — tra IPA từng từ sau dịch cụm. */
function uniqueEnglishTokensForIpa(text: string, max: number): string[] {
  const parts = text.trim().split(/\s+/).filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const w = p.replace(/^[^a-z0-9'-]+|[^a-z0-9'-]+$/gi, '').toLowerCase()
    if (!w || !/[a-z]/i.test(w)) continue
    if (seen.has(w)) continue
    seen.add(w)
    out.push(w)
    if (out.length >= max) break
  }
  return out
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
        let translatedVi: string | undefined
        let translationError: string | undefined
        if (hasTranslateEngine(settings)) {
          try {
            const tr = await translateWithSettings(settings, {
              text: m.query.trim(),
              sourceLang: settings.sourceLanguage === 'auto' ? null : settings.sourceLanguage,
              targetLang: settings.targetLanguage,
            })
            translatedVi = tr.translatedText
          } catch (e) {
            translationError = e instanceof Error ? e.message : String(e)
          }
        }
        await appendHistory({
          kind: 'dictionary',
          query: m.query,
          ...summarizeWordEntry(entry),
          url: m.pageUrl,
          contextSentence: m.contextSentence,
          snapshot: entry,
        })
        sendResponse({ ok: true as const, entry, translatedVi, translationError })
        return
      }

      if (message.type === MSG.TRANSLATE_OPEN_PANEL) {
        const m = message as TranslateOpenPanelMessage
        const settings = await loadSettings()
        if (!hasTranslateEngine(settings)) {
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
          ipaByWord: undefined,
        })

        sendResponse({ ok: true as const })

        void (async () => {
          const pushToTab = async (payload: Omit<TranslateResultToTabMessage, 'type'>) => {
            try {
              await chrome.tabs.sendMessage(tabId, {
                type: MSG.TRANSLATE_RESULT_TO_TAB,
                ...payload,
              } satisfies TranslateResultToTabMessage)
            } catch {
              /* Tab đổi URL / không còn content script */
            }
          }
          try {
            const req: TranslateProxyRequest = {
              text: m.text,
              sourceLang: settings.sourceLanguage === 'auto' ? null : settings.sourceLanguage,
              targetLang: settings.targetLanguage,
            }
            const tokens = uniqueEnglishTokensForIpa(m.text, 12)
            const [res, ipaRows] = await Promise.all([
              translateWithSettings(settings, req),
              tokens.length > 0 ? fetchEnglishWordsGbUsIpaRows(tokens) : Promise.resolve([] as TranslateIpaWordRow[]),
            ])
            const ipaByWord = ipaRows.length ? ipaRows : undefined
            await setSession({
              status: 'done',
              awaitingSelection: false,
              query: m.text,
              pageUrl: m.pageUrl,
              translatedText: res.translatedText,
              ipaByWord,
            })
            await appendHistory({
              kind: 'translate',
              query: m.text,
              title: m.text.slice(0, 80),
              summary: res.translatedText.slice(0, 200),
              url: m.pageUrl,
              contextSentence: m.contextSentence,
            })
            await pushToTab({
              query: m.text,
              translatedText: res.translatedText,
              pageUrl: m.pageUrl,
              ipaByWord,
            })
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            await setSession({
              status: 'error',
              awaitingSelection: false,
              query: m.text,
              pageUrl: m.pageUrl,
              error: errMsg,
              ipaByWord: undefined,
            })
            await pushToTab({
              query: m.text,
              error: errMsg,
              pageUrl: m.pageUrl,
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

chrome.runtime.onInstalled.addListener(() => {
  registerActionContextMenu()
})
registerActionContextMenu()
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {
  /* Một số bản Chromium cũ không có API */
})

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === CONTEXT_OPTIONS) void chrome.runtime.openOptionsPage()
})

/**
 * `sidePanel.open()` phải nằm trong chuỗi user gesture — không được `await` gì trước đó
 * (vd. `tabs.query`), nếu không Chrome từ chối mở panel im lặng hoặc lỗi.
 */
chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id || !tab.url?.startsWith('http')) {
    void chrome.runtime.openOptionsPage()
    return
  }
  const tabId = tab.id
  void chrome.sidePanel.setOptions({ tabId, enabled: true })
  void chrome.sidePanel
    .open({ tabId })
    .catch((e) => {
      console.warn('[EnglishLookup] sidePanel.open({ tabId }):', e)
      if (tab.windowId != null) return chrome.sidePanel.open({ windowId: tab.windowId })
      throw e
    })
    .catch((e2) => {
      console.warn('[EnglishLookup] sidePanel.open({ windowId }):', e2)
    })

  void (async () => {
    await setSession({
      status: 'loading',
      awaitingSelection: true,
      query:
        'Trên trang web: 1 từ → popup từ điển (+ bản dịch nếu đã cấu hình Azure/proxy). Từ 2 từ trở lên → dịch trong Side panel — thả chuột sau khi bôi đen.',
      pageUrl: tab.url,
      translatedText: undefined,
      error: undefined,
      ipaByWord: undefined,
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