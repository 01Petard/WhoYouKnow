/**
 * [INPUT]: 读取联系人记录与已有城市，通过状态仓库保存。
 * [OUTPUT]: 导出 ContactCities 和 CityFields。
 * [POS]: 联系人档案可维护常住与曾居住城市，行程可复用城市输入。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { City, Person } from '../types'
import { useStore } from '../store/useStore'
import { cityKey, cityLabel, knownCities, normalizeCity, uniqueCities } from '../util/cities'
import { Modal } from './Modal'
import { useToast } from './Toast'

export function CityFields({ city, cities, onChange }: {
  city: City
  cities: City[]
  onChange: (city: City) => void
}) {
  const id = useId()
  return <>
    {cities.length > 0 && <div className="field">
      <label className="field-label" htmlFor={id + '-known'}>从已有城市选择</label>
      <select className="input" id={id + '-known'}
        value={cities.some((item) => cityKey(item) === cityKey(city)) ? cityKey(city) : ''}
        onChange={(event) => {
          const known = cities.find((item) => cityKey(item) === event.target.value)
          onChange(known ?? { name: '', region: '' })
        }}>
        <option value="">手动输入</option>
        {cities.map((item) => <option key={cityKey(item)} value={cityKey(item)}>{cityLabel(item)}</option>)}
      </select>
    </div>}
    <div className="field">
      <label className="field-label" htmlFor={id + '-name'}>城市</label>
      <input id={id + '-name'} type="text" value={city.name} onChange={(event) => onChange({ ...city, name: event.target.value })} />
    </div>
    <div className="field">
      <label className="field-label" htmlFor={id + '-region'}>地区（可选）</label>
      <input id={id + '-region'} type="text" value={city.region} placeholder="省份、州或国家"
        onChange={(event) => onChange({ ...city, region: event.target.value })} />
    </div>
  </>
}

const blankCity: City = { name: '', region: '' }

function ContactCityEditor({ person, onClose }: { person: Person; onClose: () => void }) {
  const toast = useToast()
  const data = useStore((state) => state.data)
  const setCities = useStore((state) => state.setContactCities)
  const [current, setCurrent] = useState(person.currentCity ?? blankCity)
  const [past, setPast] = useState(person.pastCities ?? [])
  const [pastDraft, setPastDraft] = useState<City>()
  const [issue, setIssue] = useState('')
  const cities = knownCities(data.people, data.trips)

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = pastDraft?.name.trim() ? uniqueCities([...past, pastDraft]) : past
    if (!setCities(person.id, current.name.trim() ? current : undefined, next)) {
      setIssue('城市保存失败，请重新打开联系人档案。')
      return
    }
    toast.showAfterFileSave('已保存城市')
    onClose()
  }

  return <Modal open title="编辑居住城市" onClose={onClose} footer={<>
    <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
    <button type="submit" className="btn btn-primary" form="contact-city-editor">保存城市</button>
  </>}>
    <form id="contact-city-editor" className="city-form" onSubmit={submit}>
      <fieldset>
        <legend>常住城市</legend>
        <CityFields city={current} cities={cities} onChange={setCurrent} />
      </fieldset>
      <fieldset>
        <legend>曾居住城市</legend>
        {past.length > 0 && <div className="tag-chips">
          {past.map((city) => <button type="button" className="tag-chip tag-chip-link" key={cityKey(city)}
            aria-label={`移除 ${cityLabel(city)}`} onClick={() => setPast(past.filter((item) => cityKey(item) !== cityKey(city)))}>
            {cityLabel(city)} ×
          </button>)}
        </div>}
        {pastDraft ? <>
          <CityFields city={pastDraft} cities={cities} onChange={setPastDraft} />
          <div className="row-actions">
            <button type="button" className="btn btn-secondary btn-sm" disabled={!pastDraft.name.trim()} onClick={() => {
              setPast(uniqueCities([...past, normalizeCity(pastDraft)]))
              setPastDraft(undefined)
            }}>添加到列表</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPastDraft(undefined)}>取消添加</button>
          </div>
        </> : <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPastDraft(blankCity)}>添加曾居住城市</button>}
      </fieldset>
      {issue && <p className="field-error" role="alert">{issue}</p>}
    </form>
  </Modal>
}

export function ContactCities({ person }: { person: Person }) {
  const [open, setOpen] = useState(false)
  return <section className="contact-profile-info-section" aria-labelledby="contact-city-heading">
    <header className="city-section-heading">
      <h2 className="section-title" id="contact-city-heading">居住城市</h2>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>编辑城市</button>
    </header>
    <dl className="contact-profile-fields">
      <div><dt>常住城市</dt><dd>{person.currentCity ? <Link to={`/cities?city=${encodeURIComponent(cityKey(person.currentCity))}`}>{cityLabel(person.currentCity)}</Link> : '未填写'}</dd></div>
      {!!person.pastCities?.length && <div><dt>曾居住城市</dt><dd className="tag-chips">
        {person.pastCities.map((city) => <Link key={cityKey(city)} className="tag-chip tag-chip-link"
          to={`/cities?city=${encodeURIComponent(cityKey(city))}`}>{cityLabel(city)}</Link>)}
      </dd></div>}
    </dl>
    {open && <ContactCityEditor key={person.id} person={person} onClose={() => setOpen(false)} />}
  </section>
}
