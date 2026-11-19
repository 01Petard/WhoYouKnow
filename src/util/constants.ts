/**
 * [INPUT]: 不导入任何模块；集中声明本地存储键、数据版本、阈值与中文文案
 * [OUTPUT]: 导出 STORAGE_KEY、DATA_VERSION、DATA_FILE_PATH、UNCLASSIFIED、BULK_SOFT_LIMIT、TOAST_MS/TOAST_UNDO_MS、COPY、CSV_TEMPLATE_HEADERS
 * [POS]: 全局常量与界面文案的唯一来源；store、util、components、pages 都从此取值，禁止另写魔数或重复文案
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
export const STORAGE_KEY = 'linkmap.data.v1'
// 保持 v1：me 为纯增量可选字段；旧数据用 selfId 迁移出 me，避免版本不兼容导致的数据丢失
export const DATA_VERSION = 1

/** 项目数据文件路径（由 Vite 文件 API 读写） */
export const DATA_FILE_PATH = 'data/linkmap.json'

/** 人脉分面里的「未分类」哨兵值 */
export const UNCLASSIFIED = '__unclassified__'

export const BULK_SOFT_LIMIT = 50

export const TOAST_MS = 3000
export const TOAST_UNDO_MS = 5000

/** 文案常量表：逐字取视觉规范 5.7/5.10 与体验规范 5.3/4.4 */
export const COPY = {
  emptyNoPeople: '还没有记录任何人',
  emptySearch: '没有找到匹配的人',
  emptyFilter: '当前筛选下没有结果',
  actionAdd: '添加人物',
  actionClearFilter: '清除筛选',
  deletePersonDialog: (name: string) => `删除「${name}」？此操作不可撤销。`,
  restoreDialog: '恢复将覆盖当前全部数据，建议先导出备份。',
  selfSetupTitle: '选择你自己',
  selfSetupHint: '这是你的个人关系系统。先选一位联系人代表你，所有人默认与你相识，关系网以你为中心展开。',
  selfSetupName: '你的姓名',
} as const

// CSV 第 3 列表头为「分组」：导入导出只涉及分组这一整理维度；
// 圈子是分组之上的归类视图，由分组派生，不进入 CSV。导入按列位置读取（见 csv.ts），旧表头「圈子」的文件仍可正常导入
export const CSV_TEMPLATE_HEADERS = ['姓名', '标签', '分组', '备注', '生日'] as const
