/** Đoạn dài: chia nhỏ để trình duyệt xếp hàng đọc ổn định hơn. */
const CHUNK_SOFT = 900

function chunkTextForSpeech(text: string): string[] {
  const t = text.trim()
  if (!t) return []
  if (t.length <= CHUNK_SOFT) return [t]
  const parts = t.split(/(?<=[.!?])\s+|\n+/)
  const out: string[] = []
  let buf = ''
  for (const p of parts) {
    const next = buf ? `${buf} ${p}` : p
    if (next.length > CHUNK_SOFT && buf) {
      out.push(buf.trim())
      buf = p
    } else {
      buf = next
    }
  }
  if (buf.trim()) out.push(buf.trim())
  if (out.length === 0) return [t]
  return out
}

function normalizeLang(lang: string): string {
  return lang.trim().toLowerCase().replaceAll('_', '-')
}

function meta(v: SpeechSynthesisVoice): string {
  return `${v.name} ${v.voiceURI} ${v.lang}`.toLowerCase()
}

function pickUsVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const pool = voices.filter((v) => {
    const l = normalizeLang(v.lang)
    return l.startsWith('en-us') || l === 'en'
  })
  const google =
    pool.find((v) => /google/i.test(v.name) && /us|america/i.test(meta(v))) ??
    pool.find((v) => /google/i.test(v.name))
  return google ?? pool[0] ?? null
}

/** Chọn giọng UK: nhiều engine (Edge/Chrome) dùng en_GB, URI chứa en-gb, hoặc tên Microsoft UK. */
function pickUkVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const isNotUs = (v: SpeechSynthesisVoice) => {
    const l = normalizeLang(v.lang)
    return !l.startsWith('en-us')
  }

  // 1) BCP-47 chuẩn / biến thể en-gb-*
  let pool = voices.filter((v) => {
    if (!isNotUs(v)) return false
    const l = normalizeLang(v.lang)
    return l === 'en-gb' || l.startsWith('en-gb-')
  })

  // 2) Chuỗi en-gb / en_gb trong lang hoặc URI (Safari, một bản Edge)
  if (!pool.length) {
    pool = voices.filter((v) => {
      if (!isNotUs(v)) return false
      return /en[-_]gb/i.test(meta(v))
    })
  }

  // 3) Lang "en" + tên UK (Microsoft George, English United Kingdom, …)
  if (!pool.length) {
    pool = voices.filter((v) => {
      const m = meta(v)
      const l = normalizeLang(v.lang)
      if (!l.startsWith('en') || l.startsWith('en-us')) return false
      return (
        /\b(uk|gb|british|britain|england|united kingdom)\b/.test(m) ||
        /\(united kingdom\)/.test(m) ||
        /english\s*\(united kingdom\)/.test(m) ||
        /\bkingdom\b.*\ben\b/.test(m)
      )
    })
  }

  if (!pool.length) return null

  const score = (v: SpeechSynthesisVoice) => {
    const l = normalizeLang(v.lang)
    let s = 0
    if (l === 'en-gb') s += 40
    else if (l.startsWith('en-gb')) s += 35
    else if (/en[-_]gb/i.test(meta(v))) s += 30
    else s += 20
    if (v.localService) s += 5
    if (v.default) s += 2
    if (/microsoft/i.test(v.name) && /(george|sonia|ryan|libby|thomas|molly|maisie|ethan|alfie)/i.test(v.name)) s += 8
    if (/google/i.test(v.name) && /gb|uk|british|kingdom/.test(meta(v))) s += 6
    return s
  }

  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null
}

function pickVoice(voices: SpeechSynthesisVoice[], wantUS: boolean): SpeechSynthesisVoice | null {
  return wantUS ? pickUsVoice(voices) : pickUkVoice(voices)
}

/**
 * Chrome/Edge thường trả `getVoices()` rỗng cho tới khi có `voiceschanged`.
 * Gọi callback một lần khi đã có danh sách (hoặc sau timeout vẫn gọi để đọc với lang mặc định).
 */
function whenVoicesReady(syn: SpeechSynthesis, onReady: () => void): void {
  let done = false
  const finish = () => {
    if (done) return
    done = true
    syn.removeEventListener('voiceschanged', onVoices)
    onReady()
  }

  const onVoices = () => {
    if (syn.getVoices().length > 0) finish()
  }

  if (syn.getVoices().length > 0) {
    finish()
    return
  }

  syn.addEventListener('voiceschanged', onVoices)
  void syn.getVoices()

  globalThis.setTimeout(() => finish(), 900)
}

/** Đọc toàn bộ văn bản tiếng Anh (giọng US/UK). */
export function speakEnglish(text: string, voicePref: 'en-US' | 'en-GB') {
  const syn = globalThis.speechSynthesis
  if (!syn) return
  const chunks = chunkTextForSpeech(text)
  if (!chunks.length) return

  const wantUS = voicePref === 'en-US'

  whenVoicesReady(syn, () => {
    const voices = syn.getVoices()
    const chosen = pickVoice(voices, wantUS)

    for (const chunk of chunks) {
      const u = new SpeechSynthesisUtterance(chunk)
      u.lang = wantUS ? 'en-US' : 'en-GB'
      if (chosen) {
        u.voice = chosen
      }
      syn.speak(u)
    }
  })
}
