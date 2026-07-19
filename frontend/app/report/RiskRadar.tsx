"use client"

import { useState } from "react"

type Axis = { key: string; label: string; value: number; description: string }

const CX = 160, CY = 160, R = 112

// Axes sitting at a true value of 0 all collapse to the exact center point —
// with only 1-2 axes carrying signal, the "polygon" through several
// coincident center points plus a couple of outliers renders as a spike
// instead of a shape. A small minimum radius keeps every vertex visible so
// the plot always reads as a closed shape; the value shown on hover is
// never floored, only the rendered position is.
const RADIUS_FLOOR = 0.14

function point(i: number, total: number, radius: number) {
    const angle = -Math.PI / 2 + i * ((2 * Math.PI) / total)
    return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) }
}

function valueRadius(value: number) {
    const clamped = Math.max(0, Math.min(100, value)) / 100
    return (RADIUS_FLOOR + clamped * (1 - RADIUS_FLOOR)) * R
}

// Closed Catmull-Rom spline through the vertices, converted to cubic Bezier
// segments — softens the plot into a rounded blob instead of a sharp-angled
// polygon, closer to a hand-drawn risk silhouette than a jagged star.
function smoothClosedPath(points: { x: number; y: number }[]) {
    const n = points.length
    const at = (i: number) => points[(i + n) % n]
    let d = `M ${at(0).x},${at(0).y} `
    for (let i = 0; i < n; i++) {
        const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
        const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6
        const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6
        d += `C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y} `
    }
    return d + "Z"
}

export default function RiskRadar({ axes }: { axes: Axis[] }) {
    const [hovered, setHovered] = useState<number | null>(null)

    if (!axes || axes.length === 0) return null
    const n = axes.length

    const valuePoints = axes.map((a, i) => point(i, n, valueRadius(a.value)))
    const valuePath = smoothClosedPath(valuePoints)
    const active = hovered !== null ? axes[hovered] : null

    return (
        <div className="p-4 md:p-5">
            <div className="relative w-full max-w-[380px] mx-auto">
                <svg viewBox="0 0 320 320" className="w-full h-auto overflow-visible">
                    {[0.25, 0.5, 0.75, 1].map(level => {
                        const pts = axes.map((_, i) => point(i, n, level * R))
                        return (
                            <polygon
                                key={level}
                                points={pts.map(p => `${p.x},${p.y}`).join(" ")}
                                fill="none" stroke="#e7e9ec" strokeWidth={1}
                            />
                        )
                    })}
                    {axes.map((_, i) => {
                        const p = point(i, n, R)
                        return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#e7e9ec" strokeWidth={1} />
                    })}

                    <path
                        d={valuePath}
                        fill="#FF3B00" fillOpacity={0.18} stroke="#FF3B00" strokeWidth={2.5} strokeLinejoin="round"
                        className="transition-all duration-700"
                    />
                    {valuePoints.map((p, i) => (
                        <circle
                            key={i} cx={p.x} cy={p.y}
                            r={hovered === i ? 5.5 : 4}
                            fill="#FF3B00" stroke="white" strokeWidth={1.5}
                            className="transition-all"
                        />
                    ))}

                    {axes.map((a, i) => {
                        const lp = point(i, n, R + 40)
                        const words = a.label.split(" ")
                        return (
                            <g
                                key={a.key}
                                onMouseEnter={() => setHovered(i)}
                                onMouseLeave={() => setHovered(null)}
                                className="cursor-default"
                            >
                                <circle cx={lp.x} cy={lp.y} r={28} fill="transparent" />
                                <text
                                    x={lp.x} y={lp.y - ((words.length - 1) * 5)}
                                    textAnchor="middle"
                                    fontSize={8.5}
                                    fontFamily="ui-monospace, monospace"
                                    fontWeight={hovered === i ? 700 : 600}
                                    fill={hovered === i ? "#FF3B00" : "#4b5563"}
                                    className="uppercase select-none transition-colors"
                                >
                                    {words.map((word, wi) => (
                                        <tspan key={wi} x={lp.x} dy={wi === 0 ? 0 : 10}>{word}</tspan>
                                    ))}
                                </text>
                            </g>
                        )
                    })}
                </svg>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 min-h-[54px]">
                {active ? (
                    <div className="pl-3 border-l-2 border-l-[#FF3B00] transition-colors">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF3B00]">{active.label}</span>
                            <span className="text-[10px] font-mono font-bold text-gray-700">{active.value}/100</span>
                        </div>
                        <p className="text-[10px] font-mono text-gray-500 leading-relaxed">{active.description}</p>
                    </div>
                ) : (
                    <p className="text-[9px] font-mono text-gray-400 uppercase tracking-wider text-center pt-1">Hover an axis for details</p>
                )}
            </div>
        </div>
    )
}
