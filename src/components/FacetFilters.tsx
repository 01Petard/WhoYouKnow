/**
 * [INPUT]: 接收筛选选项和已选值，由页面更新查询条件。
 * [OUTPUT]: 导出 FacetFilters 与 Facet 类型
 * [POS]: 每个筛选维度独占一行，直接展示可多选的按钮，同一维度多选为 OR，维度之间由页面做 AND
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
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
}

export function FacetFilters({ facets, onChange }: FacetFiltersProps) {
  return (
    <div className="directory-facets" role="group" aria-label="联系人筛选">
      {facets.map(({ key, label, options, selected }) => (
        <div className="facet-row" role="group" aria-label={label} key={key}>
          <span className="facet-label" aria-hidden="true">{label}</span>
          <div className="facet-options">
            <button type="button" className="facet-option" aria-pressed={selected.length === 0}
              onClick={() => onChange(key, [])}>不限</button>
            {options.map(({ value, label: optionLabel }) => {
              const active = selected.includes(value)
              return (
                <button type="button" className="facet-option" key={value} aria-pressed={active}
                  onClick={() => onChange(key, active
                    ? selected.filter((item) => item !== value)
                    : [...selected, value])}>
                  {optionLabel}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
