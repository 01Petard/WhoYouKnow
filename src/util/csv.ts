/**
 * [INPUT]: 依赖 ../types 的 Person；依赖 ./constants 的 CSV_TEMPLATE_HEADERS
 * [OUTPUT]: 导出 parseCsv、toCsv、downloadText、splitMulti、ParsedCsvRow、CsvParseOutcome、parsePeopleCsv、parsePeopleRows、peopleCsv、templateCsv
 * [POS]: CSV 编解码的唯一实现；只处理人物与分组，不读写圈子；关系边仅进入 JSON 备份
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import type { Person } from '../types'
import { CSV_TEMPLATE_HEADERS } from './constants'

/** 解析 UTF-8 CSV（兼容 BOM），支持引号包裹、转义双引号与字段内换行 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i += 1
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

const escapeCell = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

export function toCsv(rows: string[][]): string {
  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')}`
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const MULTI_VALUE_SEPARATOR = /[|、，,;；]/

/**
 * 拆分多值字段（标签、分组），支持 | 、 ， , ； ; 共六种分隔符，
 * 兼容全角逗号与半角逗号输入。自动去掉首尾空白、全角空格，按出现顺序去重。
 */
export function splitMulti(value: string): string[] {
  return [
    ...new Set(
      value
        .split(MULTI_VALUE_SEPARATOR)
        .map((item) => item.replace(/\u3000/g, ' ').trim())
        .filter(Boolean),
    ),
  ]
}

export interface ParsedCsvRow {
  rowNumber: number
  name: string
  tags: string[]
  groups: string[]
  note: string
  birthday: string
  duplicateWith?: string
}

export interface CsvParseOutcome {
  rows: ParsedCsvRow[]
  errors: { row: number; reason: string }[]
  totalLines: number
}

/**
 * 解析人物 CSV。重复判定严格为 trim(姓名A) === trim(姓名B)，确定性相等，
 * 不做任何模糊/相似度算法（体验规范 §8.2）。
 */
export function parsePeopleCsv(text: string, existing: Person[]): CsvParseOutcome {
  return parsePeopleRows(parseCsv(text), existing)
}

/** 从已解析的二维数组生成导入预览，便于上层分片显示解析进度 */
export function parsePeopleRows(rows: string[][], existing: Person[]): CsvParseOutcome {
  const errors: CsvParseOutcome['errors'] = []
  const parsed: ParsedCsvRow[] = []
  if (rows.length === 0) {
    return { rows: [], errors: [{ row: 0, reason: '文件为空' }], totalLines: 0 }
  }

  const header = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim())
  if (header[0] !== CSV_TEMPLATE_HEADERS[0]) {
    return { rows: [], errors: [{ row: 1, reason: '首列必须是「姓名」，请下载模板后填写' }], totalLines: rows.length - 1 }
  }

  const seen = new Map<string, string>()
  for (const person of existing) seen.set(person.name.trim(), person.id)

  rows.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2
    const name = (cells[0] ?? '').trim()
    if (!name) {
      errors.push({ row: rowNumber, reason: '姓名为空' })
      return
    }
    const duplicateWith = seen.get(name)
    parsed.push({
      rowNumber,
      name,
      tags: splitMulti(cells[1] ?? ''),
      groups: splitMulti(cells[2] ?? ''),
      note: (cells[3] ?? '').trim(),
      birthday: (cells[4] ?? '').trim(),
      duplicateWith,
    })
    seen.set(name, `csv:${rowNumber}`)
  })

  return { rows: parsed, errors, totalLines: rows.length - 1 }
}

export function peopleCsv(data: {
  people: Person[]
}): string {
  const rows: string[][] = [CSV_TEMPLATE_HEADERS.map(String)]
  for (const p of data.people) {
    rows.push([p.name, p.tags.join('|'), p.groups.join('|'), p.note, p.birthday ?? ''])
  }
  return toCsv(rows)
}

export function templateCsv(): string {
  return toCsv([
    CSV_TEMPLATE_HEADERS.map(String),
    ['张三', '同事|朋友', '前公司，羽毛球群', '示例行，可删除', '1995-06-01'],
  ])
}
