/**
 * [INPUT]: 读取引荐角色、状态和联系人档案。
 * [OUTPUT]: 提供引荐角色规则、显示文案与备份校验。
 * [POS]: 确保路径来自明确的三方记录，并保留已移除档案的名称。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import type { Introduction, IntroductionInput, IntroductionParty, IntroductionRole, IntroductionStatus, Person } from '../types'
import { isDateOnly } from './id'

export const introductionRoles = ['requester', 'introducer', 'target'] as const

export const introductionRoleLabels: Record<IntroductionRole, string> = {
  requester: '请求人',
  introducer: '引荐人',
  target: '对象',
}

export const introductionStatusLabels: Record<IntroductionStatus, string> = {
  pending: '待联系',
  requested: '已提出',
  completed: '已完成',
  closed: '已结束',
}

function isParty(value: unknown): value is IntroductionParty {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<{ kind: string; personId: string; name: string }>
  return item.kind === 'self'
    || (typeof item.name === 'string' && Boolean(item.name.trim())
      && (item.kind === 'unlisted' || (item.kind === 'contact' && typeof item.personId === 'string' && Boolean(item.personId.trim()))))
}

export function introductionIssue(input: IntroductionInput): string | undefined {
  if (!input.parties || introductionRoles.some((role) => !isParty(input.parties[role]))) return '请填写三个角色。'
  if (!isDateOnly(input.date)) return '请输入有效日期。'
  if (typeof input.reason !== 'string' || !input.reason.trim()) return '请填写引荐缘由。'
  if (!Object.prototype.hasOwnProperty.call(introductionStatusLabels, input.status)) return '请选择有效状态。'
  const { parties } = input
  if (parties.requester.kind === 'unlisted' || parties.introducer.kind === 'unlisted') return '只有引荐对象可以暂存姓名。'
  const selected = introductionRoles.map((role) => parties[role])
  if (!selected.some((party) => party.kind === 'self')) return '至少一个角色需要选择「我」。'
  const keys = selected.map((party) => party.kind === 'contact' ? `contact:${party.personId}` : party.kind)
  if (new Set(keys).size !== keys.length) return '同一个人只能担任一个角色。'
  return undefined
}

export function readIntroductions(raw: unknown): Introduction[] | null {
  if (!Array.isArray(raw)) return null
  const ids = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id.trim()
      || ids.has(item.id) || typeof item.updatedAt !== 'string' || introductionIssue(item)) return null
    ids.add(item.id)
  }
  return raw
}

export function introductionPartyName(party: IntroductionParty, people: Map<string, Person>): string {
  if (party.kind === 'self') return '我'
  return party.kind === 'contact' ? people.get(party.personId)?.name ?? party.name : party.name
}
