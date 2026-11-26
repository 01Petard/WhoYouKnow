/**
 * [INPUT]: 依赖 React、路由、联系人查询和 NetworkGraph 的画布与图例。
 * [OUTPUT]: 导出 NetworkPage。
 * [POS]: 在关系网页切换分类。将选中的联系人资料交给画布侧栏。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Layers, Network, Search, Tag, UsersRound, X } from 'lucide-react'
import { Avatar } from '../components/PersonCard'
import { NetworkGraph } from '../components/NetworkGraph'
import { useStore } from '../store/useStore'
import { circlesOfPerson } from '../util/queries'

const MODES = [
  { key: 'group', label: '按分组', icon: UsersRound },
  { key: 'circle', label: '按圈子', icon: Layers },
  { key: 'tag', label: '按标签', icon: Tag },
] as const

type ClusterBy = (typeof MODES)[number]['key']

export function NetworkPage() {
  const data = useStore((state) => state.data)
  const [clusterBy, setClusterBy] = useState<ClusterBy>('group')
  const [focusId, setFocusId] = useState<string | null>(null)
  const [locateRequest, setLocateRequest] = useState<{ id: string } | null>(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const resultId = useId()
  const searchTerm = query.trim().toLocaleLowerCase()
  const showResults = searchOpen && Boolean(searchTerm)
  const focus = focusId ? data.people.find((person) => person.id === focusId) : undefined
  const focusCircles = focus ? circlesOfPerson(data, focus) : []
  const matches = useMemo(
    () => searchTerm
      ? data.people.filter((person) => person.name.toLocaleLowerCase().includes(searchTerm)).slice(0, 6)
      : [],
    [data.people, searchTerm],
  )

  function focusNode(id: string | null) {
    setFocusId(id)
    setLocateRequest(null)
  }

  function locate(id: string) {
    setFocusId(id)
    setLocateRequest({ id })
    setQuery('')
    setSearchOpen(false)
  }

  return (
    <div className="content network-page">
      <header className="page-header ng-page-header">
        <div>
          <h1 className="page-title">关系网</h1>
          <p className="page-count tabular">{data.people.length} 位联系人</p>
        </div>
      </header>

      {data.people.length === 0 ? (
        <div className="ng-empty">
          <span className="ng-empty-icon"><Network size={26} strokeWidth={1.6} aria-hidden="true" /></span>
          <h2>还没有联系人</h2>
          <p>添加联系人后，可以按分组、圈子或标签查看关系网。</p>
          <Link className="btn btn-primary" to="/person/new">添加联系人</Link>
        </div>
      ) : (
        <section className="ng-section" aria-label="联系人地图">
          <div className="ng-toolbar">
            <div className="ng-modes" role="group" aria-label="关系网展开方式">
              {MODES.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={clusterBy === key}
                  onClick={() => setClusterBy(key)}
                >
                  <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            <div
              className="ng-lookup"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false)
              }}
            >
              <div className="search-field ng-search">
                <Search size={16} strokeWidth={1.8} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && matches[0]) locate(matches[0].id)
                    if (event.key === 'Escape' && showResults) {
                      event.stopPropagation()
                      setSearchOpen(false)
                    }
                  }}
                  aria-controls={showResults ? resultId : undefined}
                  placeholder="定位某个人"
                  aria-label="按姓名定位到关系网中的某个人"
                />
                {query && (
                  <button
                    type="button"
                    className="ng-clear-search"
                    aria-label="清除姓名"
                    onClick={() => setQuery('')}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>

              {showResults && (
                <div className="ng-results" id={resultId} role="group" aria-label="匹配的人">
                  {matches.length === 0 ? (
                    <p className="hint" role="status">没有匹配的联系人</p>
                  ) : matches.map((person) => (
                    <button type="button" className="ng-result" key={person.id} onClick={() => locate(person.id)}>
                      <Avatar person={person} small />
                      <span>{person.name}</span>
                      <ArrowUpRight size={15} strokeWidth={1.7} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <NetworkGraph
            people={data.people}
            me={data.me}
            groups={data.groups}
            circles={data.circles}
            tags={data.tags}
            clusterBy={clusterBy}
            focusId={focus?.id ?? null}
            locateRequest={locateRequest}
            onFocus={focusNode}
            details={focus && (
              <section className="ng-details" aria-label="当前选中的联系人" tabIndex={0}>
                <div className="ng-details-head">
                  <Avatar person={focus} />
                  <h2>{focus.name}</h2>
                  <button
                    type="button"
                    className="ng-close-focus"
                    aria-label="清除聚焦"
                    onClick={() => focusNode(null)}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <dl>
                  <div><dt>认识渠道</dt><dd>{focus.channel || '未填写'}</dd></div>
                  <div><dt>认识时间</dt><dd>{focus.metAt || '未填写'}</dd></div>
                  <div><dt>生日</dt><dd>{focus.birthday || '未填写'}</dd></div>
                  <div><dt>性别</dt><dd>{focus.gender || '未填写'}</dd></div>
                  <div><dt>上次联系</dt><dd>{focus.lastContactAt || '未记录'}</dd></div>
                  <div><dt>重要标记</dt><dd>{focus.important ? '重要联系人' : '未标记'}</dd></div>
                  <div><dt>分组</dt><dd>{focus.groups.join('、') || '未分组'}</dd></div>
                  <div><dt>圈子</dt><dd>{focusCircles.map((circle) => circle.name).join('、') || '未加入圈子'}</dd></div>
                  <div><dt>标签</dt><dd>{focus.tags.join('、') || '未添加标签'}</dd></div>
                  <div><dt>备注</dt><dd className="ng-details-note">{focus.note || '暂无备注'}</dd></div>
                </dl>
                <Link className="ng-details-link" to={`/person/${encodeURIComponent(focus.id)}`}>
                  查看详情 <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
                </Link>
              </section>
            )}
          />
        </section>
      )}
    </div>
  )
}
