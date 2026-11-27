/**
 * [INPUT]: 读取联系人手记。复用 DateField 和 Dropdown 选择日期与联系方式。调用全局状态写入新手记、编辑或删除。
 * [OUTPUT]: 导出联系人档案的手记列表与录入对话框。
 * [POS]: 支持同日多条记录，使用各自的记录编号。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useMemo, useState } from 'react'
import { BookOpen, Plus } from 'lucide-react'
import type { ContactEntry, ContactEntryInput, ContactMethod, Person } from '../types'
import { useStore } from '../store/useStore'
import { compareContactEntries, CONTACT_METHODS } from '../util/contactJournal'
import { isDateOnly, today } from '../util/id'
import { ConfirmDialog, Modal } from './Modal'
import { DateField } from './DateField'
import { Dropdown } from './QuickSelect'
import { useToast } from './Toast'

export function ContactHistory({ person }: { person: Person }) {
  const save = useStore((state) => state.saveContactEntry)
  const remove = useStore((state) => state.deleteContactEntry)
  const toast = useToast()
  const [draft, setDraft] = useState<ContactEntryInput | null>(null)
  const [editingId, setEditingId] = useState<string>()
  const [pendingDelete, setPendingDelete] = useState<ContactEntry | null>(null)
  const [dateError, setDateError] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const entries = useMemo(() => [...(person.contactHistory ?? [])].sort(compareContactEntries), [person.contactHistory])
  const currentDate = today()

  function open(entry?: ContactEntry) {
    setDraft(entry ? { date: entry.date, method: entry.method, note: entry.note } : { date: currentDate, method: 'inPerson', note: '' })
    setEditingId(entry?.id)
    setDateError(false)
    setSaveError(false)
  }

  return (
    <section className="card person-panel contact-history" aria-labelledby="contact-history-title">
      <div className="contact-history-heading">
        <h2 id="contact-history-title" className="section-title"><BookOpen size={19} aria-hidden="true" /> 联系手记</h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => open()}>
          <Plus size={16} aria-hidden="true" /> 写一条手记
        </button>
      </div>
      {entries.length ? (
        <ol className="journal-entries">
          {entries.map((entry) => (
            <li className="journal-entry" key={entry.id}>
              <div className="journal-entry-meta">
                <time className="tabular" dateTime={entry.date}>{entry.date}</time>
                <span className="tag-chip">{CONTACT_METHODS[entry.method]}</span>
              </div>
              {entry.note && <p>{entry.note}</p>}
              <div className="journal-entry-actions">
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`编辑 ${entry.date} 的${CONTACT_METHODS[entry.method]}手记`} onClick={() => open(entry)}>编辑</button>
                <button type="button" className="btn btn-ghost btn-sm text-danger" aria-label={`删除 ${entry.date} 的${CONTACT_METHODS[entry.method]}手记`} onClick={() => setPendingDelete(entry)}>删除</button>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="hint">还没有手记。可以从最近一次见面、通话或聊天记起。</p>}

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={editingId ? '编辑联系手记' : '写一条手记'}
        footer={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>取消</button>
            <button type="submit" form="contact-history-form" className="btn btn-primary">保存手记</button>
          </>
        )}
      >
        {draft && (
          <form id="contact-history-form" noValidate onSubmit={(event) => {
            event.preventDefault()
            if (!isDateOnly(draft.date) || draft.date > currentDate) {
              setDateError(true)
              return
            }
            if (!save(person.id, draft, editingId)) {
              setSaveError(true)
              return
            }
            toast.showAfterFileSave('手记已保存')
            setDraft(null)
          }}>
            <div className="field">
              <label className="field-label" htmlFor="journal-entry-date">手记日期</label>
              <DateField id="journal-entry-date" value={draft.date} max={currentDate} invalid={dateError}
                describedBy={dateError ? 'journal-entry-date-error' : undefined}
                onChange={(date) => { setDraft({ ...draft, date }); setDateError(false) }} />
              {dateError && <p className="field-error" id="journal-entry-date-error" role="alert">请选择今天或更早的有效日期。</p>}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="journal-entry-method">联系方式</label>
              <Dropdown
                id="journal-entry-method"
                label="联系方式"
                display={CONTACT_METHODS[draft.method]}
                options={(Object.keys(CONTACT_METHODS) as ContactMethod[]).map((value) => ({
                  value, label: CONTACT_METHODS[value], checked: draft.method === value,
                }))}
                onSelect={(method) => setDraft({ ...draft, method })}
                field
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="journal-entry-note">手记内容（选填）</label>
              <textarea id="journal-entry-note" rows={4} value={draft.note}
                onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="聊了什么？有没有想在下次提起的事？" />
            </div>
            {saveError && <p className="field-error" role="alert">当前手记无法保存，请稍后重试。</p>}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="删除这条手记？"
        message={pendingDelete ? `将删除 ${pendingDelete.date} 的${CONTACT_METHODS[pendingDelete.method]}手记。这条记录将从联系历史中移除。` : ''}
        confirmLabel="删除"
        destructive
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          if (remove(person.id, pendingDelete.id)) toast.showAfterFileSave('手记已删除')
          else toast.show('当前手记无法删除，请稍后重试')
        }}
      />
    </section>
  )
}
