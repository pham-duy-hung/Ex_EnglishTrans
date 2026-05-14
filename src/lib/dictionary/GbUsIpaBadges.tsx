/** Hiển thị IPA dạng [gb: …][us: …] (nhãn đậm). */
export function GbUsIpaBadges({ gb, us }: { gb?: string; us?: string }) {
  if (!gb && !us) return null
  return (
    <span className="text-xs font-mono text-slate-600 dark:text-slate-300 tracking-tight">
      {gb ? (
        <>
          [<strong className="text-slate-800 dark:text-slate-200">gb</strong>: {gb}]
        </>
      ) : null}
      {us ? (
        <>
          [<strong className="text-slate-800 dark:text-slate-200">us</strong>: {us}]
        </>
      ) : null}
    </span>
  )
}
