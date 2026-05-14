/** Tách IPA Anh–Anh / Anh–Mỹ từ DictionaryAPI.dev (audio thường có hậu tố -uk / -us). */

export type GbUsIpa = { gb?: string; us?: string }

type PhoneticItem = { text?: string; audio?: string }

export function extractGbUsIpaFromPhonetics(
  phonetics: PhoneticItem[] | undefined,
  rootPhonetic?: string,
): GbUsIpa {
  let gb: string | undefined
  let us: string | undefined

  for (const p of phonetics ?? []) {
    const text = p.text?.trim()
    if (!text) continue
    const au = (p.audio ?? '').toLowerCase()
    if (au.includes('-uk.') || au.includes('uk.mp3') || au.includes('/uk-') || au.includes('_uk.')) {
      gb ??= text
    } else if (au.includes('-us.') || au.includes('us.mp3') || au.includes('/us-') || au.includes('_us.')) {
      us ??= text
    }
  }

  const root = rootPhonetic?.trim()
  if (root) {
    if (!gb) gb = root
    if (!us) us = root
  }

  if (gb && !us) us = gb
  if (us && !gb) gb = us

  return { gb, us }
}

export function formatGbUsPlain(g: GbUsIpa): string {
  const a: string[] = []
  if (g.gb) a.push(`[gb: ${g.gb}]`)
  if (g.us) a.push(`[us: ${g.us}]`)
  return a.join('')
}
