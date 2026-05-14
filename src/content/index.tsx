import { createRoot, type Root } from 'react-dom/client'
import { useState, StrictMode } from 'react'
import contentCss from './content.css?inline'
import { DictionaryPopup } from './DictionaryPopup'
import { countWordsForBranching } from '../lib/wordCount'
import { MSG, type TranslateResultToTabMessage } from '../lib/messages'
import type { WordEntry } from '../types/storage'

let hostEl: HTMLDivElement | null = null
let shadow: ShadowRoot | null = null
let reactRoot: Root | null = null

/** Khi true: đã nhấn icon extension; chờ người dùng bôi đen (con trỏ kính lúp). */
let pickMode = false
let pickBanner: HTMLDivElement | null = null

function teardown() {
  reactRoot?.unmount()
  reactRoot = null
  shadow = null
  hostEl?.remove()
  hostEl = null
}

function exitPickMode() {
  pickMode = false
  document.documentElement.style.removeProperty('cursor')
  document.body.style.removeProperty('cursor')
  pickBanner?.remove()
  pickBanner = null
}

function enterPickMode() {
  pickMode = true
  document.documentElement.style.setProperty('cursor', 'zoom-in', 'important')
  document.body.style.setProperty('cursor', 'zoom-in', 'important')

  if (!pickBanner) {
    pickBanner = document.createElement('div')
    pickBanner.id = 'english-lookup-pick-banner'
    pickBanner.textContent =
      '🔍 1 từ: popup từ điển; 2+ từ: kết quả dịch hiện góc phải dưới (và Side panel nếu đang mở). Esc để thoát.'
    Object.assign(pickBanner.style, {
      position: 'fixed',
      top: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '2147483646',
      padding: '8px 14px',
      borderRadius: '10px',
      background: 'rgba(15,23,42,0.93)',
      color: '#f8fafc',
      font: '12px/1.45 system-ui,Segoe UI,sans-serif',
      boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
      pointerEvents: 'none',
      maxWidth: 'min(92vw, 420px)',
      textAlign: 'center',
    })
  }
  if (!pickBanner.isConnected) document.documentElement.appendChild(pickBanner)
}

const TRANSLATE_RESULT_HOST_ID = 'english-lookup-translate-result-host'

function removeTranslateResultPanel() {
  document.getElementById(TRANSLATE_RESULT_HOST_ID)?.remove()
}

function showTranslateResultPanel(payload: { query: string; translatedText?: string; error?: string }) {
  removeTranslateResultPanel()
  const host = document.createElement('div')
  host.id = TRANSLATE_RESULT_HOST_ID
  Object.assign(host.style, {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    zIndex: '2147483647',
    width: 'min(440px, calc(100vw - 24px))',
    maxHeight: 'min(52vh, 420px)',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '12px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
    font: '13px/1.45 system-ui,Segoe UI,sans-serif',
    background: '#0f172a',
    color: '#f8fafc',
    border: '1px solid rgba(148,163,184,0.35)',
    overflow: 'hidden',
  })

  const header = document.createElement('div')
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '8px 10px',
    borderBottom: '1px solid rgba(148,163,184,0.25)',
    fontSize: '12px',
    fontWeight: '600',
  })
  const title = document.createElement('span')
  title.textContent = payload.error ? 'Lỗi dịch' : 'Bản dịch'
  title.style.flex = '1'
  title.style.minWidth = '0'
  title.style.overflow = 'hidden'
  title.style.textOverflow = 'ellipsis'
  title.style.whiteSpace = 'nowrap'

  const close = document.createElement('button')
  close.type = 'button'
  close.textContent = '✕'
  close.setAttribute('aria-label', 'Đóng')
  Object.assign(close.style, {
    flexShrink: '0',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: '1',
    padding: '2px 6px',
    borderRadius: '6px',
  })
  close.onmouseenter = () => {
    close.style.background = 'rgba(148,163,184,0.2)'
    close.style.color = '#f8fafc'
  }
  close.onmouseleave = () => {
    close.style.background = 'transparent'
    close.style.color = '#94a3b8'
  }
  close.onclick = () => host.remove()

  header.appendChild(title)
  header.appendChild(close)

  const src = document.createElement('div')
  src.textContent = payload.query
  Object.assign(src.style, {
    padding: '6px 12px 0',
    fontSize: '11px',
    color: '#94a3b8',
    maxHeight: '3.2em',
    overflow: 'auto',
    wordBreak: 'break-word',
  })

  const body = document.createElement('div')
  Object.assign(body.style, {
    padding: '8px 12px 12px',
    overflow: 'auto',
    flex: '1',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: '13px',
    color: payload.error ? '#fecaca' : '#e2e8f0',
  })
  body.textContent = payload.error ?? payload.translatedText ?? ''

  host.appendChild(header)
  host.appendChild(src)
  host.appendChild(body)
  document.documentElement.appendChild(host)
}

