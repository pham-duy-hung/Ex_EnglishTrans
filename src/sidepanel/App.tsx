import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import type { HistoryItem, TranslateSessionState, WordbookEntry } from '../types/storage'
import { GbUsIpaBadges } from '../lib/dictionary/GbUsIpaBadges'
import { TRANSLATE_SESSION_KEY } from '../lib/sessionKeys'
import { clearHistory, listHistory, listWordbook, removeWordbookEntry } from '../lib/repo'
import { speakEnglish } from '../lib/speakEnglish'

function downloadXlsx(filename: string, sheetName: string, rows: (string | number)[][]) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const safeName = sheetName.replace(/[[\]:*?/\\]/g, '_').slice(0, 31) || 'Sheet1'
  XLSX.utils.book_append_sheet(wb, ws, safeName)
  XLSX.writeFile(wb, filename)
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

  const exportHistoryXlsx = () => {
    const rows: (string | number)[][] = [
      ['createdAt', 'kind', 'query', 'title', 'summary', 'url', 'context'],
      ...history.map((x) => [
        new Date(x.createdAt).toISOString(),
        x.kind,
        x.query,
        x.title,
        x.summary,
        x.url ?? '',
        x.contextSentence ?? '',
      ]),
    ]
    downloadXlsx('lookup-history.xlsx', 'History', rows)
  }

  const exportWordbookXlsx = () => {
    const rows: (string | number)[][] = [
      ['createdAt', 'word', 'ipa', 'context', 'sourceUrl'],
      ...wordbook.map((x) => [
        new Date(x.createdAt).toISOString(),
        x.wordEntry.word,
        x.wordEntry.ipa ?? '',
        x.contextSentence ?? '',
        x.sourceUrl ?? '',
      ]),
    ]
    downloadXlsx('wordbook.xlsx', 'Wordbook', rows)
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
              {session.ipaByWord?.length ? (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 px-2 py-1.5 space-y-1 max-h-40 overflow-auto">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">IPA (DictionaryAPI)</div>
                  {session.ipaByWord.filter((row) => row.gb || row.us).map((row) => (
                    <div key={row.word} className="text-xs font-mono break-words">
                      <span className="font-sans font-semibold text-slate-700 dark:text-slate-200">{row.word}</span>{' '}
                      <GbUsIpaBadges gb={row.gb} us={row.us} />
                    </div>
                  ))}
                </div>
              ) : null}
              {session.query.trim() ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90"
                    onClick={() => speakEnglish(session.query, 'en-US')}
                  >
                    🔈 Đọc đoạn gốc (US)
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90"
                    onClick={() => speakEnglish(session.query, 'en-GB')}
                  >
                    🔈 Đọc đoạn gốc (UK)
                  </button>
                </div>
              ) : null}
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
                onClick={() => void exportHistoryXlsx()}
              >
                Export XLSX
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
              onClick={() => void exportWordbookXlsx()}
            >
              Export XLSX
            </button>
          </div>
          <ul className="space-y-2 max-h-64 overflow-auto text-sm">
            {wordbook.length === 0 ? <li className="text-slate-500">Trống</li> : null}
            {wordbook.map((w) => (
              <li key={w.id} className="border-b border-slate-100 dark:border-slate-800 pb-2 flex gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{w.wordEntry.word}</div>
                  {w.wordEntry.ipaGb || w.wordEntry.ipaUs ? (
                    <div className="text-xs">
                      <GbUsIpaBadges gb={w.wordEntry.ipaGb} us={w.wordEntry.ipaUs} />
                    </div>
                  ) : w.wordEntry.ipa ? (
                    <div className="text-xs text-slate-500">{w.wordEntry.ipa}</div>
                  ) : null}
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
