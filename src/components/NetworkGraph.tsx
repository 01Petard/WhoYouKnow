/**
 * [INPUT]: 依赖 react 的 hooks 与指针事件类型；依赖 lucide-react 的 Maximize2/Minimize2；依赖 ../types 的 Person/Circle
 * [OUTPUT]: 导出 NetworkGraph 组件
 * [POS]: 关系网的唯一渲染器；以独立于 people 的「我」为中心，按分组/圈子/标签把联系人排成可缩放地图；同一人可多簇；支持全屏
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import type { Circle, Person } from '../types'

const VIEW = 1600
const CENTER = VIEW / 2
const BASE_R = 250
const ROW_GAP = 58
const NODE_ARC = 52
const CLUSTER_GAP = 0.07
const COLORS = ['#325B8F', '#2F7D6B', '#B07A28', '#8A5A8F', '#B25A4A', '#4A7BA6', '#7A8A3A', '#9B6A4A']

interface ClusterMember {
  person: Person
  /** 同一人可出现在多个簇，key 必须带簇标识 */
  key: string
}

interface Cluster {
  key: string
  label: string
  color: string
  members: ClusterMember[]
  start: number
  end: number
  maxRadius: number
}

interface Position {
  x: number
  y: number
}

interface NetworkGraphProps {
  people: Person[]
  me: Person | null
  groups: string[]
  circles: Circle[]
  tags: string[]
  clusterBy: 'group' | 'circle' | 'tag'
  focusId: string | null
  onFocus: (id: string | null) => void
}

/** 按分组/圈子建立多成员簇：同一人属于多个分组或圈子时会出现在多个簇中 */
function buildClusters(
  people: Person[],
  groups: string[],
  circles: Circle[],
  tags: string[],
  clusterBy: 'group' | 'circle' | 'tag',
): Cluster[] {
  const raw = clusterBy === 'group'
    ? [
        ...groups.map((group) => ({
          key: group,
          label: group,
          members: people.filter((person) => person.groups.includes(group)),
        })),
        {
          key: '未分组',
          label: '未分组',
          members: people.filter((person) => person.groups.length === 0),
        },
      ]
    : clusterBy === 'circle'
      ? [
          ...circles.map((circle) => ({
            key: `circle:${circle.id}`,
            label: circle.name,
            members: people.filter((person) => circle.groups.some((group) => person.groups.includes(group))),
          })),
          {
            key: '未归类圈子',
            label: '未归类圈子',
            members: people.filter(
              (person) => !circles.some((circle) => circle.groups.some((group) => person.groups.includes(group))),
            ),
          },
        ]
      : [
          ...tags.map((tag) => ({
            key: `tag:${tag}`,
            label: tag,
            members: people.filter((person) => person.tags.includes(tag)),
          })),
          {
            key: '未加标签',
            label: '未加标签',
            members: people.filter((person) => person.tags.length === 0),
          },
        ]

  return raw
    .filter((cluster) => cluster.members.length > 0)
    .map((cluster, index) => ({
      key: cluster.key,
      label: cluster.label,
      color: COLORS[index % COLORS.length],
      members: cluster.members
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
        .map((person) => ({ person, key: `${person.id}@${cluster.key}` })),
      start: 0,
      end: 0,
      maxRadius: BASE_R,
    }))
}

function layoutClusters(clusters: Cluster[]): Map<string, Position> {
  const positions = new Map<string, Position>()
  const total = clusters.reduce((sum, cluster) => sum + cluster.members.length, 0)
  if (total === 0) return positions
  const usable = Math.PI * 2 - CLUSTER_GAP * clusters.length
  let cursor = -Math.PI / 2

  for (const cluster of clusters) {
    const share = (cluster.members.length / total) * usable
    cluster.start = cursor
    cluster.end = cursor + share
    cursor += share + CLUSTER_GAP

    let index = 0
    let row = 0
    while (index < cluster.members.length) {
      const radius = BASE_R + row * ROW_GAP
      const capacity = Math.max(1, Math.floor(((cluster.end - cluster.start) * radius) / NODE_ARC))
      for (let slot = 0; slot < capacity && index < cluster.members.length; slot += 1, index += 1) {
        const angle = cluster.start + (cluster.end - cluster.start) * ((slot + 0.5) / capacity)
        positions.set(cluster.members[index].key, {
          x: CENTER + Math.cos(angle) * radius,
          y: CENTER + Math.sin(angle) * radius,
        })
      }
      row += 1
    }
    cluster.maxRadius = BASE_R + (row - 1) * ROW_GAP
  }
  return positions
}

