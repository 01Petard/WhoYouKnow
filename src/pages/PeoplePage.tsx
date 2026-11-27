/**
 * [INPUT]: 依赖联系人查询、拼音索引、筛选状态与目录组件。
 * [OUTPUT]: 导出 PeoplePage。
 * [POS]: 人脉首页提供搜索、分类筛选及联系手记入口。目录展示分组、圈子和标签。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BookOpen, ChevronRight, Folder, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { FacetFilters } from '../components/FacetFilters'
import { PersonCard } from '../components/PersonCard'
import { useStore } from '../store/useStore'
import type { FilterState } from '../types'
import { FOLLOW_UP_DAYS, UNCLASSIFIED } from '../util/constants'
import { groupContacts } from '../util/contactIndex'
import { circlesOfPerson, filterPeople } from '../util/queries'

const peopleViews = [
  { key: 'all', label: '全部' },
  { key: 'important', label: '重要' },
  { key: 'followUp', label: '待联系' },
] as const

const emptyFilter: FilterState = { groups: [], circles: [], tags: [] }

export function PeoplePage() {
  const data = useStore((state) => state.data)
  const { peopleSearch, peopleView, peopleFilter } = useStore((state) => state.ui)
  const setUi = useStore((state) => state.setUi)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const people = useMemo(
    () => filterPeople(data, { search: peopleSearch, view: peopleView, ...peopleFilter }),
    [data, peopleSearch, peopleView, peopleFilter],
  )
  const groups = useMemo(() => groupContacts(people), [people])
  const overview = useMemo(() => {
    const groupCounts = new Map<string, number>()
    let important = 0
    for (const person of data.people) {
      if (person.important) important += 1
      for (const group of new Set(person.groups)) {
        groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1)
      }
    }
    return {
      all: data.people.length,
      important,
      followUp: filterPeople(data, { search: '', view: 'followUp', ...emptyFilter }).length,
      groupCounts,
    }
  }, [data])

  const facets = [
    { key: 'groups', label: '分组', options: data.groups.map((name) => ({ value: name, label: name })) },
    { key: 'circles', label: '圈子', options: data.circles.map(({ id, name }) => ({ value: id, label: name })) },
    { key: 'tags', label: '标签', options: data.tags.map((name) => ({ value: name, label: name })) },
  ] as const
  const selectedCount = peopleFilter.groups.length + peopleFilter.circles.length + peopleFilter.tags.length
  const clearFacets = () => setUi({ peopleFilter: emptyFilter })

  function setFacet(key: string, values: string[]) {
    if (key !== 'groups' && key !== 'circles' && key !== 'tags') return
    setUi({ peopleFilter: { ...peopleFilter, [key]: values } })
  }

  return (
    <div className="content directory">
      <header className="page-header directory-heading">
        <div>
          <h1 className="page-title">人脉</h1>
          <p className="page-count tabular">{data.people.length} 位联系人</p>
        </div>
        <div className="directory-heading-actions">
          <Link className="btn btn-secondary directory-add" to="/journal">
            <BookOpen size={17} aria-hidden="true" /> 联系手记
          </Link>
          <Link className="btn btn-primary directory-add" to="/person/new">
            <Plus size={19} strokeWidth={2} aria-hidden="true" />
            添加联系人
          </Link>
        </div>
      </header>

      <div className="directory-layout">
        <section className="directory-panel" aria-label="联系人目录">
          <div className="directory-tools">
            <div className="directory-views" role="group" aria-label="联系人视图">
              {peopleViews.map(({ key, label }) => (
                <button key={key} type="button" aria-pressed={peopleView === key} onClick={() => setUi({ peopleView: key })}>
                  {label}<span className="tabular" aria-hidden="true">{overview[key]}</span>
                </button>
              ))}
            </div>

            <div className="directory-search-row">
              <div className="search-field">
                <Search size={18} aria-hidden="true" />
                <input
                  type="search"
                  value={peopleSearch}
                  onChange={(event) => setUi({ peopleSearch: event.target.value })}
                  placeholder="搜索姓名、备注或标签"
                  aria-label="搜索姓名、备注或标签"
                />
                {peopleSearch && (
                  <button type="button" className="btn-icon" aria-label="清除搜索词" onClick={() => setUi({ peopleSearch: '' })}>
                    <X size={17} aria-hidden="true" />
                  </button>
                )}
              </div>
              <button
                type="button"
                className={`btn btn-secondary directory-filters${selectedCount ? ' directory-filters-active' : ''}`}
                aria-expanded={filtersOpen}
                aria-controls="directory-facets"
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <SlidersHorizontal size={17} aria-hidden="true" />
                筛选{selectedCount > 0 && <span className="tabular">{selectedCount}</span>}
              </button>
            </div>

            <div id="directory-facets" hidden={!filtersOpen}>
              <FacetFilters
                facets={facets.map(({ key, label, options }) => ({
                  key,
                  label,
                  selected: peopleFilter[key],
                  options: [{ value: UNCLASSIFIED, label: '未分类' }, ...options],
                }))}
                onChange={setFacet}
                onClear={clearFacets}
              />
            </div>

            {selectedCount > 0 && !filtersOpen && (
              <div className="directory-active-filters" aria-label="已启用筛选">
                {facets.flatMap(({ key, label, options }) =>
                  peopleFilter[key].map((value) => {
                    const name = value === UNCLASSIFIED ? '未分类' : options.find((option) => option.value === value)?.label ?? value
                    return (
                      <button
                        key={`${key}:${value}`}
                        type="button"
                        className="tag-chip tag-chip-link"
                        onClick={() => setFacet(key, peopleFilter[key].filter((selected) => selected !== value))}
                        aria-label={`移除${label}筛选：${name}`}
                      >
                        {name}<X size={13} aria-hidden="true" />
                      </button>
                    )
                  }),
                )}
              </div>
            )}
            {peopleView === 'followUp' && (
              <p className="hint directory-view-note">没有联系记录，或已满 {FOLLOW_UP_DAYS} 天未联系的重要联系人。</p>
            )}
          </div>

          {groups.length > 0 ? (
            <>
              <div className="directory-columns" aria-hidden="true">
                <span>姓名</span><span>分组</span><span>圈子</span><span>标签</span><span />
              </div>
              {groups.map(({ key, people: members }) => (
                <section className="contact-group" key={key} aria-label={`首字母 ${key}`}>
                  <h2 className="contact-index">{key}</h2>
                  {members.map((person) => <PersonCard key={person.id} person={person} circles={circlesOfPerson(data, person)} />)}
                </section>
              ))}
            </>
          ) : (
            <EmptyState
              broken={data.people.length > 0}
              title={data.people.length === 0 ? '还没有联系人' : peopleView === 'followUp' && !peopleSearch && !selectedCount ? '暂时没有待联系的人' : '没有匹配的联系人'}
              description={data.people.length === 0 ? '也可以用 CSV 表格批量添加。' : undefined}
            >
              {data.people.length === 0 ? (
                <Link to="/settings" className="directory-empty-link">导入联系人 <ArrowUpRight size={15} aria-hidden="true" /></Link>
              ) : (peopleSearch || selectedCount > 0) && (
                <button type="button" className="btn btn-secondary" onClick={() => setUi({ peopleSearch: '', peopleFilter: emptyFilter })}>
                  清除搜索与筛选
                </button>
              )}
            </EmptyState>
          )}
        </section>

        <aside className="directory-side" aria-label="联系人概览">
          <button
            type="button"
            className="followup-card"
            aria-label={`查看待联系，${overview.followUp} 位联系人`}
            onClick={() => {
              setUi({ peopleView: 'followUp', peopleSearch: '', peopleFilter: emptyFilter })
              setFiltersOpen(false)
            }}
          >
            <span className="followup-label">待联系</span>
            <span className="followup-value tabular">{overview.followUp}<span>人</span></span>
            <span className="followup-link">查看待联系 <ArrowUpRight size={14} aria-hidden="true" /></span>
          </button>

          <section className="directory-groups" aria-labelledby="directory-groups-heading">
            <div className="directory-groups-heading">
              <h2 id="directory-groups-heading">分组</h2>
              <Link to="/categories" aria-label="管理分类">管理 <ArrowUpRight size={13} aria-hidden="true" /></Link>
            </div>
            {data.groups.length ? (
              <ul>
                {data.groups.slice(0, 5).map((group) => (
                  <li key={group}>
                    <Link to={`/categories/groups?name=${encodeURIComponent(group)}`}>
                      <Folder size={17} strokeWidth={1.7} aria-hidden="true" />
                      <span>{group}</span>
                      <small className="tabular">{overview.groupCounts.get(group) ?? 0}</small>
                      <ChevronRight size={14} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="hint">还没有分组</p>}
          </section>
        </aside>
      </div>
    </div>
  )
}
