/**
 * [INPUT]: 依赖 React、联系人分类数据和浏览器的指针及全屏接口。
 * [OUTPUT]: 导出 NetworkGraph 画布及其图例。
 * [POS]: 按归类方式布置联系人节点。画布支持平移、缩放和姓名定位。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Maximize2, Minimize2, Minus, Plus, RotateCcw } from 'lucide-react'
import type { Circle, Person } from '../types'
import { initials } from '../util/format'

const VIEW = 1600
const CENTER = VIEW / 2
const BASE_R = 250
const ROW_GAP = 58
const NODE_ARC = 52
const CLUSTER_GAP = 0.07
const COLORS = ['#414fc2', '#286e72', '#9a5164', '#7656a3', '#9a682d', '#38739f', '#5e733b']
const MODES = { group: '分组', circle: '圈子', tag: '标签' } as const
const DEFAULT_VIEW = { x: 0, y: 0, k: 1 }

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
  locateRequest: { id: string } | null
  details?: ReactNode
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
          key: `group:${group}`,
          label: group,
          members: people.filter((person) => person.groups.includes(group)),
        })),
        {
          key: 'unclassified',
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
            key: 'unclassified',
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
            key: 'unclassified',
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
  const gap = Math.min(CLUSTER_GAP, (Math.PI * 2) / (clusters.length * 4))
  const usable = Math.PI * 2 - gap * clusters.length
  let cursor = -Math.PI / 2

  for (const cluster of clusters) {
    const share = (cluster.members.length / total) * usable
    cluster.start = cursor
    cluster.end = cursor + share
    cursor += share + gap

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
  const inner = BASE_R - 76
  const outer = cluster.maxRadius + 40
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

export function NetworkGraph({
  people, me, groups, circles, tags, clusterBy, focusId, locateRequest, details, onFocus,
}: NetworkGraphProps) {
  const shellRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const viewportRef = useRef<SVGGElement>(null)
  const pointers = useRef(new Map<number, Position>())
  const panning = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const dragged = useRef(false)
  const pinch = useRef<{ dist: number; anchor: Position; view: typeof DEFAULT_VIEW } | null>(null)
  const view = useRef(DEFAULT_VIEW)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const { clusters, positions } = useMemo(() => {
    const clusters = buildClusters(people, groups, circles, tags, clusterBy)
    return { clusters, positions: layoutClusters(clusters) }
  }, [people, groups, circles, tags, clusterBy])
  const maxRadius = clusters.reduce((max, cluster) => Math.max(max, cluster.maxRadius), BASE_R)
  const extent = Math.max(390, maxRadius + 112)
  const focusClusterKeys = new Set(
    focusId
      ? clusters.filter((cluster) => cluster.members.some((member) => member.person.id === focusId)).map((cluster) => cluster.key)
      : [],
  )
  const showNames = clusters.reduce((count, cluster) => count + cluster.members.length, 0) <= 22

  const setView = useCallback((next: typeof DEFAULT_VIEW) => {
    // 连续指针事件只更新 SVG 变换，分类和节点保持不动。
    view.current = next
    viewportRef.current?.setAttribute('transform', `translate(${next.x} ${next.y}) scale(${next.k})`)
  }, [])

  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const matrix = svgRef.current?.getScreenCTM()
    return matrix ? new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse()) : { x: 0, y: 0 }
  }, [])

  const zoomAt = useCallback((factor: number, point: Position) => {
    const current = view.current
    const k = Math.min(4, Math.max(0.35, current.k * factor))
    const ratio = k / current.k
    setView({
      k,
      x: point.x - (point.x - current.x) * ratio,
      y: point.y - (point.y - current.y) * ratio,
    })
  }, [setView])

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === shellRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !isFullscreen) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomAt(event.deltaY < 0 ? 1.12 : 0.89, toViewBox(event.clientX, event.clientY))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [isFullscreen, toViewBox, zoomAt])

  useEffect(() => {
    if (!locateRequest) return
    const member = clusters.flatMap((cluster) => cluster.members).find(({ person }) => person.id === locateRequest.id)
    const position = member ? positions.get(member.key) : undefined
    if (!position) return
    const { k } = view.current
    setView({ k, x: CENTER - position.x * k, y: CENTER - position.y * k })
  }, [clusters, locateRequest, positions, setView])

  const toggleFullscreen = () => {
    const shell = shellRef.current
    if (!shell || !document.fullscreenEnabled) return
    const action = document.fullscreenElement === shell ? document.exitFullscreen() : shell.requestFullscreen()
    void action.catch(() => undefined)
  }

  const startPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || pointers.current.size >= 2) return
    const { pointerId, clientX, clientY, currentTarget } = event
    pointers.current.set(pointerId, { x: clientX, y: clientY })
    if (pointers.current.size === 1) {
      dragged.current = false
      panning.current = { startX: clientX, startY: clientY, originX: view.current.x, originY: view.current.y }
      return
    }
    dragged.current = true
    const [a, b] = [...pointers.current.values()]
    pinch.current = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      anchor: toViewBox((a.x + b.x) / 2, (a.y + b.y) / 2),
      view: view.current,
    }
    for (const id of pointers.current.keys()) currentTarget.setPointerCapture(id)
  }

  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    const { pointerId, clientX, clientY, currentTarget } = event
    if (!pointers.current.has(pointerId)) return
    pointers.current.set(pointerId, { x: clientX, y: clientY })
    const initial = pinch.current
    if (initial) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (dist === 0 || initial.dist === 0) return
      const mid = toViewBox((a.x + b.x) / 2, (a.y + b.y) / 2)
      const k = Math.min(4, Math.max(0.35, initial.view.k * dist / initial.dist))
      const ratio = k / initial.view.k
      setView({
        k,
        x: mid.x - (initial.anchor.x - initial.view.x) * ratio,
        y: mid.y - (initial.anchor.y - initial.view.y) * ratio,
      })
      return
    }
    const pan = panning.current
    if (!pan) return
    if (!dragged.current) {
      if (Math.hypot(clientX - pan.startX, clientY - pan.startY) < 5) return
      dragged.current = true
      currentTarget.setPointerCapture(pointerId)
    }
    const start = toViewBox(pan.startX, pan.startY)
    const current = toViewBox(clientX, clientY)
    setView({ ...view.current, x: pan.originX + current.x - start.x, y: pan.originY + current.y - start.y })
  }

  const end = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.delete(event.pointerId)) return
    pinch.current = null
    const remaining = pointers.current.values().next().value
    panning.current = remaining
      ? { startX: remaining.x, startY: remaining.y, originX: view.current.x, originY: view.current.y }
      : null
  }

  return (
    <div className="ng-workbench">
      <div className="ng-shell" ref={shellRef}>
        <svg
          ref={svgRef}
          className="ng-canvas ng-map"
          viewBox={`${CENTER - extent} ${CENTER - extent} ${extent * 2} ${extent * 2}`}
          role="group"
          aria-label={`关系网：以我为中心，按${MODES[clusterBy]}展开`}
          onPointerDown={startPan}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) end(event)
          }}
          onClick={(event) => {
            if (!dragged.current && event.target === event.currentTarget) onFocus(null)
          }}
        >
          <g ref={viewportRef}>
            <g className="ng-orbits" aria-hidden="true">
              {[111, 173, BASE_R + 40, maxRadius + 77].map((radius) => (
                <circle key={radius} cx={CENTER} cy={CENTER} r={radius} />
              ))}
              <path d={`M ${CENTER - 173} ${CENTER} h 346 M ${CENTER} ${CENTER - 173} v 346`} />
            </g>

            {clusters.map((cluster) => {
              const angle = (cluster.start + cluster.end) / 2
              const radius = cluster.maxRadius + 65
              return (
                <g key={cluster.key} className={focusId && !focusClusterKeys.has(cluster.key) ? 'ng-cluster-dim' : ''}>
                  <path
                    d={wedgePath(cluster)}
                    fill={cluster.color}
                    stroke={cluster.color}
                    fillOpacity={focusClusterKeys.has(cluster.key) ? 0.14 : 0.072}
                    className="ng-cluster-wedge"
                    aria-hidden="true"
                  />
                  {clusters.length <= 8 && (
                    <text
                      x={CENTER + Math.cos(angle) * radius}
                      y={CENTER + Math.sin(angle) * radius}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="ng-cluster-label"
                      style={{ fill: cluster.color }}
                    >
                      {cluster.label.length > 10 ? `${cluster.label.slice(0, 9)}…` : cluster.label}
                    </text>
                  )}
                </g>
              )
            })}

            <g className="ng-self">
              <circle cx={CENTER} cy={CENTER} r={68} className="ng-self-ring" />
              <circle cx={CENTER} cy={CENTER} r={33} className="ng-self-core" />
              <text x={CENTER} y={CENTER} textAnchor="middle" dominantBaseline="central" className="ng-self-initial">
                {me ? initials(me.name) : '我'}
              </text>
              <text x={CENTER} y={CENTER + 57} textAnchor="middle" className="ng-self-label">
                {me?.name || '我'}
              </text>
            </g>

            {clusters.flatMap((cluster) =>
              cluster.members.map(({ person, key }) => {
                const position = positions.get(key)
                if (!position) return null
                const isFocus = focusId === person.id
                const dim = Boolean(focusId) && !focusClusterKeys.has(cluster.key)
                return (
                  <g
                    key={key}
                    transform={`translate(${position.x} ${position.y})`}
                    className={`ng-person${dim ? ' ng-dim' : ''}${showNames ? ' ng-person-named' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isFocus}
                    aria-label={`${person.name}，点击聚焦`}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (!dragged.current || event.detail === 0) onFocus(isFocus ? null : person.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onFocus(isFocus ? null : person.id)
                      }
                    }}
                  >
                    <title>{`${person.name} · ${cluster.label}`}</title>
                    <circle r={24} className="ng-person-hit" />
                    <circle r={14} fill={cluster.color} className="ng-person-halo" />
                    <circle r={7} className="ng-person-dot" stroke={cluster.color} />
                    <text y={26} textAnchor="middle" className="ng-person-label">
                      {person.name}
                    </text>
                  </g>
                )
              }),
            )}
          </g>
        </svg>

        <div className="ng-controls" role="group" aria-label="地图操作">
          <div className="ng-control-pair">
            <button type="button" className="ng-control" aria-label="放大" title="放大" onClick={() => zoomAt(1.2, { x: CENTER, y: CENTER })}>
              <Plus size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button type="button" className="ng-control" aria-label="缩小" title="缩小" onClick={() => zoomAt(0.83, { x: CENTER, y: CENTER })}>
              <Minus size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
          <div className="ng-control-pair">
            <button type="button" className="ng-control" aria-label="重置" title="重置视图" onClick={() => setView(DEFAULT_VIEW)}>
              <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
            {document.fullscreenEnabled && (
              <button
                type="button"
                className="ng-control"
                aria-label={isFullscreen ? '退出全屏' : '全屏查看'}
                title={isFullscreen ? '退出全屏' : '全屏查看'}
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>

        <div className="ng-map-key" aria-hidden="true">
          <span><i className="ng-key-self" />我</span>
          <span><i className="ng-key-person" />联系人</span>
        </div>
      </div>

      <aside className="ng-aside" aria-label="图谱信息">
        {details}
        <section className="ng-clusters" aria-label={`${MODES[clusterBy]}图例`}>
          <h2>{MODES[clusterBy]}图例</h2>
          <ul>
            {clusters.map((cluster) => (
              <li key={cluster.key} className={focusClusterKeys.has(cluster.key) ? 'ng-cluster-active' : undefined}>
                <i style={{ backgroundColor: cluster.color }} aria-hidden="true" />
                <span title={cluster.label}>{cluster.label}</span>
                <span className="tabular" aria-label={`${cluster.members.length} 位联系人`}>{cluster.members.length}</span>
              </li>
            ))}
          </ul>
        </section>
        <p className="ng-instructions">点选联系人查看资料，拖动空白处移动地图。</p>
      </aside>
    </div>
  )
}
