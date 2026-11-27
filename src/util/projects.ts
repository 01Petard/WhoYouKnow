/**
 * [INPUT]: 读取项目、成员和待办的数据结构及本地日期。
 * [OUTPUT]: 提供项目校验、成员引用清理与逾期判断。
 * [POS]: 统一备份恢复、写入和界面使用的项目规则。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import type { PeopleProject, PeopleProjectInput } from '../types'
import { isDateOnly, today } from './id'

function isRow(value: unknown): value is { id: string; updatedAt: string } {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<{ id: string; updatedAt: string }>
  return typeof row.id === 'string' && Boolean(row.id.trim()) && typeof row.updatedAt === 'string'
}

export function isProjectInput(input: PeopleProjectInput): boolean {
  if (typeof input.name !== 'string' || !input.name.trim() || typeof input.description !== 'string'
    || typeof input.archived !== 'boolean' || !Array.isArray(input.members) || !Array.isArray(input.tasks)) return false
  if (input.members.some((member) => !isRow(member) || typeof member.role !== 'string' || typeof member.progress !== 'string')) return false
  if (input.tasks.some((task) => !isRow(task) || typeof task.title !== 'string' || !task.title.trim()
    || typeof task.done !== 'boolean' || (task.due !== '' && !isDateOnly(task.due))
    || (task.memberId !== undefined && (typeof task.memberId !== 'string' || !task.memberId.trim())))) return false
  return new Set(input.members.map((member) => member.id)).size === input.members.length
    && new Set(input.tasks.map((task) => task.id)).size === input.tasks.length
}

export function readProjects(raw: unknown): PeopleProject[] | null {
  if (!Array.isArray(raw)) return null
  const ids = new Set<string>()
  for (const item of raw) {
    if (!isRow(item) || ids.has(item.id) || !isProjectInput(item as PeopleProject)) return null
    ids.add(item.id)
  }
  return raw
}

export function filterProjectMembers(project: PeopleProject, peopleIds: ReadonlySet<string>): PeopleProject {
  const members = project.members.filter((member) => peopleIds.has(member.id))
  return members.length === project.members.length ? project : { ...project, members }
}

export function overdueTask(due: string, currentDate = today()): boolean {
  return Boolean(due && due < currentDate)
}
