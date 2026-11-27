/**
 * [INPUT]: 读取城市目录、联系人和行程数据。通过工作台状态仓库保存约见。
 * [OUTPUT]: 导出 CitiesPage。
 * [POS]: 分列常住与曾居住联系人，并维护单次出行的约见清单。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react'
import { CityFields } from '../components/ContactCities'
import { DateField } from '../components/DateField'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { useStore } from '../store/useStore'
import type { City, CityTrip, CityTripInput, CityVisit, Person, VisitStatus } from '../types'
import { cityKey, cityLabel, cityPeople, knownCities, visitStatusLabels } from '../util/cities'
import { isDateOnly, today } from '../util/id'

function CityEditor({ title, onClose, onSubmit, children }: {
  title: string
  onClose: () => void
  onSubmit: () => string | void
  children: ReactNode
}) {
  const [issue, setIssue] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    setIssue(onSubmit() ?? '')
  }
  return <Modal open title={title} onClose={onClose} footer={<>
    <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
    <button type="submit" form="city-editor" className="btn btn-primary">保存</button>
  </>}>
    <form className="city-form" id="city-editor" onSubmit={submit}>
      {children}
      {issue && <p className="field-error" role="alert">{issue}</p>}
    </form>
  </Modal>
}

function TripEditor({ cities, selected, onClose, onSave }: {
  cities: City[]
  selected?: City
  onClose: () => void
  onSave: (input: CityTripInput) => boolean
}) {
  const [city, setCity] = useState(selected ?? { name: '', region: '' })
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)
  return <CityEditor title="新建行程" onClose={onClose} onSubmit={() => {
    if (!city.name.trim()) return '请填写城市。'
    if (!isDateOnly(start) || !isDateOnly(end)) return '请输入有效的起止日期。'
    if (start > end) return '结束日期须在开始日期当天或之后。'
    if (!onSave({ city, start, end, visits: [] })) return '行程保存失败，请重试。'
  }}>
    <CityFields city={city} cities={cities} onChange={setCity} />
    <div className="field"><label className="field-label" htmlFor="trip-start">开始日期</label>
      <DateField id="trip-start" value={start} onChange={setStart} /></div>
    <div className="field"><label className="field-label" htmlFor="trip-end">结束日期</label>
      <DateField id="trip-end" value={end} onChange={setEnd} /></div>
  </CityEditor>
}

function VisitEditor({ visit, available, onClose, onSave }: {
  visit?: CityVisit
  available: Person[]
  onClose: () => void
  onSave: (input: CityVisit) => boolean
}) {
  const [id, setId] = useState(visit?.id ?? '')
  const [status, setStatus] = useState<VisitStatus>(visit?.status ?? 'interested')
  const [date, setDate] = useState(visit?.date ?? '')
  const [note, setNote] = useState(visit?.note ?? '')
  return <CityEditor title={visit ? '编辑约见' : '加入候选'} onClose={onClose} onSubmit={() => {
    if (!id) return '请选择联系人。'
    if (date && !isDateOnly(date)) return '请输入有效的约见日期。'
    if (!onSave({ id, status, date, note: note.trim(), updatedAt: new Date().toISOString() })) return '约见保存失败，请重试。'
  }}>
    {!visit && <div className="field"><label className="field-label" htmlFor="visit-person">城市联系人</label>
      <select id="visit-person" className="input" value={id} onChange={(event) => setId(event.target.value)}>
        <option value="">选择联系人</option>
        {available.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select>
      {!available.length && <p className="hint">此城市暂无可加入的联系人。</p>}
    </div>}
    <div className="field"><label className="field-label" htmlFor="visit-status">约见状态</label>
      <select id="visit-status" className="input" value={status} onChange={(event) => setStatus(event.target.value as VisitStatus)}>
        {Object.entries(visitStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </div>
    <div className="field"><label className="field-label" htmlFor="visit-date">约见日期（可选）</label>
      <DateField id="visit-date" value={date} onChange={setDate} /></div>
    <div className="field"><label className="field-label" htmlFor="visit-note">约见备注（可选）</label>
      <textarea id="visit-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></div>
  </CityEditor>
}

function CityDirectory({ cities, selected, people }: { cities: City[]; selected?: City; people: Person[] }) {
  const [, setParams] = useSearchParams()
  const directory = selected ? cityPeople(people, selected) : undefined
  return <section className="card project-section" aria-labelledby="city-directory">
    <div className="field">
      <label className="section-title" id="city-directory" htmlFor="city-filter">城市目录</label>
      <select id="city-filter" className="input" value={selected ? cityKey(selected) : ''} onChange={(event) => setParams({ city: event.target.value })}>
        {!cities.length && <option value="">暂无城市</option>}
        {cities.map((item) => <option key={cityKey(item)} value={cityKey(item)}>{cityLabel(item)}</option>)}
      </select>
    </div>
    {directory ? ([['常住联系人', directory.current], ['曾居住联系人', directory.past]] as const).map(([title, matches]) =>
      <div key={title}>
        <h3>{title} <span className="hint">{matches.length}</span></h3>
        {matches.length ? <ul>{matches.map((person) => <li key={person.id}>
          <Link className="project-contact" to={`/person/${encodeURIComponent(person.id)}`}>{person.name}</Link>
        </li>)}</ul> : <p className="hint">此分类暂无联系人</p>}
      </div>) : <p className="hint">在联系人档案中添加居住城市后，即可在这里查找。</p>}
  </section>
}

function TripList({ trips }: { trips: CityTrip[] }) {
  return <section aria-labelledby="city-trips">
    <h2 id="city-trips" className="section-title">行程</h2>
    {trips.length ? <ul className="card experience-timeline project-list">{trips.map((trip) => <li key={trip.id}>
      <Link to={`/cities/trips/${encodeURIComponent(trip.id)}`}>
        <div>
          <strong>{cityLabel(trip.city)}</strong>
          <p>{trip.start}{trip.start !== trip.end && ` 至 ${trip.end}`} · {trip.visits.length} 位候选</p>
        </div>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </li>)}</ul> : <EmptyState title="还没有行程" />}
  </section>
}

export function CitiesPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const data = useStore((state) => state.data)
  const save = useStore((state) => state.saveTrip)
  const [creating, setCreating] = useState(false)
  const [visit, setVisit] = useState<CityVisit | 'new'>()
  const trips = [...(data.trips ?? [])].sort((a, b) => b.start.localeCompare(a.start) || b.updatedAt.localeCompare(a.updatedAt))
  const trip = trips.find((item) => item.id === id)
  const cities = knownCities(data.people, trips)
  const selected = cities.find((city) => cityKey(city) === params.get('city')) ?? cities[0]
  const people = new Map(data.people.map((person) => [person.id, person]))
  const directory = trip ? cityPeople(data.people, trip.city) : undefined
  const available = directory && trip
    ? [...directory.current, ...directory.past].filter((person) => !trip.visits.some((item) => item.id === person.id))
    : []

  if (id && !trip) return <div className="content">
    <EmptyState title="没有找到这次行程" actionLabel="返回到一座城" onAction={() => navigate('/cities')} />
  </div>
  return <div className="content experiences-page">
    {trip && <Link className="back-link" to={`/cities?city=${encodeURIComponent(cityKey(trip.city))}`}><ArrowLeft size={16} aria-hidden="true" /> 到一座城</Link>}
    <header className="page-header">
      <div>
        <h1 className="page-title">{trip ? cityLabel(trip.city) : '到一座城'}</h1>
        {trip && <p className="hint">{trip.start}{trip.start !== trip.end && ` 至 ${trip.end}`}</p>}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => trip ? setVisit('new') : setCreating(true)}>
        <Plus size={16} aria-hidden="true" />{trip ? '加入候选' : '新建行程'}
      </button>
    </header>
    {trip ? <section className="card project-section" aria-labelledby="visit-list">
      <h2 id="visit-list" className="section-title">约见清单</h2>
      {trip.visits.length ? <ul>{trip.visits.map((item) => <li key={item.id}>
        <div>
          <Link className="project-contact" to={`/person/${encodeURIComponent(item.id)}`}>{people.get(item.id)?.name}</Link>
          <div className="experience-meta">
            <span>{visitStatusLabels[item.status]}</span>
            {item.date && <time dateTime={item.date}>{item.date}</time>}
          </div>
          {item.note && <p className="project-description">{item.note}</p>}
          {item.status === 'met' && <Link className="project-contact" to={`/person/${encodeURIComponent(item.id)}#contact-history`}>打开档案手记</Link>}
        </div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setVisit(item)}>编辑约见</button>
      </li>)}</ul> : <p className="hint">从城市目录加入第一位候选。</p>}
    </section> : <div className="city-workspace">
      <CityDirectory cities={cities} selected={selected} people={data.people} />
      <TripList trips={trips} />
    </div>}
    {creating && <TripEditor cities={cities} selected={selected} onClose={() => setCreating(false)} onSave={(input) => {
      const saved = save(input)
      if (!saved) return false
      setCreating(false)
      toast.showAfterFileSave('已保存行程')
      navigate(`/cities/trips/${encodeURIComponent(saved)}`)
      return true
    }} />}
    {visit && trip && <VisitEditor visit={visit === 'new' ? undefined : visit} available={available} onClose={() => setVisit(undefined)}
      onSave={(input) => {
        const visits = visit === 'new' ? [...trip.visits, input] : trip.visits.map((item) => item.id === input.id ? input : item)
        if (!save({ ...trip, visits }, trip.id)) return false
        setVisit(undefined)
        toast.showAfterFileSave('已保存约见')
        return true
      }} />}
  </div>
}
