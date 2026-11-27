/**
 * [INPUT]: 依赖联系人查询、拼音索引、筛选状态与目录组件。
 * [OUTPUT]: 导出 PeoplePage。
 * [POS]: 人脉首页提供姓名搜索、首字母筛选、分类筛选及联系手记入口。目录展示分组、圈子和标签，并单独列出事务联系人。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BookOpen, ChevronRight, Folder, Plus, Search, X } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { FacetFilters } from '../components/FacetFilters'
import { PersonCard } from '../components/PersonCard'
import { useStore } from '../store/useStore'
import type { FilterState } from '../types'
import { UNCLASSIFIED } from '../util/constants'
import { CONTACT_GROUPS, groupContacts } from '../util/contactIndex'
import { circlesOfPerson, filterPeople } from '../util/queries'

const peopleViews = [
  { key: 'all', label: '全部' },
  { key: 'social', label: '社交联系人' },
  { key: 'practical', label: '事务联系人' },
] as const

const initialOptions = CONTACT_GROUPS.map((value) => ({ value, label: value }))

const emptyFilter: FilterState = { groups: [], circles: [], tags: [] }

export function PeoplePage() {
  const data = useStore((state) => state.data)
  const { peopleSearch, peopleView, peopleFilter } = useStore((state) => state.ui)
  const setUi = useStore((state) => state.setUi)
  const [initials, setInitials] = useState<string[]>([])
  const people = useMemo(
    () => filterPeople(data, { search: peopleSearch, searchByName: true, view: peopleView, ...peopleFilter }),
    [data, peopleSearch, peopleView, peopleFilter],
  )
  const groups = useMemo(() => groupContacts(people), [people])
  const visibleGroups = initials.length ? groups.filter(({ key }) => initials.includes(key)) : groups
  const overview = useMemo(() => {
    const groupCounts = new Map<string, number>()
    let practical = 0
    for (const person of data.people) {
      if (person.practical) practical += 1
      for (const group of new Set(person.groups)) {
        groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1)
      }
    }
    return {
      all: data.people.length,
      social: data.people.length - practical,
      practical,
      groupCounts,
    }
  }, [data])

  const facets = [
    { key: 'groups', label: '分组', options: data.groups.map((name) => ({ value: name, label: name })) },
    { key: 'circles', label: '圈子', options: data.circles.map(({ id, name }) => ({ value: id, label: name })) },
    { key: 'tags', label: '标签', options: data.tags.map((name) => ({ value: name, label: name })) },
  ] as const
  const selectedCount = initials.length + peopleFilter.groups.length + peopleFilter.circles.length + peopleFilter.tags.length
  const clearFacets = () => {
    setInitials([])
    setUi({ peopleFilter: emptyFilter })
  }

  function setFacet(key: string, values: string[]) {
    if (key === 'initials') {
      setInitials(values)
      return
    }
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
                  type="text"
                  value={peopleSearch}
                  onChange={(event) => setUi({ peopleSearch: event.target.value })}
                  placeholder="搜索姓名"
                  aria-label="搜索姓名"
                />
                {peopleSearch && (
                  <button type="button" className="btn-icon" aria-label="清除搜索词" onClick={() => setUi({ peopleSearch: '' })}>
                    <X size={17} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <FacetFilters
              facets={[
                { key: 'initials', label: '首字母', selected: initials, options: initialOptions },
                ...facets.map(({ key, label, options }) => ({
                  key,
                  label,
                  selected: peopleFilter[key],
                  options: [{ value: UNCLASSIFIED, label: '未分类' }, ...options],
                })),
              ]}
              onChange={setFacet}
            />
            {selectedCount > 0 && (
              <div className="directory-facet-actions">
                <button type="button" className="link-inline" onClick={clearFacets}>清除筛选</button>
              </div>
            )}

          </div>

          {visibleGroups.length > 0 ? (
            <>
              <div className="directory-columns" aria-hidden="true">
                <span>姓名</span><span>分组</span><span>圈子</span><span>标签</span><span />
              </div>
              {visibleGroups.map(({ key, people: members }) => (
                <section className="contact-group" key={key} aria-label={`首字母 ${key}`}>
                  <h2 className="contact-index">{key}</h2>
                  {members.map((person) => <PersonCard key={person.id} person={person} circles={circlesOfPerson(data, person)} />)}
                </section>
              ))}
            </>
          ) : (
            <EmptyState
              broken={data.people.length > 0}
              title={data.people.length === 0 ? '还没有联系人'
                : peopleView === 'practical' && overview.practical === 0 ? '还没有事务联系人'
                : peopleView === 'social' && overview.social === 0 ? '还没有社交联系人'
                : '没有匹配的联系人'}
              description={data.people.length === 0 ? '也可以用 CSV 表格批量添加。'
                : peopleView === 'practical' && overview.practical === 0 ? '可在联系人档案中将其移入这里。'
                : undefined}
            >
              {data.people.length === 0 ? (
                <Link to="/settings" className="directory-empty-link">导入联系人 <ArrowUpRight size={15} aria-hidden="true" /></Link>
              ) : (peopleSearch || selectedCount > 0) && (
                <button type="button" className="btn btn-secondary" onClick={() => { setInitials([]); setUi({ peopleSearch: '', peopleFilter: emptyFilter }) }}>
                  清除搜索与筛选
                </button>
              )}
            </EmptyState>
          )}
        </section>

        <aside className="directory-side" aria-label="联系人概览">
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
