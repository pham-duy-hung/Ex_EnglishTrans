import { useEffect, useMemo, useState } from 'react'
import type { HistoryItem, TranslateSessionState, WordbookEntry } from '../types/storage'
import { TRANSLATE_SESSION_KEY } from '../lib/sessionKeys'
import { clearHistory, listHistory, listWordbook, removeWordbookEntry } from '../lib/repo'

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function SidePanelApp() {
  const [session, setSession] = useState<TranslateSessionState | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [wordbook, setWordbook] = useState<WordbookEntry[]>([])

  const dark = useMemo(
    () => window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false,
    [],
  )
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const refresh = async () => {
    const [h, w, sess] = await Promise.all([
      listHistory(),
      listWordbook(),
      chrome.storage.session.get(TRANSLATE_SESSION_KEY),
    ])
    setHistory(h)
    setWordbook(w)
    setSession((sess[TRANSLATE_SESSION_KEY] as TranslateSessionState | undefined) ?? null)
  }

  useEffect(() => {
    void refresh()
    const onCh = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (area === 'session' && changes[TRANSLATE_SESSION_KEY]) {
        setSession(changes[TRANSLATE_SESSION_KEY].newValue as TranslateSessionState | null)
      }
      if (area === 'local' && changes.lookupHistory) {
        void listHistory().then(setHistory)
      }
      if (area === 'sync' && changes.wordbookEntries) {
        void listWordbook().then(setWordbook)
      }
    }
    chrome.storage.onChanged.addListener(onCh)
    return () => chrome.storage.onChanged.removeListener(onCh)
  }, [])

  const exportHistoryCsv = () => {
    const rows = [
      ['createdAt', 'kind', 'query', 'title', 'summary', 'url', 'context'].join(','),
      ...history.map((x) =>
        [
          new Date(x.createdAt).toISOString(),
          x.kind,
          csvEscape(x.query),
          csvEscape(x.title),
          csvEscape(x.summary),
          csvEscape(x.url ?? ''),
          csvEscape(x.contextSentence ?? ''),
        ].join(','),
      ),
    ]
    downloadText('lookup-history.csv', rows.join('\n'))
  }

  const exportWordbookCsv = () => {
    const rows = [
      ['createdAt', 'word', 'ipa', 'context', 'sourceUrl'].join(','),
      ...wordbook.map((x) =>
        [
          new Date(x.createdAt).toISOString(),
          csvEscape(x.wordEntry.word),
          csvEscape(x.wordEntry.ipa ?? ''),
          csvEscape(x.contextSentence ?? ''),
          csvEscape(x.sourceUrl ?? ''),
        ].join(','),
      ),
    ]
    downloadText('wordbook.csv', rows.join('\n'))
  }

  return (
    <div className="h-full flex flex-col">
      <header className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur">
        <div className="font-semibold">Translation & lists</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">Azure Translator · History local · Wordbook sync</div>
      </header>

      <div className="px-3 py-3 space-y-3 overflow-auto flex-1">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <div className="text-sm font-medium mb-2">Phiên dịch gần nhất</div>
          {!session ? (
            <div className="text-sm text-slate-500">Chưa có phiên (nhấn icon → bôi đen từ 2 từ trở lên để dịch; cần Azure key hoặc proxy).</div>
          ) : session.status === 'loading' ? (
            <div className="text-sm space-y-1">
              {session.awaitingSelection ? (
                <div className="text-slate-600 dark:text-slate-300">{session.query}</div>
              ) : (
                <div>Đang dịch…</div>
              )}
            </div>
          ) : session.status === 'error' ? (
            <div className="text-sm text-red-600 dark:text-red-400">{session.error}</div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="text-slate-500 text-xs break-words">{session.query}</div>
              <div className="whitespace-pre-wrap">{session.translatedText}</div>
              {session.pageUrl ? (
                <a className="text-xs text-blue-600 dark:text-blue-400 break-all" href={session.pageUrl}>
                  Nguồn
                </a>
              ) : null}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-sm font-medium">History</div>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1"
                onClick={() => void exportHistoryCsv()}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="text-xs rounded-lg border border-red-300 text-red-700 dark:border-red-800 dark:text-red-300 px-2 py-1"
                onClick={() => void clearHistory().then(refresh)}
              >
                Clear
              </button>
            </div>
          </div>
          <ul className="space-y-2 max-h-64 overflow-auto text-sm">
            {history.length === 0 ? <li className="text-slate-500">Trống</li> : null}
            {history.slice(0, 50).map((h) => (
              <li key={h.id} className="border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="text-xs text-slate-500">
                  {new Date(h.createdAt).toLocaleString()} · {h.kind}
                </div>
                <div className="font-medium break-words">{h.title}</div>
                <div className="text-slate-600 dark:text-slate-300 break-words">{h.summary}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-sm font-medium">Wordbook</div>
            <button
              type="button"
              className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1"
              onClick={() => void exportWordbookCsv()}
            >
              Export CSV
            </button>
          </div>
          <ul className="space-y-2 max-h-64 overflow-auto text-sm">
            {wordbook.length === 0 ? <li className="text-slate-500">Trống</li> : null}
            {wordbook.map((w) => (
              <li key={w.id} className="border-b border-slate-100 dark:border-slate-800 pb-2 flex gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{w.wordEntry.word}</div>
                  {w.wordEntry.ipa ? <div className="text-xs text-slate-500">{w.wordEntry.ipa}</div> : null}
                  {w.contextSentence ? (
                    <div className="text-xs text-slate-600 dark:text-slate-300 break-words">{w.contextSentence}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 text-xs text-red-600"
                  onClick={() => void removeWordbookEntry(w.id).then(refresh)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function csvEscape(s: string): string {
  const needs = /[",\n]/.test(s)
  const t = s.replaceAll('"', '""')
  return needs ? `"${t}"` : t
}
