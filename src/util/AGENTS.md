# util/

> L2 | Parent: [../AGENTS.md](../AGENTS.md)

- `backup.ts` 校验与迁移 JSON 备份，恢复工作台记录并校验联系人引用。
- `constants.ts` 提供共享常量和界面文案。
- `contactJournal.ts` 查询最新联系日期、时间线与往年今日，提供手记跳转锚点。
- `contactIndex.ts` 按姓名首字母归类联系人。
- `csv.ts` 按表头导入联系人并导出固定模板。
- `exchanges.ts` 校验往来类别、方向、计划日期与实际日期。
- `experiences.ts` 按发生日期倒序排列共同经历。
- `format.ts` 格式化展示日期、相对时间与首字。
- `id.ts` 创建标识符，校验和比较日历日期。
- `introductions.ts` 校验三方角色和引荐状态，解析引荐角色的显示名称。
- `legacyWorkspace.ts` 校验旧快照的项目、城市和行程字段，供备份往返。
- `merge.ts` 按提交基线合并业务记录，按来源编号合并同年选编。
- `queries.ts` 派生圈子成员并执行姓名查询、事务目录及分类筛选。
- `reviews.ts` 统计年度来源和重新联系，解析选编引用与 Markdown 内容。
- `storage.ts` 串行同步文件快照并恢复浏览器草稿。

[PROTOCOL]: Update this header on change, then check AGENTS.md
