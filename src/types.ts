/**
 * [INPUT]: 不导入任何模块；定义 store、util、components、pages 共用的领域模型
 * [OUTPUT]: 导出联系人、联系手记、共同经历、引荐、分类、备份和筛选模型。
 * [POS]: people 保存联系人，me 保存当前用户。共同经历和引荐按联系人编号关联参与人。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
export type Gender = '男' | '女' | '其他'

export type ContactMethod = 'inPerson' | 'call' | 'message' | 'other'

export interface ContactEntry {
  id: string
  date: string
  method: ContactMethod
  note: string
  updatedAt: string
}

export type ContactEntryInput = Pick<ContactEntry, 'date' | 'method' | 'note'>

export interface Experience {
  id: string
  title: string
  date: string
  place: string
  note: string
  participantIds: string[]
  updatedAt: string
}

export type ExperienceInput = Omit<Experience, 'id' | 'updatedAt'>

export type IntroductionParty =
  | { kind: 'self' }
  | { kind: 'contact'; personId: string; name: string }
  | { kind: 'unlisted'; name: string }

export type IntroductionRole = 'requester' | 'introducer' | 'target'
export type IntroductionStatus = 'pending' | 'requested' | 'completed' | 'closed'

export interface Introduction {
  id: string
  parties: Record<IntroductionRole, IntroductionParty>
  status: IntroductionStatus
  reason: string
  date: string
  updatedAt: string
}

export type IntroductionInput = Omit<Introduction, 'id' | 'updatedAt'>

export interface Person {
  id: string
  name: string
  avatar?: string
  gender?: Gender
  birthday?: string
  channel: string
  metAt: string
  /** 手动标记的日期。展示时与手记日期比较。 */
  lastContactAt?: string
  contactHistory?: ContactEntry[]
  note: string
  tags: string[]
  groups: string[]
  /** 个人标记：是否重要；与关系状态无关 */
  important?: boolean
  /** 在人脉页归入事务目录；关系网默认排除此联系人。 */
  practical?: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 圈子：比「分组」高一级的归类视图。
 * 圈子只保存「由哪些分组组成」，成员全部由分组派生（person.groups ∩ circle.groups），
 * 不存储人物成员关系，因此不改动人物原始数据，也不参与导入导出。
 */
export interface Circle {
  id: string
  name: string
  /** 包含的分组名，引用 AppData.groups 中的值 */
  groups: string[]
  createdAt: string
  updatedAt: string
}

export interface AppData {
  version: number
  /** 全部联系人；不包含当前用户 */
  people: Person[]
  tags: string[]
  groups: string[]
  circles: Circle[]
  experiences?: Experience[]
  introductions?: Introduction[]
  /** 当前用户自己的资料，单独于 people 管理；null = 尚未创建「我的信息」 */
  me: Person | null
}

export interface BackupFile extends AppData {
  exportedAt?: string
}

/** 落盘内容：完整业务数据 + 写入时间 */
export interface StorageSnapshot {
  data: AppData
  savedAt?: string
}

/** 当前生效的持久化方式：项目文件或浏览器本地回退 */
export type StorageKind = 'file' | 'local'

export interface PersonInput {
  practical?: boolean
  name: string
  avatar?: string
  gender?: Gender
  birthday?: string
  channel?: string
  metAt?: string
  note?: string
  tags?: string[]
  groups?: string[]
}

export type PeopleView = 'all' | 'social' | 'important' | 'followUp' | 'practical'

export interface FilterState {
  /** 分组名筛选 */
  groups: string[]
  /** 圈子 id 筛选：命中圈子内任一分组即算命中 */
  circles: string[]
  tags: string[]
}
