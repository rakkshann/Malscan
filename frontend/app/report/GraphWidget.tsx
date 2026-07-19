"use client"

import { useMemo, useRef, useState } from "react"
import { Network, Globe, Server, Building2, Flag, ShieldAlert, X, RotateCcw } from "lucide-react"

type GraphNode = { id: string; label: string; type: string; risk: "high" | "medium" | "neutral" }
type GraphEdge = { source: string; target: string; relationship: string }
type Point = { x: number; y: number }

const RISK_COLOR: Record<string, string> = {
    high: "#ef4444",
    medium: "#f59e0b",
    neutral: "#64748b",
}

const TYPE_ICON: Record<string, typeof Network> = {
    artifact: ShieldAlert,
    ip: Network,
    domain: Globe,
    asn: Server,
    country: Flag,
    registrar: Building2,
}

const TYPE_LABEL: Record<string, string> = {
    artifact: "Scanned Artifact",
    ip: "IP Address",
    domain: "Domain",
    asn: "ASN",
    country: "Country",
    registrar: "Registrar",
}

const RELATIONSHIP_LABEL: Record<string, string> = {
    connects_to: "Connects to",
    references: "References",
    hosted_in_asn: "Hosted in",
    located_in: "Located in",
    registered_with: "Registered with",
}

const RISK_LABEL: Record<string, string> = {
    high: "High Risk",
    medium: "Medium Risk",
    neutral: "Neutral",
}

const VIEW = 400
const CX = 200
const MARGIN = 36
const ROW_TOP = 55
const ROW_BOTTOM = 345

// Node radius shrinks a little in crowded rows so tightly-packed levels
// (e.g. many extracted domains) still leave breathing room between circles.
function nodeRadius(type: string, rowSize = 1) {
    if (type === "artifact") return 22
    if (rowSize > 6) return 12
    if (rowSize > 4) return 14
    return 16
}

type LayoutMeta = { dy: number; chars: number; rowSize: number }
type Layout = { positions: Record<string, Point>; meta: Record<string, LayoutMeta> }

// Pure function of the node/edge lists — lays the graph out as a top-down
// tree rooted at the scanned artifact, levelled by shortest hop count. This
// is the deterministic arrangement every graph starts from (and can be
// reset back to), so the first paint always reads as deliberate, not dropped
// at random. Rows with many siblings get shorter labels and alternating
// label offsets so text doesn't collide.
function computeLayout(nodes: GraphNode[], edges: GraphEdge[]): Layout {
    const children: Record<string, string[]> = {}
    edges.forEach(e => {
        ;(children[e.source] ||= []).push(e.target)
    })

    const depth: Record<string, number> = { artifact: 0 }
    const queue: string[] = ["artifact"]
    while (queue.length) {
        const id = queue.shift() as string
        for (const childId of children[id] || []) {
            if (depth[childId] === undefined) {
                depth[childId] = depth[id] + 1
                queue.push(childId)
            }
        }
    }

    const levels: string[][] = []
    nodes.forEach(n => {
        const d = depth[n.id] ?? 1
        ;(levels[d] ||= []).push(n.id)
    })

    const maxDepth = levels.length - 1
    const rowGap = maxDepth > 0 ? (ROW_BOTTOM - ROW_TOP) / maxDepth : 0

    const positions: Record<string, Point> = {}
    const meta: Record<string, LayoutMeta> = {}
    levels.forEach((ids, d) => {
        if (!ids) return
        const y = ROW_TOP + rowGap * d
        const n = ids.length
        const chars = n <= 3 ? 15 : n <= 6 ? 11 : 8
        ids.forEach((id, i) => {
            const x = n === 1 ? CX : MARGIN + ((i + 0.5) * (VIEW - 2 * MARGIN)) / n
            positions[id] = { x, y }
            meta[id] = { dy: n > 4 && i % 2 === 1 ? 11 : 0, chars, rowSize: n }
        })
    })

    return { positions, meta }
}

const clamp = (v: number) => Math.min(VIEW - MARGIN, Math.max(MARGIN, v))

