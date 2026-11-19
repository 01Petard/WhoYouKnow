/**
 * [INPUT]: 依赖浏览器内置的 Intl.Collator；依赖 ../types 的 Person
 * [OUTPUT]: 导出 CONTACT_GROUPS、contactInitial、compareContacts、groupContacts
 * [POS]: 联系人页的姓名首字母归类与排序；中文按拼音首字母进入 A-Z，数字/字母/特殊字符统一进入末尾 # 组
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import type { Person } from '../types'

/** 分组顺序：A-Z 在前，非中文（数字、字母、特殊字符）归入末尾 # */
export const CONTACT_GROUPS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'] as const

const collator = new Intl.Collator('zh-CN')

/**
 * 每个拼音声母的排序边界字：取该声母下拼音最小的常用字。
 * Intl.Collator('zh-CN') 按拼音排序，边界字之间即可夹出首字母。
 * 拼音没有 I / U / V 声母，故跳过。
 */
const INITIAL_ANCHORS: readonly (readonly [string, string])[] = [
  ['A', '阿'], ['B', '八'], ['C', '擦'], ['D', '搭'], ['E', '蛾'], ['F', '发'],
  ['G', '噶'], ['H', '哈'], ['J', '击'], ['K', '喀'], ['L', '拉'], ['M', '妈'],
  ['N', '拿'], ['O', '哦'], ['P', '啪'], ['Q', '期'], ['R', '然'], ['S', '撒'],
  ['T', '塌'], ['W', '挖'], ['X', '昔'], ['Y', '压'], ['Z', '匝'],
]

/**
 * 常见多音姓氏覆盖：排序器按通用读音，这里改回姓氏读音。
 * 只覆盖首字，不足以处理全部生僻姓氏；未覆盖的字按排序器读音归类。
 */
const SURNAME_INITIALS: Readonly<Record<string, string>> = {
  曾: 'Z', 单: 'S', 解: 'X', 仇: 'Q', 查: 'Z', 朴: 'P', 区: 'O', 乐: 'Y',
  覃: 'Q', 句: 'G', 秘: 'B', 折: 'S', 繁: 'P', 祭: 'Z', 会: 'K',
}

const HAN = /[㐀-鿿]/

function firstChar(name: string): string {
  return [...name.trim()][0] ?? ''
}

/** 姓名首字所属的索引键：A-Z 或 # */
export function contactInitial(name: string): string {
  const first = firstChar(name)
  if (!first) return '#'
  const surnameInitial = SURNAME_INITIALS[first]
  if (surnameInitial) return surnameInitial
  if (!HAN.test(first)) return '#'

  let initial = 'A'
  for (const [letter, anchor] of INITIAL_ANCHORS) {
    if (collator.compare(first, anchor) >= 0) initial = letter
    else break
  }
  return initial
}

/** # 组内部顺序：数字 < 字母 < 特殊字符 */
function nonHanRank(name: string): number {
  const first = firstChar(name)
  if (/[0-9]/.test(first)) return 0
  if (/[a-z]/i.test(first)) return 1
  return 2
}

/** 联系人排序：先按索引键，再按名称拼音；# 组内先按字符类别 */
export function compareContacts(a: Person, b: Person): number {
  const initialA = contactInitial(a.name)
  const initialB = contactInitial(b.name)
  if (initialA !== initialB) {
    return CONTACT_GROUPS.indexOf(initialA) - CONTACT_GROUPS.indexOf(initialB)
  }
  if (initialA === '#') {
    const rankDiff = nonHanRank(a.name) - nonHanRank(b.name)
    if (rankDiff !== 0) return rankDiff
  }
  return collator.compare(a.name, b.name)
}

/** 按首字母分组，空索引不出现；组内用 compareContacts 排序 */
export function groupContacts(people: Person[]): { key: string; people: Person[] }[] {
  const buckets = new Map<string, Person[]>()
  for (const person of people) {
    const key = contactInitial(person.name)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(person)
    else buckets.set(key, [person])
  }
  return CONTACT_GROUPS.filter((key) => buckets.has(key)).map((key) => ({
    key,
    people: buckets.get(key)!.slice().sort(compareContacts),
  }))
}