function showTranslateToast(message: string) {
  const el = document.createElement('div')
  el.textContent = message
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '2147483647',
    maxWidth: 'min(92vw, 420px)',
    padding: '10px 16px',
    borderRadius: '10px',
    background: 'rgba(15,23,42,0.94)',
    color: '#f8fafc',
    font: '13px/1.45 system-ui,Segoe UI,sans-serif',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    textAlign: 'center',
    pointerEvents: 'none',
  })
  document.documentElement.appendChild(el)
  setTimeout(() => el.remove(), 4500)
}

function mountPopup(payload: {
  entry: WordEntry
  anchor: { x: number; y: number }
  pageUrl: string
  context?: string
  translatedVi?: string
  translationError?: string
}) {
  teardown()
  hostEl = document.createElement('div')
  hostEl.id = 'english-lookup-shadow-host'
  document.documentElement.appendChild(hostEl)
  shadow = hostEl.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = contentCss
  shadow.appendChild(style)
  const app = document.createElement('div')
  shadow.appendChild(app)
  reactRoot = createRoot(app)

  const Shell = () => {
    const [open, setOpen] = useState(true)
    if (!open) return null
    return (
      <DictionaryPopup
        entry={payload.entry}
        translatedVi={payload.translatedVi}
        translationError={payload.translationError}
        anchor={payload.anchor}
        pageUrl={payload.pageUrl}
        contextSentence={payload.context}
        onClose={() => {
          setOpen(false)
          teardown()
        }}
      />
    )
  }

  reactRoot.render(
    <StrictMode>
      <Shell />
    </StrictMode>,
  )
}

function getSelectionText(): string | null {
  const sel = document.getSelection()
  if (!sel || sel.isCollapsed) return null
  const t = sel.toString()
  const trimmed = t.trim()
  return trimmed.length ? trimmed : null
}

function expandContextSentence(sel: Selection): string | undefined {
  if (!sel.rangeCount) return undefined
  const n = sel.anchorNode
  if (!n) return undefined
  const el = n.nodeType === Node.ELEMENT_NODE ? (n as HTMLElement) : n.parentElement
  const block = el?.closest('p, li, td, blockquote, div') ?? el
  const text = block?.textContent?.replace(/\s+/g, ' ').trim()
  return text?.slice(0, 500)
}

chrome.runtime.onMessage.addListener((message: { type?: string } | TranslateResultToTabMessage) => {
  if (message?.type === MSG.START_PICK_MODE) {
    enterPickMode()
    return
  }
  if (message?.type === MSG.TRANSLATE_RESULT_TO_TAB) {
    const m = message as TranslateResultToTabMessage
    showTranslateResultPanel({
      query: m.query,
      translatedText: m.translatedText,
      error: m.error,
    })
  }
})

document.addEventListener(
  'mouseup',
  (ev: MouseEvent) => {
    if (!pickMode) return
    const text = getSelectionText()
    if (!text) return

    exitPickMode()

    const pageUrl = location.href
    const sel = document.getSelection()
    const context = sel ? expandContextSentence(sel) : undefined
    const n = countWordsForBranching(text)

    if (n <= 1) {
      void chrome.runtime
        .sendMessage({
          type: MSG.LOOKUP_DICTIONARY,
          query: text,
          pageUrl,
          contextSentence: context,
        })
        .then((res: { ok: boolean; entry?: WordEntry; translatedVi?: string; translationError?: string; error?: string }) => {
          if (!res?.ok) {
            alert(res?.error ?? 'Dictionary lookup failed')
            return
          }
          if (res.entry) {
            mountPopup({
              entry: res.entry,
              translatedVi: res.translatedVi,
              translationError: res.translationError,
              anchor: { x: ev.clientX, y: ev.clientY },
              pageUrl,
              context,
            })
          }
        })
      return
    }

    void chrome.runtime
      .sendMessage({
        type: MSG.TRANSLATE_OPEN_PANEL,
        text,
        pageUrl,
        contextSentence: context,
      })
      .then((res: { ok: boolean; error?: string }) => {
        if (!res?.ok && res?.error) {
          alert(res.error)
          return
        }
        if (res?.ok) {
          showTranslateToast('Đang dịch — kết quả sẽ hiện ô góc phải dưới; Side panel (nếu mở) cũng cập nhật.')
        }
      })
  },
  true,
)

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    exitPickMode()
    teardown()
    removeTranslateResultPanel()
  }
})