function wedgePath(cluster: Cluster): string {
  const inner = Math.max(BASE_R - 90, 40)
  const outer = cluster.maxRadius + 54
  const a0 = cluster.start
  const a1 = cluster.end
  const large = a1 - a0 > Math.PI ? 1 : 0
  const p = (r: number, a: number) => `${CENTER + Math.cos(a) * r} ${CENTER + Math.sin(a) * r}`
  return [
    `M ${p(inner, a0)}`,
    `L ${p(outer, a0)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${p(outer, a1)}`,
    `L ${p(inner, a1)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${p(inner, a0)}`,
    'Z',
  ].join(' ')
}

export function NetworkGraph({ people, me, groups, circles, tags, clusterBy, focusId, onFocus }: NetworkGraphProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const panning = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const pinch = useRef<{ dist: number; k: number } | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === shellRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const clusters = useMemo(
    () => buildClusters(people, groups, circles, tags, clusterBy),
    [people, groups, circles, tags, clusterBy],
  )
  const positions = useMemo(() => layoutClusters(clusters), [clusters])
  const maxRadius = clusters.reduce((max, cluster) => Math.max(max, cluster.maxRadius), BASE_R)
  const extent = Math.max(440, maxRadius + 120)
  const focusClusterKeys = new Set(
    focusId
      ? clusters.filter((cluster) => cluster.members.some((member) => member.person.id === focusId)).map((cluster) => cluster.key)
      : [],
  )

  const toViewBox = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: ((clientX - rect.left) / rect.width) * extent * 2 + (CENTER - extent),
      y: ((clientY - rect.top) / rect.height) * extent * 2 + (CENTER - extent),
    }
  }

  const zoomAt = (factor: number, point: { x: number; y: number }) => {
    setView((current) => {
      const k = Math.min(4, Math.max(0.35, current.k * factor))
      const ratio = k / current.k
      return {
        k,
        x: point.x - (point.x - current.x) * ratio,
        y: point.y - (point.y - current.y) * ratio,
      }
    })
  }

  const toggleFullscreen = () => {
    const shell = shellRef.current
    if (!shell || !document.fullscreenEnabled) return
    if (document.fullscreenElement === shell) void document.exitFullscreen()
    else void shell.requestFullscreen()
  }

  const startPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    const point = toViewBox(event.clientX, event.clientY)
    pointers.current.set(event.pointerId, point)
    panning.current = { startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pointers.current.size === 2) {
      pointers.current.set(event.pointerId, toViewBox(event.clientX, event.clientY))
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (!pinch.current) {
        pinch.current = { dist, k: view.k }
      } else if (dist > 0) {
        const factor = dist / pinch.current.dist
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        setView((current) => {
          const k = Math.min(4, Math.max(0.35, pinch.current!.k * factor))
          const ratio = k / current.k
          return { k, x: mid.x - (mid.x - current.x) * ratio, y: mid.y - (mid.y - current.y) * ratio }
        })
      }
      return
    }
    if (!panning.current) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const unit = (extent * 2) / rect.width
    setView((current) => ({
      ...current,
      x: panning.current!.originX + (event.clientX - panning.current!.startX) * unit,
      y: panning.current!.originY + (event.clientY - panning.current!.startY) * unit,
    }))
  }

  const end = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) panning.current = null
  }

  return (
    <div className="ng-shell" ref={shellRef}>
      <svg
        ref={svgRef}
        className="ng-canvas ng-map"
        viewBox={`${CENTER - extent} ${CENTER - extent} ${extent * 2} ${extent * 2}`}
        role="group"
        aria-label={`关系网：以我为中心，按${clusterBy === 'group' ? '分组' : clusterBy === 'circle' ? '圈子' : '标签'}展开`}
        onPointerDown={startPan}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onWheel={(event) => {
          // 非全屏时把滚轮留给页面滚动；只有全屏才缩放地图
          if (!isFullscreen) return
          event.preventDefault()
          zoomAt(event.deltaY < 0 ? 1.12 : 0.89, toViewBox(event.clientX, event.clientY))
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) onFocus(null)
        }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {clusters.map((cluster) => (
            <g key={cluster.key} className={focusId && !focusClusterKeys.has(cluster.key) ? 'ng-cluster-dim' : ''}>
              <path
                d={wedgePath(cluster)}
                fill={cluster.color}
                fillOpacity={focusClusterKeys.has(cluster.key) ? 0.14 : 0.06}
                className="ng-cluster-wedge"
              />
              <text
                x={CENTER + Math.cos((cluster.start + cluster.end) / 2) * (cluster.maxRadius + 82)}
                y={CENTER + Math.sin((cluster.start + cluster.end) / 2) * (cluster.maxRadius + 82)}
                textAnchor="middle"
                className="ng-cluster-label"
                style={{ fill: cluster.color }}
              >
                {cluster.label}
              </text>
            </g>
          ))}

          <g className="ng-self">
            <circle cx={CENTER} cy={CENTER} r={84} className="ng-self-ring" />
            <circle cx={CENTER} cy={CENTER} r={9} className="ng-self-core" />
            <text x={CENTER} y={CENTER - 20} textAnchor="middle" className="ng-self-label">
              {me?.name ?? '我'} · 我
            </text>
          </g>

          {clusters.flatMap((cluster) =>
            cluster.members.map((member) => {
              const position = positions.get(member.key)
              if (!position) return null
              const person = member.person
              const isFocus = focusId === person.id
              const isHover = hoverId === person.id
              const dim = Boolean(focusId) && !focusClusterKeys.has(cluster.key)
              const radius = isFocus || isHover ? 7 : 4.6
              return (
                <g
                  key={member.key}
                  transform={`translate(${position.x} ${position.y})`}
                  className={`ng-person${isFocus ? ' ng-person-focus' : ''}${dim ? ' ng-dim' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isFocus}
                  aria-label={`${person.name}，点击聚焦`}
                  onPointerEnter={() => setHoverId(person.id)}
                  onPointerLeave={() => setHoverId(null)}
                  onClick={(event) => {
                    event.stopPropagation()
                    onFocus(isFocus ? null : person.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onFocus(isFocus ? null : person.id)
                    }
                  }}
                >
                  <title>{`${person.name}${person.groups.length ? ` · ${person.groups.join('、')}` : ''}`}</title>
                  <circle r={radius + 5} className="ng-person-hit" />
                  <circle r={radius} className="ng-person-dot" style={{ stroke: cluster.color }} />
                  <text y={radius + 13} textAnchor="middle" className="ng-person-label">
                    {person.name}
                  </text>
                </g>
              )
            }),
          )}
        </g>
      </svg>

      <div className="ng-controls">
        <button type="button" className="ng-control" aria-label="放大" onClick={() => zoomAt(1.2, { x: CENTER, y: CENTER })}>＋</button>
        <button type="button" className="ng-control" aria-label="缩小" onClick={() => zoomAt(0.83, { x: CENTER, y: CENTER })}>－</button>
        <button type="button" className="ng-control" aria-label={isFullscreen ? '退出全屏' : '全屏查看'} onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
        </button>
        <button type="button" className="ng-control ng-control-text" onClick={() => setView({ x: 0, y: 0, k: 1 })}>重置</button>
      </div>

      <div className="ng-legend" aria-hidden="true">
        <span><i className="ng-legend-self" />我</span>
        <span><i className="ng-legend-dot" />联系人</span>
      </div>
    </div>
  )
}
