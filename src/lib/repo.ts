import type { HistoryItem, WordbookEntry, WordEntry } from '../types/storage'

const HISTORY_KEY = 'lookupHistory'
const WORDBOOK_KEY = 'wordbookEntries'

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function appendHistory(item: Omit<HistoryItem, 'id' | 'createdAt'>): Promise<HistoryItem> {
  const full: HistoryItem = { ...item, id: uid(), createdAt: Date.now() }
  const { [HISTORY_KEY]: existing } = await chrome.storage.local.get(HISTORY_KEY)
  const list = Array.isArray(existing) ? (existing as HistoryItem[]) : []
  const next = [full, ...list].slice(0, 500)
  await chrome.storage.local.set({ [HISTORY_KEY]: next })
  return full
}

export async function listHistory(): Promise<HistoryItem[]> {
  const { [HISTORY_KEY]: existing } = await chrome.storage.local.get(HISTORY_KEY)
  return Array.isArray(existing) ? (existing as HistoryItem[]) : []
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(HISTORY_KEY)
}

export async function appendWordbook(entry: Omit<WordbookEntry, 'id' | 'createdAt'>): Promise<WordbookEntry> {
  const full: WordbookEntry = { ...entry, id: uid(), createdAt: Date.now() }
  const { [WORDBOOK_KEY]: existing } = await chrome.storage.sync.get(WORDBOOK_KEY)
  const list = Array.isArray(existing) ? (existing as WordbookEntry[]) : []
  const next = [full, ...list].slice(0, 300)
  await chrome.storage.sync.set({ [WORDBOOK_KEY]: next })
  return full
}

export async function listWordbook(): Promise<WordbookEntry[]> {
  const { [WORDBOOK_KEY]: existing } = await chrome.storage.sync.get(WORDBOOK_KEY)
  return Array.isArray(existing) ? (existing as WordbookEntry[]) : []
}

export async function removeWordbookEntry(id: string): Promise<void> {
  const list = await listWordbook()
  await chrome.storage.sync.set({
    [WORDBOOK_KEY]: list.filter((x) => x.id !== id),
  })
}

export function summarizeWordEntry(e: WordEntry): { title: string; summary: string } {
  const firstDef = e.senses[0]?.definitions[0]
  return {
    title: e.word,
    summary: firstDef ?? '(no definition)',
  }
}
