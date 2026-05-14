import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppSettings, WordEntry } from '../types/storage'
import { DEFAULT_SETTINGS } from '../types/storage'
import { MSG } from '../lib/messages'
import { speakEnglish } from '../lib/speakEnglish'
import { GbUsIpaBadges } from '../lib/dictionary/GbUsIpaBadges'

type Props = {
  entry: WordEntry
  /** Bản dịch theo ngôn ngữ đích trong Options (Azure / proxy). */
  translatedVi?: string
  /** Lỗi gọi dịch (Azure/proxy) — hiển thị để dễ cấu hình lại Options. */
  translationError?: string
  anchor: { x: number; y: number }
  pageUrl: string
  contextSentence?: string
  onClose: () => void
}

export function DictionaryPopup({
  entry,
  translatedVi,
  translationError,
  anchor,
  pageUrl,
  contextSentence,
  onClose,
}: Props) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    void chrome.storage.sync.get('settings').then((r) => {
      setSettings({ ...DEFAULT_SETTINGS, ...(r.settings as AppSettings | undefined) })
    })
  }, [])

  const dark = useMemo(() => {
    if (settings.theme === 'dark') return true
    if (settings.theme === 'light') return false
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
  }, [settings.theme])

  const pos = useMemo(() => {
    const w = 300
    const h = 400
    const pad = 8
    const left = Math.min(Math.max(pad, anchor.x + pad), window.innerWidth - w - pad)
    const top = Math.min(Math.max(pad, anchor.y + pad), window.innerHeight - h - pad)
    return { left, top, w, h }
  }, [anchor.x, anchor.y])

  const saveWordbook = useCallback(async () => {
    setErr(null)
    try {
      await chrome.runtime.sendMessage({
        type: MSG.SAVE_WORDBOOK_FROM_CONTENT,
        wordEntry: entry,
        contextSentence,
        sourceUrl: pageUrl,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [contextSentence, entry, pageUrl])

  return (
    <div
      className={
        (dark ? 'dark ' : '') +
        'fixed z-[2147483647] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden flex flex-col'
      }
      style={{ left: pos.left, top: pos.top, width: pos.w, height: pos.h }}
      role="dialog"
      aria-label="Dictionary lookup"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
        <div className="min-w-0">
          <div className="font-semibold truncate">{entry.word}</div>
          {entry.ipaGb || entry.ipaUs ? (
            <div className="text-xs truncate">
              <GbUsIpaBadges gb={entry.ipaGb} us={entry.ipaUs} />
            </div>
          ) : entry.ipa ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{entry.ipa}</div>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg px-2 py-1 text-sm hover:bg-slate-200 dark:hover:bg-slate-700"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-sm bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90"
          onClick={() => speakEnglish(entry.word, 'en-US')}
        >
          🔈 US
        </button>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-sm bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90"
          onClick={() => speakEnglish(entry.word, 'en-GB')}
        >
          🔈 UK
        </button>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-sm border border-amber-300 text-amber-800 dark:text-amber-200 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
          onClick={() => void saveWordbook()}
        >
          ★ Wordbook
        </button>
      </div>

      {translatedVi ? (
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-emerald-50/90 dark:bg-emerald-950/35">
          <div className="text-[10px] uppercase tracking-wide text-emerald-800 dark:text-emerald-300/90">
            Bản dịch ({settings.targetLanguage})
          </div>
          <div className="text-sm text-emerald-950 dark:text-emerald-50 mt-0.5 whitespace-pre-wrap">{translatedVi}</div>
        </div>
      ) : translationError ? (
        <div className="px-3 py-2 border-b border-amber-200 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/30">
          <div className="text-[10px] uppercase tracking-wide text-amber-800 dark:text-amber-200/90">Không dịch được</div>
          <div className="text-xs text-amber-950 dark:text-amber-100 mt-0.5 break-words">{translationError}</div>
        </div>
      ) : null}

      {err ? <div className="px-3 py-2 text-sm text-red-600 dark:text-red-400">{err}</div> : null}

      <div className="flex-1 overflow-auto px-3 py-2 space-y-3 text-sm">
        {entry.senses.length === 0 ? <div className="text-slate-500">No definitions.</div> : null}
        {entry.senses.map((s, i) => (
          <div key={i} className="space-y-1">
            {s.partOfSpeech ? (
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{s.partOfSpeech}</div>
            ) : null}
            <ul className="list-disc pl-4 space-y-1">
              {s.definitions.map((d, j) => (
                <li key={j}>{d}</li>
              ))}
            </ul>
            {s.examples?.length ? (
              <div className="text-xs text-slate-600 dark:text-slate-300 italic">
                e.g. {s.examples.slice(0, 2).join(' · ')}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="px-3 py-2 text-[11px] text-slate-500 border-t border-slate-200 dark:border-slate-700">
        Pick mode · {entry.providerId}
      </div>
    </div>
  )
}
