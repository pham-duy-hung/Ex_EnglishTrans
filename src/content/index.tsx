import { createRoot, type Root } from 'react-dom/client'
import { useState, StrictMode } from 'react'
import contentCss from './content.css?inline'
import { DictionaryPopup } from './DictionaryPopup'
import { countWordsForBranching } from '../lib/wordCount'
import { MSG } from '../lib/messages'
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
      '🔍 Side panel đã mở — bôi đen văn bản để tra / dịch. Esc để thoát chế độ.'
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

function mountPopup(payload: { entry: WordEntry; anchor: { x: number; y: number }; pageUrl: string; context?: string }) {
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

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type === MSG.START_PICK_MODE) {
    enterPickMode()
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

    if (n <= 5) {
      void chrome.runtime
        .sendMessage({
          type: MSG.LOOKUP_DICTIONARY,
          query: text,
          pageUrl,
          contextSentence: context,
        })
        .then((res: { ok: boolean; entry?: WordEntry; error?: string }) => {
          if (!res?.ok) {
            alert(res?.error ?? 'Dictionary lookup failed')
            return
          }
          if (res.entry) {
            mountPopup({
              entry: res.entry,
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
        }
      })
  },
  true,
)

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    exitPickMode()
    teardown()
  }
})
