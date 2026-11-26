/**
 * [INPUT]: 依赖 react 的 useMemo；依赖 react-router-dom 的 useNavigate；依赖 lucide-react 的 Search/X；依赖 ../components 的 EmptyState/FacetFilters/PersonCard；依赖 ../store/useStore 的 data/ui/setUi；依赖 ../util/constants 的 COPY；依赖 ../util/contactIndex 的 groupContacts；依赖 ../util/queries 的 filterPeople
 * [OUTPUT]: 导出 PeoplePage 组件
 * [POS]: 全量人脉页；按拼音首字母分组、网格布局，提供重要与待联系视图及多选筛选；路由 /people
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { FacetFilters } from '../components/FacetFilters'
import { PersonCard } from '../components/PersonCard'
import { useStore } from '../store/useStore'
import { COPY, FOLLOW_UP_DAYS, UNCLASSIFIED } from '../util/constants'
import { groupContacts } from '../util/contactIndex'
import { filterPeople } from '../util/queries'

const peopleViews = [
  { key: 'all', label: '全部' },
  { key: 'important', label: '重要' },
  { key: 'followUp', label: '待联系' },
] as const

export function PeoplePage() {
  const data = useStore((s) => s.data)
  const ui = useStore((s) => s.ui)
  const setUi = useStore((s) => s.setUi)
  const navigate = useNavigate()

  const filter = ui.peopleFilter

  const people = useMemo(
    () => filterPeople(data, { search: ui.peopleSearch, view: ui.peopleView, ...filter }),
    [data, ui.peopleSearch, ui.peopleView, filter],
  )
  const groups = useMemo(() => groupContacts(people), [people])

  const setFacet = (key: string, values: string[]) => {
    if (key !== 'groups' && key !== 'circles' && key !== 'tags') return
    setUi({ peopleFilter: { ...filter, [key]: values } })
  }

  const clearFilter = () => setUi({ peopleView: 'all', peopleFilter: { groups: [], circles: [], tags: [] } })

  return (
    <div className="content">
      <div className="page-header">
        <h1 className="page-title">人脉</h1>
        <span className="page-count tabular">{data.people.length} 位联系人</span>
      </div>

      <div className="search-field" style={{ marginBottom: 'var(--sp-3)' }}>
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={ui.peopleSearch}
          onChange={(e) => setUi({ peopleSearch: e.target.value })}
          placeholder="搜索姓名 / 备注 / 标签"
          aria-label="搜索姓名、备注或标签"
        />
        {ui.peopleSearch && (
          <button
            type="button"
            className="btn-icon"
            style={{ width: 32, height: 32, minHeight: 32 }}
            aria-label="清除搜索词"
            onClick={() => setUi({ peopleSearch: '' })}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="segmented" role="group" aria-label="联系人视图" style={{ marginBottom: 'var(--sp-3)' }}>
        {peopleViews.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`segmented-item${ui.peopleView === key ? ' segmented-item-active' : ''}`}
            aria-pressed={ui.peopleView === key}
            onClick={() => setUi({ peopleView: key })}
          >
            {label}
          </button>
        ))}
      </div>
      {ui.peopleView === 'followUp' && (
        <p className="hint" style={{ marginBottom: 'var(--sp-3)' }}>
          无联系记录或已满 {FOLLOW_UP_DAYS} 天未联系的重要联系人。
        </p>
      )}

      <FacetFilters
        facets={[
          {
            key: 'groups',
            label: '分组',
            selected: filter.groups,
            options: [
              { value: UNCLASSIFIED, label: '未分类' },
              ...data.groups.map((value) => ({ value, label: value })),
            ],
          },
          {
            key: 'circles',
            label: '圈子',
            selected: filter.circles,
            options: [
              { value: UNCLASSIFIED, label: '未分类' },
              ...data.circles.map((value) => ({ value: value.id, label: value.name })),
            ],
          },
          {
            key: 'tags',
            label: '标签',
            selected: filter.tags,
            options: [
              { value: UNCLASSIFIED, label: '未分类' },
              ...data.tags.map((value) => ({ value, label: value })),
            ],
          },
        ]}
        onChange={setFacet}
        onClear={clearFilter}
      />

      {groups.length === 0 ? (
        data.people.length === 0 ? (
          <EmptyState
            title={COPY.emptyNoPeople}
            actionLabel={COPY.actionAdd}
            onAction={() => navigate('/person/new')}
          />
        ) : ui.peopleSearch ? (
          <EmptyState title={COPY.emptySearch} />
        ) : (
          <EmptyState
            title={ui.peopleView === 'followUp' ? '当前筛选下没有待联系的人' : COPY.emptyFilter}
            actionLabel={COPY.actionClearFilter}
            onAction={clearFilter}
          />
        )
      ) : (
        groups.map((entry) => (
          <section className="contact-group" key={entry.key} aria-label={`首字母 ${entry.key}`}>
            <h2 className="contact-index">
              {entry.key}
              <span className="tabular">{entry.people.length}</span>
            </h2>
            <div className="person-grid">
              {entry.people.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  onClick={() => navigate(`/person/${person.id}`)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <button
        type="button"
        className="fab"
        aria-label={COPY.actionAdd}
        onClick={() => navigate('/person/new')}
      >
        <span aria-hidden="true" style={{ fontSize: 30, lineHeight: 1, fontWeight: 300 }}>+</span>
      </button>
    </div>
  )
}
