"use client"

type Section = { name: string; entropy: number }

const MAX_ENTROPY = 8
const PACKED_THRESHOLD = 7.0

export default function EntropyChart({ sections }: { sections: Section[] }) {
    if (!sections || sections.length === 0) return null

    return (
        <div>
            <div className="relative h-40 flex gap-3 px-2 border-b border-gray-100">
                <div
                    className="absolute left-0 right-0 border-t border-dashed border-amber-400 z-0"
                    style={{ bottom: `${(PACKED_THRESHOLD / MAX_ENTROPY) * 100}%` }}
                >
                    <span className="absolute -top-3.5 right-0 text-[8px] font-mono font-bold text-amber-600 bg-white px-1 whitespace-nowrap">
                        7.0 — LIKELY PACKED
                    </span>
                </div>
                {sections.map(s => {
                    const pct = Math.max(0, Math.min(100, (s.entropy / MAX_ENTROPY) * 100))
                    const packed = s.entropy > PACKED_THRESHOLD
                    return (
                        <div key={s.name} className="relative z-10 flex-1 min-w-0 h-full flex flex-col items-center justify-end">
                            <span className="text-[9px] font-mono font-bold text-gray-600 mb-1">{s.entropy.toFixed(1)}</span>
                            <div
                                className="w-full max-w-[28px] rounded-t-md transition-all duration-700"
                                style={{ height: `${pct}%`, backgroundColor: packed ? "#ef4444" : "#94a3b8" }}
                            />
                        </div>
                    )
                })}
            </div>
            <div className="flex gap-3 px-2 mt-2">
                {sections.map(s => (
                    <div key={s.name} className="flex-1 min-w-0 text-center">
                        <span className="text-[8px] font-mono text-gray-500 truncate block" title={s.name}>{s.name || "?"}</span>
                    </div>
                ))}
            </div>
            <p className="text-[10px] font-mono text-gray-400 mt-4 leading-relaxed">
                Entropy measures how random a section&apos;s bytes look, on a 0–8 scale. Sections above ~7.0 (red) are usually packed or encrypted — a common way malware hides its real code from static analysis.
            </p>
        </div>
    )
}
