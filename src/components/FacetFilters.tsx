/**
 * [INPUT]: 不依赖其它组件；依赖 ../types 无直接依赖
 * [OUTPUT]: 导出 FacetFilters 与 Facet 类型
 * [POS]: 人脉页的多行分面筛选；每行一个维度，左标签右选项，同一维度多选为 OR，维度之间由页面做 AND
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
export interface FacetOption {
  value: string
  label: string
}

export interface Facet {
  key: string
  label: string
  options: FacetOption[]
  selected: string[]
}

interface FacetFiltersProps {
  facets: Facet[]
  onChange: (key: string, values: string[]) => void
  onClear: () => void
}

export function FacetFilters({ facets, onChange, onClear }: FacetFiltersProps) {
  const hasFilter = facets.some((facet) => facet.selected.length > 0)
  return (
    <div className="facet-panel">
      <div className="facet-head">
        <span className="facet-heading">筛选</span>
        {hasFilter && (
          <button type="button" className="link-inline" onClick={onClear}>
            清除全部
          </button>
        )}
      </div>
      {facets.map((facet) => (
        <div className="facet-row" key={facet.key} role="group" aria-label={`按${facet.label}筛选`}>
          <span className="facet-label">{facet.label}</span>
          <div className="facet-options">
            <button
              type="button"
              className={`facet-option${facet.selected.length === 0 ? ' facet-option-active' : ''}`}
              aria-pressed={facet.selected.length === 0}
              onClick={() => onChange(facet.key, [])}
            >
              不限
            </button>
            {facet.options.map((option) => {
              const active = facet.selected.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`facet-option${active ? ' facet-option-active' : ''}`}
                  aria-pressed={active}
                  onClick={() =>
                    onChange(
                      facet.key,
                      active
                        ? facet.selected.filter((value) => value !== option.value)
                        : [...facet.selected, option.value],
                    )
                  }
                >
                  {option.label}
                </button>
              )
            })}
            {facet.options.length === 0 && <span className="hint">暂无可选{facet.label}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
