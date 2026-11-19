/**
 * [INPUT]: 依赖 react 的 useMemo/useState；依赖 react-router-dom 的 useNavigate；依赖 lucide-react 图标；依赖 ../components 的 EmptyState/Avatar/NetworkGraph；依赖 ../store/useStore 的 data；依赖 ../util/queries 的 circlesOfPerson
 * [OUTPUT]: 导出 NetworkPage 组件
 * [POS]: 以独立的「我」为中心的关系地图；支持按分组/圈子/标签展开、同一人多簇与全屏；不保存联系人之间的关系边；路由 /network
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Layers, Locate, Tag, Users } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { Avatar } from '../components/PersonCard'
import { NetworkGraph } from '../components/NetworkGraph'
import { useStore } from '../store/useStore'
import { circlesOfPerson } from '../util/queries'

type ClusterBy = 'group' | 'circle' | 'tag'

export function NetworkPage() {
  const data = useStore((s) => s.data)
  const navigate = useNavigate()
  const [clusterBy, setClusterBy] = useState<ClusterBy>('group')
  const [focusId, setFocusId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const focus = focusId ? data.people.find((p) => p.id === focusId) : undefined
  const focusCircles = focus ? circlesOfPerson(data, focus) : []
  const matches = useMemo(
    () =>
      query.trim()
        ? data.people.filter((p) => p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 6)
        : [],
    [data.people, query],
  )

  if (data.people.length === 0) {
    return (
      <div className="content">
        <div className="page-header"><h1 className="page-title">关系网</h1></div>
        <EmptyState title="还没有联系人" actionLabel="添加联系人" onAction={() => navigate('/person/new')} />
      </div>
    )
  }

  const modeLabel = clusterBy === 'group' ? '分组' : clusterBy === 'circle' ? '圈子' : '标签'

  return (
    <div className="content">
      <div className="page-header">
        <h1 className="page-title">关系网</h1>
        <span className="page-count tabular">{data.people.length} 人</span>
      </div>
      <p className="hint" style={{ marginBottom: 'var(--sp-3)' }}>
        以你为中心，按{modeLabel}展开。{data.me ? `当前用户：${data.me.name}。` : ''}同一个人可同时出现在多个簇中。
      </p>

      <div className="ng-toolbar">
        <div className="segmented" role="group" aria-label="关系网展开方式">
          <button type="button" className={`segmented-item${clusterBy === 'group' ? ' segmented-item-active' : ''}`} aria-pressed={clusterBy === 'group'} onClick={() => setClusterBy('group')}>
            <Users size={15} aria-hidden="true" /> 按分组
          </button>
          <button type="button" className={`segmented-item${clusterBy === 'circle' ? ' segmented-item-active' : ''}`} aria-pressed={clusterBy === 'circle'} onClick={() => setClusterBy('circle')}>
            <Layers size={15} aria-hidden="true" /> 按圈子
          </button>
          <button type="button" className={`segmented-item${clusterBy === 'tag' ? ' segmented-item-active' : ''}`} aria-pressed={clusterBy === 'tag'} onClick={() => setClusterBy('tag')}>
            <Tag size={15} aria-hidden="true" /> 按标签
          </button>
        </div>
        <div className="ng-search">
          <Locate size={16} aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches.length > 0) {
                setFocusId(matches[0].id)
                setQuery('')
              }
            }}
            placeholder="定位某个人"
            aria-label="按姓名定位到关系网中的某个人"
          />
        </div>
        {focusId && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFocusId(null)}>
            看全图
          </button>
        )}
      </div>

      {matches.length > 0 && (
        <div className="ng-matches" role="listbox" aria-label="匹配的人">
          {matches.map((person) => (
            <button
              key={person.id}
              type="button"
              role="option"
              aria-selected={person.id === focusId}
              className="tag-chip tag-chip-link"
              onClick={() => { setFocusId(person.id); setQuery('') }}
            >
              {person.name}
            </button>
          ))}
        </div>
      )}

      {focus ? (
        <div className="card ng-focus-card">
          <Avatar person={focus} />
          <div className="ng-focus-body">
            <div className="ng-focus-title">
              <span className="card-title">{focus.name}</span>
            </div>
            <p className="hint tabular">
              {focus.groups.length ? focus.groups.join('、') : '未分组'}
              {focusCircles.length ? ` · ${focusCircles.map((circle) => circle.name).join('、')}` : ''}
              {focus.tags.length ? ` · ${focus.tags.join('、')}` : ''}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/person/${focus.id}`)}>
            查看详情 <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="ng-map-note">
          <span className="hint">点击圆点聚焦；非全屏时滚轮滚动页面，全屏后滚轮缩放；拖拽平移。</span>
        </div>
      )}

      <div className="card ng-card">
        <NetworkGraph
          people={data.people}
          me={data.me}
          groups={data.groups}
          circles={data.circles}
          tags={data.tags}
          clusterBy={clusterBy}
          focusId={focusId}
          onFocus={setFocusId}
        />
      </div>
    </div>
  )
}
