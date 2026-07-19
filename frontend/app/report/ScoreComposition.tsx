"use client"

import { Check } from "lucide-react"

type Entry = { label: string; points: number }

export default function ScoreComposition({ breakdown, totalScore }: { breakdown: Entry[]; totalScore: number }) {
    if (!breakdown || breakdown.length === 0) {
        return (
            <div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400 py-1">
                    <Check size={12} className="text-green-500 shrink-0" />
                    No individual risk factors contributed to this score — the artifact came back clean on every check.
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/10">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Total Threat Score</span>
                    <span className="text-sm font-mono font-bold text-green-600">{totalScore}<span className="text-gray-400 font-normal">/100</span></span>
                </div>
            </div>
        )
    }

    const maxAbs = Math.max(...breakdown.map(b => Math.abs(b.points)), 1)

    return (
        <div>
            <div className="space-y-2.5">
                {breakdown.map(b => {
                    const positive = b.points >= 0
                    const widthPct = (Math.abs(b.points) / maxAbs) * 100
                    return (
                        <div key={b.label} className="flex items-center gap-3">
                            <span className="text-[9px] font-mono text-gray-500 w-36 md:w-44 shrink-0 truncate" title={b.label}>{b.label}</span>
                            <div className="flex-1 h-2 bg-black/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${widthPct}%`, backgroundColor: positive ? "#FF3B00" : "#22c55e" }}
                                />
                            </div>
                            <span className={`text-[10px] font-mono font-bold w-9 text-right shrink-0 ${positive ? "text-[#FF3B00]" : "text-green-600"}`}>
                                {positive ? "+" : ""}{b.points}
                            </span>
                        </div>
                    )
                })}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/10">
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Total Threat Score</span>
                <span className="text-sm font-mono font-bold text-[#FF3B00]">{totalScore}<span className="text-gray-400 font-normal">/100</span></span>
            </div>
        </div>
    )
}
