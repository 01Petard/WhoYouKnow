/**
 * [INPUT]: 依赖 ../types 的 AppData/Circle/Person；依赖 ./constants 的 UNCLASSIFIED
 * [OUTPUT]: 导出 personById、circleMembers、circlesOfPerson、filterPeople
 * [POS]: 纯读查询层；people 只含联系人，系统不保存联系人之间的关系边；只消费 AppData，不产生写操作
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import type { AppData, Circle, Person } from '../types'
import { UNCLASSIFIED } from './constants'

const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, 'zh-CN')

export function personById(data: AppData): Map<string, Person> {
  return new Map(data.people.map((p) => [p.id, p]))
}

/**
 * 圈子的成员：落在圈子任一分组里的人。成员是派生结果，不存进人物数据，
 * 因此新增/移出分组、分组改名都会自动反映到圈子上。
 */
export function circleMembers(data: AppData, circle: Circle): Person[] {
  const groups = new Set(circle.groups)
  return data.people.filter((p) => p.groups.some((g) => groups.has(g))).sort(byName)
}

/** 某人所属的圈子（由其分组推导，只读展示） */
export function circlesOfPerson(data: AppData, person: Person): Circle[] {
  return data.circles.filter((c) => c.groups.some((g) => person.groups.includes(g)))
}

export interface PeopleFilter {
  search: string
  groups: string[]
  circles: string[]
  tags: string[]
}

/**
 * 筛选：维度内 OR、维度间 AND、与搜索词 AND。
 * 关系本身默认成立；本函数只做归类维度过滤。
 */
export function filterPeople(data: AppData, filter: PeopleFilter): Person[] {
  const q = filter.search.trim().toLocaleLowerCase()
  return data.people
    .filter((p) => {
      // 分组：未分类 = 没有任何分组；与已选分组之间是 OR
      if (filter.groups.length) {
        const groupMatch = filter.groups.some((group) =>
          group === UNCLASSIFIED ? p.groups.length === 0 : p.groups.includes(group),
        )
        if (!groupMatch) return false
      }
      // 圈子：未分类 = 不属于任何圈子；与已选圈子之间是 OR
      if (filter.circles.length) {
        const inSelected = data.circles.some(
          (circle) => filter.circles.includes(circle.id) && circle.groups.some((group) => p.groups.includes(group)),
        )
        const unclassified =
          filter.circles.includes(UNCLASSIFIED) &&
          !data.circles.some((circle) => circle.groups.some((group) => p.groups.includes(group)))
        if (!inSelected && !unclassified) return false
      }
      // 标签：未分类 = 没有任何标签；与已选标签之间是 OR
      if (filter.tags.length) {
        const tagMatch = filter.tags.some((tag) =>
          tag === UNCLASSIFIED ? p.tags.length === 0 : p.tags.includes(tag),
        )
        if (!tagMatch) return false
      }
      if (q) {
        const haystack = [p.name, p.note, p.channel, ...p.tags].join(' ').trim().toLocaleLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    .sort((a, b) => (a.important ? 0 : 1) - (b.important ? 0 : 1) || byName(a, b))
}