export default function GraphWidget({ nodes, edges, originLabel }: { nodes: GraphNode[]; edges: GraphEdge[]; originLabel?: string }) {
    const [hovered, setHovered] = useState<string | null>(null)
    const [selected, setSelected] = useState<string | null>(null)
    const [layout, setLayout] = useState<Layout>(() => computeLayout(nodes || [], edges || []))
    const svgRef = useRef<SVGSVGElement>(null)
    const dragRef = useRef<{ id: string; moved: boolean } | null>(null)

    // Nodes carry a stable id per indicator, so this key only changes when the
    // underlying dataset actually changes (a different report), not on every
    // parent re-render — that's what lets dragged positions stick. Reset is
    // done during render (not in an effect) to avoid an extra cascading render.
    const nodeKey = (nodes || []).map(n => n.id).join("|")
    const [prevNodeKey, setPrevNodeKey] = useState(nodeKey)
    if (nodeKey !== prevNodeKey) {
        setPrevNodeKey(nodeKey)
        setLayout(computeLayout(nodes || [], edges || []))
        setSelected(null)
    }
    const positions = layout.positions
    const meta = layout.meta

    const displayNodes = useMemo(() => {
        if (!originLabel) return nodes || []
        return (nodes || []).map(n => (n.id === "artifact" ? { ...n, label: originLabel } : n))
    }, [nodes, originLabel])

    if (!nodes || nodes.length <= 1) {
        return (
            <div className="p-8 text-center text-gray-400 text-[10px] font-mono uppercase tracking-wider">
                No infrastructure relationships were extracted for this artifact.
            </div>
        )
    }

    const hasElevatedRisk = nodes.some(n => n.id !== "artifact" && n.risk === "high")
    const isNeighbor = (id: string) =>
        edges.some(e => (e.source === hovered && e.target === id) || (e.target === hovered && e.source === id))

    // A source with many outgoing edges (a wide fan-out) can't fit an inline
    // label per line without them overlapping — drop the text there and let
    // the arrows plus the click-to-inspect panel carry that information.
    const outDegree: Record<string, number> = {}
    edges.forEach(e => { outDegree[e.source] = (outDegree[e.source] || 0) + 1 })

    const toSvgPoint = (clientX: number, clientY: number): Point | null => {
        const svg = svgRef.current
        if (!svg) return null
        const rect = svg.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return null
        return {
            x: ((clientX - rect.left) / rect.width) * VIEW,
            y: ((clientY - rect.top) / rect.height) * VIEW,
        }
    }

    const handlePointerDown = (id: string) => (e: React.PointerEvent<SVGGElement>) => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        dragRef.current = { id, moved: false }
    }

    const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        const drag = dragRef.current
        if (!drag) return
        const pt = toSvgPoint(e.clientX, e.clientY)
        if (!pt) return
        drag.moved = true
        setLayout(prev => ({ ...prev, positions: { ...prev.positions, [drag.id]: { x: clamp(pt.x), y: clamp(pt.y) } } }))
    }

    const handlePointerUp = (id: string) => () => {
        const drag = dragRef.current
        dragRef.current = null
        if (drag && drag.id === id && !drag.moved) {
            setSelected(prev => (prev === id ? null : id))
        }
    }

    const resetLayout = () => setLayout(computeLayout(nodes || [], edges || []))

    const selectedNode = selected ? displayNodes.find(n => n.id === selected) || null : null
    const selectedEdges = selected
        ? edges
              .filter(e => e.source === selected || e.target === selected)
              .map(e => {
                  const otherId = e.source === selected ? e.target : e.source
                  const other = displayNodes.find(n => n.id === otherId)
                  const direction = e.source === selected ? "→" : "←"
                  return { key: `${e.source}-${e.target}-${e.relationship}`, other, direction, relationship: e.relationship }
              })
        : []

    const artifactPos = positions.artifact || { x: CX, y: ROW_TOP }

    return (
        <div className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-mono uppercase tracking-wider text-gray-400">
                    Drag nodes to rearrange · click a node for details
                </p>
                <button
                    type="button"
                    onClick={resetLayout}
                    className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-gray-400 hover:text-[#FF3B00] transition-colors"
                    title="Reset layout"
                >
                    <RotateCcw size={11} /> Reset
                </button>
            </div>

            <div className="relative w-full max-w-[420px] mx-auto" style={{ aspectRatio: "1 / 1" }}>
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${VIEW} ${VIEW}`}
                    className="w-full h-full overflow-visible touch-none select-none"
                    onPointerMove={handlePointerMove}
                >
                    <defs>
                        <radialGradient id="graph-glow">
                            <stop offset="0%" stopColor="#FF3B00" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#FF3B00" stopOpacity="0" />
                        </radialGradient>
                        <marker id="graph-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M0,0 L10,5 L0,10 z" fill="#9aa3af" />
                        </marker>
                    </defs>

                    {/* Background catch area — click empty space to close the detail panel */}
                    <rect x={0} y={0} width={VIEW} height={VIEW} fill="transparent" onClick={() => setSelected(null)} />

                    {hasElevatedRisk && (
                        <circle cx={artifactPos.x} cy={artifactPos.y} r={72} fill="url(#graph-glow)" className="animate-pulse" />
                    )}

                    {edges.map((e, i) => {
                        const s = positions[e.source], t = positions[e.target]
                        if (!s || !t) return null
                        const sourceNode = displayNodes.find(n => n.id === e.source)
                        const targetNode = displayNodes.find(n => n.id === e.target)
                        const rs = nodeRadius(sourceNode?.type || "", meta[e.source]?.rowSize)
                        const rt = nodeRadius(targetNode?.type || "", meta[e.target]?.rowSize)
                        const dx = t.x - s.x, dy = t.y - s.y
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1
                        const ux = dx / dist, uy = dy / dist
                        const x1 = s.x + ux * (rs + 2), y1 = s.y + uy * (rs + 2)
                        const x2 = t.x - ux * (rt + 8), y2 = t.y - uy * (rt + 8)
                        const active = !hovered || hovered === e.source || hovered === e.target
                        const showLabel = (outDegree[e.source] || 1) <= 4
                        return (
                            <g key={i} opacity={active ? 0.85 : 0.15} className="transition-opacity">
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9aa3af" strokeWidth={1.5} markerEnd="url(#graph-arrow)" />
                                {showLabel && (
                                    <text
                                        x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4}
                                        textAnchor="middle" fontSize={7.5} fontFamily="ui-monospace, monospace"
                                        fill="#6b7280" paintOrder="stroke" stroke="white" strokeWidth={3}
                                    >
                                        {RELATIONSHIP_LABEL[e.relationship] || e.relationship}
                                    </text>
                                )}
                            </g>
                        )
                    })}

                    {displayNodes.map(n => {
                        const pos = positions[n.id]
                        if (!pos) return null
                        const nodeMeta = meta[n.id]
                        const Icon = TYPE_ICON[n.type] || Network
                        const color = n.type === "artifact" ? "#FF3B00" : (RISK_COLOR[n.risk] || RISK_COLOR.neutral)
                        const r = nodeRadius(n.type, nodeMeta?.rowSize)
                        const dimmed = hovered !== null && hovered !== n.id && !isNeighbor(n.id)
                        const isSelected = selected === n.id
                        const maxChars = nodeMeta?.chars ?? 15
                        const label = n.label.length > maxChars ? n.label.slice(0, maxChars - 1) + "…" : n.label
                        const iconSize = r >= 16 ? 16 : 12
                        return (
                            <g
                                key={n.id}
                                transform={`translate(${pos.x},${pos.y})`}
                                opacity={dimmed ? 0.3 : 1}
                                className="transition-opacity cursor-grab active:cursor-grabbing"
                                onMouseEnter={() => setHovered(n.id)}
                                onMouseLeave={() => setHovered(null)}
                                onPointerDown={handlePointerDown(n.id)}
                                onPointerUp={handlePointerUp(n.id)}
                            >
                                {isSelected && <circle r={r + 6} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3,3" />}
                                <circle r={r} fill="white" stroke={color} strokeWidth={2.5} />
                                <foreignObject x={-iconSize / 2} y={-iconSize / 2} width={iconSize} height={iconSize} className="pointer-events-none">
                                    <Icon size={iconSize} color={color} />
                                </foreignObject>
                                <text y={r + 13 + (nodeMeta?.dy ?? 0)} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="#4b5563">
                                    {label}
                                </text>
                                <title>{n.label} ({TYPE_LABEL[n.type] || n.type})</title>
                            </g>
                        )
                    })}
                </svg>
            </div>

            {selectedNode && (
                <div className="mt-3 border border-gray-200 rounded-lg bg-gray-50 p-3 relative">
                    <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                        aria-label="Close details"
                    >
                        <X size={14} />
                    </button>
                    <div className="flex items-start gap-2 pr-6">
                        <div
                            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-white border-2"
                            style={{ borderColor: selectedNode.type === "artifact" ? "#FF3B00" : (RISK_COLOR[selectedNode.risk] || RISK_COLOR.neutral) }}
                        >
                            {(() => {
                                const Icon = TYPE_ICON[selectedNode.type] || Network
                                const color = selectedNode.type === "artifact" ? "#FF3B00" : (RISK_COLOR[selectedNode.risk] || RISK_COLOR.neutral)
                                return <Icon size={14} color={color} />
                            })()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-mono uppercase tracking-wider text-gray-400">
                                {TYPE_LABEL[selectedNode.type] || selectedNode.type}
                            </p>
                            <p className="text-xs font-mono text-[#121212] break-all">{selectedNode.label}</p>
                            {selectedNode.type !== "artifact" && (
                                <span
                                    className="inline-block mt-1 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
                                    style={{
                                        color: RISK_COLOR[selectedNode.risk] || RISK_COLOR.neutral,
                                        backgroundColor: `${RISK_COLOR[selectedNode.risk] || RISK_COLOR.neutral}1a`,
                                    }}
                                >
                                    {RISK_LABEL[selectedNode.risk] || selectedNode.risk}
                                </span>
                            )}
                        </div>
                    </div>

                    {selectedEdges.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                            {selectedEdges.map(se => (
                                <div key={se.key} className="text-[10px] font-mono text-gray-500 flex items-center gap-1.5">
                                    <span className="text-gray-400">{se.direction}</span>
                                    <span>{RELATIONSHIP_LABEL[se.relationship] || se.relationship}</span>
                                    <span className="text-[#121212] truncate">{se.other?.label ?? se.other?.id}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-3 pt-4 border-t border-gray-100">
                {Object.entries(TYPE_LABEL).map(([type, label]) => {
                    const Icon = TYPE_ICON[type]
                    return (
                        <div key={type} className="flex items-center gap-1.5 text-[9px] font-mono uppercase text-gray-500">
                            <Icon size={11} className="text-gray-400" /> {label}
                        </div>
                    )
                })}
                <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase text-gray-500">
                    <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" /> High Risk
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase text-gray-500">
                    <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /> Medium Risk
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase text-gray-500">
                    <div className="w-2 h-2 rounded-full bg-slate-500 shrink-0" /> Neutral
                </div>
            </div>
        </div>
    )
}
