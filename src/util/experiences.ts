/**
 * [INPUT]: 读取共同经历的发生日期和更新时间。
 * [OUTPUT]: 导出 newestExperiences。
 * [POS]: 为经历时间线和联系人档案提供相同的倒序。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import type { Experience } from '../types'

export function newestExperiences(items: Experience[]): Experience[] {
  return [...items].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
}
