/**
 * [INPUT]: 读取往来类别、方向、状态和日期。
 * [OUTPUT]: 提供显示文案与备份校验。
 * [POS]: 待办、取消和已发生共用一个记录编号。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import type { Exchange, ExchangeDirection, ExchangeInput, ExchangeKind, ExchangeStatus } from '../types'
import { isDateOnly } from './id'

export const exchangeKindLabels: Record<ExchangeKind, string> = { help: '帮助', gift: '礼物' }
export const exchangeDirectionLabels: Record<ExchangeDirection, string> = { received: '收到', given: '给出' }
export const exchangeStatusLabels: Record<ExchangeStatus, string> = { todo: '待办', occurred: '已发生', cancelled: '已取消' }

export function validExchange(input: ExchangeInput): boolean {
  return typeof input.personId === 'string' && Boolean(input.personId.trim())
    && typeof input.content === 'string' && Boolean(input.content.trim())
    && Object.prototype.hasOwnProperty.call(exchangeKindLabels, input.kind)
    && Object.prototype.hasOwnProperty.call(exchangeDirectionLabels, input.direction)
    && Boolean(input.phase) && Object.prototype.hasOwnProperty.call(exchangeStatusLabels, input.phase.status)
    && (input.plannedDate === '' || isDateOnly(input.plannedDate))
    && (input.phase.status !== 'occurred' || isDateOnly(input.phase.date))
}

export function readExchanges(value: unknown): Exchange[] | null {
  if (!Array.isArray(value)) return null
  const ids = new Set<string>()
  for (const item of value) {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)
      || typeof item.updatedAt !== 'string' || typeof item.personName !== 'string' || !item.personName.trim()
      || !validExchange(item)) return null
    ids.add(item.id)
  }
  return value
}
