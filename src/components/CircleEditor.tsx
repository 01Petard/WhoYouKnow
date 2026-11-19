/**
 * [INPUT]: 依赖 ./Modal 的弹窗；依赖 ./Toast 的 useToast；依赖 ../store/useStore 的 data/addCircle/renameCircle/setCircleGroups；依赖 ../types 的 Circle
 * [OUTPUT]: 导出 CircleEditor 组件
 * [POS]: 圈子的唯一编辑弹窗，只采集名称与分组草稿；由 CategoriesPage 与 CircleDetailPage 打开，点保存才写入 store
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import { useEffect, useMemo, useState } from 'react'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { useStore } from '../store/useStore'
import type { Circle } from '../types'

interface CircleEditorProps {
  open: boolean
  /** null = 新建圈子 */
  circle: Circle | null
  onClose: () => void
}

/**
 * 圈子编辑弹窗：圈子只保存「由哪些分组组成」，成员由分组派生。
 * 名称与分组都是草稿，点保存才写入 store。
 */
export function CircleEditor({ open, circle, onClose }: CircleEditorProps) {
  const data = useStore((s) => s.data)
  const addCircle = useStore((s) => s.addCircle)
  const renameCircle = useStore((s) => s.renameCircle)
  const setCircleGroups = useStore((s) => s.setCircleGroups)
  const toast = useToast()
  const [name, setName] = useState('')
  const [groups, setGroups] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setName(circle?.name ?? '')
    setGroups(circle ? [...circle.groups] : [])
  }, [open, circle])

  // 预计成员：选中分组的并集，用于让用户立刻看到归类效果
  const memberCount = useMemo(() => {
    const selected = new Set(groups)
    return data.people.filter((p) => p.groups.some((g) => selected.has(g))).length
  }, [data.people, groups])

  const toggle = (group: string) =>
    setGroups((current) => (current.includes(group) ? current.filter((g) => g !== group) : [...current, group]))

  const save = () => {
    if (!name.trim()) {
      toast.show('请填写圈子名称')
      return
    }
    if (circle) {
      if (!renameCircle(circle.id, name)) {
        toast.show('名称为空或已存在')
        return
      }
      if (!setCircleGroups(circle.id, groups)) {
        toast.show('保存失败，请重试')
        return
      }
      toast.show(`已保存圈子「${name.trim()}」`)
    } else {
      if (!addCircle(name, groups)) {
        toast.show('名称为空或已存在')
        return
      }
      toast.show(`已创建圈子「${name.trim()}」`)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={circle ? '编辑圈子' : '新建圈子'}
      wide
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
          <button type="button" className="btn btn-primary" onClick={save}>保存</button>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor="circle-name">圈子名称</label>
        <input
          id="circle-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如 同学、前同事"
          autoComplete="off"
        />
      </div>

      <div className="field">
        <span className="field-label">包含哪些分组</span>
        <div className="tag-chips">
          {data.groups.map((group) => {
            const active = groups.includes(group)
            return (
              <button
                key={group}
                type="button"
                className={`tag-chip${active ? ' tag-chip-selected' : ''}`}
                aria-pressed={active}
                onClick={() => toggle(group)}
              >
                {group}
              </button>
            )
          })}
          {data.groups.length === 0 && (
            <span className="hint">还没有分组，请先到「整理分类」创建分组。</span>
          )}
        </div>
        <p className="field-hint">
          预计成员 {memberCount} 人 · 成员由所选分组自动汇总，不单独记录
        </p>
      </div>
    </Modal>
  )
}
