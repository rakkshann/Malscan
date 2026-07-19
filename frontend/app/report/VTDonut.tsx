"use client"

type VTStats = { malicious: number; suspicious: number; harmless: number; undetected?: number }

const R = 54
const CIRCUMFERENCE = 2 * Math.PI * R

export default function VTDonut({ stats }: { stats: VTStats }) {
    const total = stats.malicious + stats.suspicious + stats.harmless + (stats.undetected || 0)
    if (total === 0) return null

    const segments = [
        { key: "malicious", value: stats.malicious, color: "#ef4444", label: "Malicious" },
        { key: "suspicious", value: stats.suspicious, color: "#f59e0b", label: "Suspicious" },
        { key: "harmless", value: stats.harmless, color: "#22c55e", label: "Harmless" },
        { key: "undetected", value: stats.undetected || 0, color: "#d1d5db", label: "Undetected" },
    ].filter(s => s.value > 0)

    let cumulative = 0

    return (
        <div className="flex items-center gap-5 mt-4">
            <svg viewBox="0 0 140 140" width={104} height={104} className="shrink-0 -rotate-90 overflow-visible">
                <circle cx={70} cy={70} r={R} fill="none" stroke="#f3f4f6" strokeWidth={16} />
                {segments.map(s => {
                    const frac = s.value / total
                    const dash = frac * CIRCUMFERENCE
                    const offset = -cumulative * CIRCUMFERENCE
                    cumulative += frac
                    return (
                        <circle
                            key={s.key} cx={70} cy={70} r={R} fill="none" stroke={s.color} strokeWidth={16}
                            strokeDasharray={`${Math.max(dash - 2, 0)} ${CIRCUMFERENCE - dash + 2}`}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                        />
                    )
                })}
            </svg>
            <div className="space-y-1.5">
                {segments.map(s => (
                    <div key={s.key} className="flex items-center gap-2 text-[10px] font-mono">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-gray-700 font-semibold">{s.value} {s.label}</span>
                        <span className="text-gray-400">— {Math.round((s.value / total) * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
