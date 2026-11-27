/**
 * [INPUT]: 使用 Node test、模拟文件 API 和浏览器存储。
 * [OUTPUT]: 覆盖保存、备份恢复、CSV 导入、待联系、事务目录和手记的回归测试。
 * [POS]: 验证核心数据流程，不访问项目真实数据文件。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.includes('.ts') && /^\.{1,2}\//.test(specifier) && !specifier.endsWith('.ts')) {
      return next(`${specifier}.ts`, context)
    }
    return next(specifier, context)
  },
})

const person = (id, fields = {}) => ({
  id, name: id, channel: '', metAt: '', note: '', tags: [], groups: [], createdAt: '', updatedAt: '', ...fields,
})
const empty = { version: 1, people: [], tags: [], groups: [], circles: [], me: person('本人') }
const original = { ...empty, people: [person('原联系人')] }
const names = (data) => data.people.map((p) => p.name)
const storage = (id) => import(`../src/util/storage.ts?${id}`)

function fixture(initial) {
  const cache = new Map()
  let file = initial
  let revision = 1
  let offline = false
  let rejectLocal = false
  let beforeWrite
  globalThis.localStorage = {
    get length() { return cache.size },
    key: (index) => [...cache.keys()][index] ?? null,
    getItem: (key) => cache.get(key) ?? null,
    setItem(key, value) {
      if (rejectLocal) throw new Error('存储空间不足')
      cache.set(key, value)
    },
    removeItem: (key) => cache.delete(key),
  }
  const response = (body, status) => Response.json(body, { status, headers: { ETag: file ? `"${revision}"` : '"0"' } })
  globalThis.fetch = async (_url, options) => {
    if (offline) throw new Error('文件服务离线')
    if (options.method !== 'PUT') return file ? response({ data: file }, 200) : response({ reason: 'no-data-file' }, 404)
    const wait = beforeWrite
    beforeWrite = undefined
    if (wait) await wait
    const current = file ? `"${revision}"` : '"0"'
    if (options.headers['If-Match'] !== current) return response({}, 409)
    file = JSON.parse(options.body).data
    revision += 1
    return response({}, 200)
  }
  return {
    get file() { return file },
    cache,
    offline: (value) => { offline = value },
    rejectLocal: () => { rejectLocal = true },
    replaceFile: (value) => { file = value; revision += 1 },
    delayWrite: () => {
      let release
      beforeWrite = new Promise((resolve) => { release = resolve })
      return release
    },
  }
}

test('文件服务恢复后重新打开，合并浏览器暂存的新增和远端修改', async () => {
  const f = fixture(original)
  const first = await storage('offline')
  const initial = await first.bootstrap({ data: empty })
  const edited = { ...original, people: [...original.people, person('离线新增')] }
  f.offline(true)
  assert.equal((await first.persist({ data: edited }, initial.snapshot.data)).kind, 'local')
  f.replaceFile({ ...original, people: [person('原联系人', { note: '远端备注' })] })
  f.offline(false)
  const next = await storage('reopened')
  const recovered = await next.bootstrap({ data: empty })
  assert.equal(recovered.kind, 'file')
  assert.deepEqual(names(f.file), ['原联系人', '离线新增'])
  assert.equal(f.file.people[0].note, '远端备注')
})

test('冲突合并后排队的下一笔保存保留远端新增和同一联系人上不同字段的修改', async () => {
  const f = fixture(original)
  const tab = await storage('queue')
  const initial = (await tab.bootstrap({ data: empty })).snapshot.data
  const release = f.delayWrite()
  const firstEdit = { ...initial, people: [person('原联系人', { note: '本页备注' })] }
  const first = tab.persist({ data: firstEdit }, initial)
  const second = tab.persist({ data: { ...firstEdit, people: [...firstEdit.people, person('第二笔新增')] } }, firstEdit)
  f.replaceFile({ ...original, people: [person('原联系人', { channel: '远端渠道' }), person('远端新增')] })
  release()
  assert.equal((await first).ok, true)
  assert.equal((await second).ok, true)
  assert.deepEqual(new Set(names(f.file)), new Set(['原联系人', '远端新增', '第二笔新增']))
  assert.equal(f.file.people[0].note, '本页备注')
  assert.equal(f.file.people[0].channel, '远端渠道')
})

test('保存状态等待实际写入，双重失败保留页面改动并可重试', async () => {
  const f = fixture(original)
  const { useStore } = await import('../src/store/useStore.ts')
  await useStore.getState().hydrate()
  f.offline(true)
  f.rejectLocal()
  assert.equal(useStore.getState().addPerson({ name: '内存草稿' }), true)
  assert.equal(useStore.getState().storageSaving, true)
  assert.equal((await useStore.getState().storageSettled()).ok, false)
  assert.equal(useStore.getState().storageSaving, false)
  assert.equal(useStore.getState().storageError, true)
  f.offline(false)
  const retry = await useStore.getState().storageSaveNow()
  assert.equal(retry.kind, 'file')
  assert.deepEqual(names(f.file), ['原联系人', '内存草稿'])
})

test('多个离线标签页的草稿在打开时一起同步，保留删除', async () => {
  const f = fixture(original)
  const first = await storage('offline-delete')
  const second = await storage('offline-add')
  const a = (await first.bootstrap({ data: empty })).snapshot.data
  const b = (await second.bootstrap({ data: empty })).snapshot.data
  f.offline(true)
  await first.persist({ data: { ...a, people: [] } }, a)
  await second.persist({ data: { ...b, people: [...b.people, person('另一页新增')] } }, b)
  f.offline(false)
  const next = await storage('reopen-many')
  assert.equal((await next.bootstrap({ data: empty })).kind, 'file')
  assert.deepEqual(names(f.file), ['另一页新增'])
  assert.equal([...f.cache.keys()].filter((key) => key.includes('.pending.')).length, 0)
})

test('旧版浏览器镜像有较新的新增记录，升级后恢复该记录', async () => {
  const f = fixture(original)
  f.cache.set('linkmap.data.v1', JSON.stringify({
    data: { ...original, people: [...original.people, person('旧版离线新增')] },
    savedAt: '2026-01-02T00:00:00.000Z',
  }))
  const fetchFile = globalThis.fetch
  globalThis.fetch = async (url, options) => options.method === 'PUT' ? fetchFile(url, options) :
    Response.json({ data: original, savedAt: '2026-01-01T00:00:00.000Z' }, { headers: { ETag: '"1"' } })
  const upgraded = await storage('upgrade')
  await upgraded.bootstrap({ data: empty })
  assert.deepEqual(names(f.file), ['原联系人', '旧版离线新增'])
})

test('完整恢复使用确认时的文件版本，遇到并发写入保留远端与页面原数据', async () => {
  const f = fixture(original)
  const tab = await storage('restore')
  const initial = (await tab.bootstrap({ data: empty })).snapshot.data
  const restored = { ...empty, people: [person('备份联系人')] }
  f.replaceFile({ ...original, people: [...original.people, person('远端新增')] })
  const conflict = await tab.persist({ data: restored }, initial, true)
  assert.equal(conflict.ok, false)
  assert.deepEqual(names(conflict.data), ['原联系人'])
  assert.deepEqual(names(f.file), ['原联系人', '远端新增'])
  const latest = await tab.reloadFromFile()
  assert.equal((await tab.persist({ data: restored }, latest.data, true)).ok, true)
  assert.deepEqual(names(f.file), ['备份联系人'])
})

test('CSV 换列、旧表头与重复表头', async () => {
  const { parsePeopleCsv } = await import('../src/util/csv.ts')
  const reordered = parsePeopleCsv('\uFEFF分组,姓名,标签,生日,备注\n项目组,张三,同事,1990-02-01,"备注,内容"', [])
  assert.deepEqual(reordered.errors, [])
  assert.deepEqual(reordered.rows[0], {
    rowNumber: 2, name: '张三', tags: ['同事'], groups: ['项目组'],
    birthday: '1990-02-01', note: '备注,内容', duplicateWith: undefined,
  })
  assert.deepEqual(parsePeopleCsv('姓名,标签,圈子,备注\n张三,,原分组,', []).rows[0].groups, ['原分组'])
  assert.equal(parsePeopleCsv('姓名,标签,标签\n张三,a,b', []).errors[0].row, 1)
  assert.equal(parsePeopleCsv('标签,分组\na,b', []).errors[0].row, 1)
})

test('重要及待联系视图按本地日历跨月计算，与条件叠加，JSON 保留记录', async () => {
  const { filterPeople } = await import('../src/util/queries.ts')
  const { validateBackup, makeBackup } = await import('../src/util/backup.ts')
  const data = { ...empty, groups: ['分组'], people: [
    person('未记录', { important: true }),
    person('满30天', { important: true, groups: ['分组'], lastContactAt: '2026-02-20' }),
    person('最近联系', { important: true, lastContactAt: '2026-02-21' }),
    person('普通联系人'),
  ] }
  const filters = { groups: [], circles: [], tags: [], search: '' }
  assert.equal(filterPeople(data, { ...filters, view: 'important' }).length, 3)
  assert.deepEqual(new Set(filterPeople(data, { ...filters, view: 'followUp' }, '2026-03-22').map((p) => p.id)),
    new Set(['未记录', '满30天']))
  assert.deepEqual(filterPeople(data, { ...filters, groups: ['分组'], view: 'followUp' }, '2026-03-22').map((p) => p.id), ['满30天'])
  const restored = validateBackup(JSON.parse(JSON.stringify(makeBackup(data))))
  assert.ok(restored.ok)
  assert.equal(restored.data.people[1].lastContactAt, '2026-02-20')
  assert.equal(restored.data.people[3].lastContactAt, undefined)
})

test('人脉按姓名查询，分类条件按维度组合', async () => {
  const { filterPeople } = await import('../src/util/queries.ts')
  const data = { ...empty, circles: [{ id: '同事', name: '同事', groups: ['研发', '设计'] }], people: [
    person('张三', { groups: ['研发'], tags: ['常联系'] }),
    person('张四', { groups: ['设计'], tags: ['重要'] }),
    person('张五', { groups: ['外部'], tags: ['常联系'] }),
    person('李四', { groups: ['研发'], tags: ['常联系'], note: '张三' }),
  ] }
  const filter = { search: ' 张 ', searchByName: true, groups: ['研发', '设计', '外部'], circles: ['同事'], tags: ['常联系'] }
  assert.deepEqual(filterPeople(data, filter).map(({ name }) => name), ['张三'])
  assert.deepEqual(filterPeople(data, { ...filter, tags: ['常联系', '重要'] }).map(({ name }) => name), ['张三', '张四'])
})

test('事务联系人可移入和移回，编辑与备份恢复保留目录状态', async () => {
  const { filterPeople } = await import('../src/util/queries.ts')
  const { makeBackup, validateBackup } = await import('../src/util/backup.ts')
  const f = fixture({ ...empty, people: [person('租房联系人', { important: true }), person('朋友')] })
  const { useStore } = await import('../src/store/useStore.ts?practical-contacts')
  const state = useStore.getState()
  await state.hydrate()

  assert.equal(state.setPractical('租房联系人', true), true)
  assert.equal(state.updatePerson('租房联系人', { name: '房东' }), true)
  await state.storageSettled()
  const backup = validateBackup(JSON.parse(JSON.stringify(makeBackup(f.file))))
  assert.ok(backup.ok)
  const filter = { search: '', groups: [], circles: [], tags: [] }
  assert.deepEqual(new Set(filterPeople(backup.data, { ...filter, view: 'all' }).map(({ name }) => name)), new Set(['朋友', '房东']))
  assert.deepEqual(filterPeople(backup.data, { ...filter, view: 'social' }).map(({ name }) => name), ['朋友'])
  assert.deepEqual(filterPeople(backup.data, { ...filter, view: 'important' }), [])
  assert.deepEqual(filterPeople(backup.data, { ...filter, view: 'followUp' }), [])
  assert.deepEqual(filterPeople(backup.data, { ...filter, view: 'practical' }).map(({ name }) => name), ['房东'])

  assert.equal(state.setPractical('租房联系人', false), true)
  await state.storageSettled()
  assert.deepEqual(filterPeople(f.file, { ...filter, view: 'practical' }), [])
  assert.deepEqual(filterPeople(f.file, { ...filter, view: 'important' }).map(({ name }) => name), ['房东'])
  assert.equal(state.addPerson({ name: '新房东', practical: true }), true)
  await state.storageSettled()
  assert.deepEqual(filterPeople(f.file, { ...filter, view: 'practical' }).map(({ name }) => name), ['新房东'])
})

test('联系手记允许同日消息和见面独立保存，编辑联系人不会丢失手记', async () => {
  const { latestContactDate } = await import('../src/util/contactJournal.ts')
  const f = fixture({ ...original, people: [person('原联系人', { lastContactAt: '2020-06-01' })] })
  const { useStore } = await import('../src/store/useStore.ts?journal-crud')
  await useStore.getState().hydrate()

  const first = { date: '2020-05-12', method: 'message', note: '微信聊了近况' }
  const second = { date: first.date, method: 'inPerson', note: '见面喝咖啡' }
  assert.equal(useStore.getState().saveContactEntry('原联系人', first), true)
  assert.equal(useStore.getState().saveContactEntry('原联系人', second), true)
  assert.equal(useStore.getState().saveContactEntry('原联系人', { ...first, date: '2099-01-01' }), false)
  await useStore.getState().storageSettled()
  assert.equal(f.file.people[0].contactHistory.length, 2)
  assert.equal(latestContactDate(f.file.people[0]), '2020-06-01')

  const [entry] = f.file.people[0].contactHistory
  assert.equal(useStore.getState().saveContactEntry('原联系人', { ...first, date: '2020-06-15' }, entry.id), true)
  assert.equal(useStore.getState().updatePerson('原联系人', { name: '已编辑姓名' }), true)
  await useStore.getState().storageSettled()
  assert.equal(latestContactDate(f.file.people[0]), '2020-06-15')
  assert.equal(f.file.people[0].contactHistory.length, 2)

  assert.equal(useStore.getState().deleteContactEntry('原联系人', entry.id), true)
  await useStore.getState().storageSettled()
  assert.equal(f.file.people[0].contactHistory[0].note, second.note)
  assert.equal(latestContactDate(f.file.people[0]), '2020-06-01')
  assert.equal(useStore.getState().deleteContactEntry('原联系人', entry.id), false)
})

test('同一联系人的手记并发写入按记录合并，已有手记仍能删除', async () => {
  const { mergeData } = await import('../src/util/merge.ts')
  const entry = (id, date = '2020-11-26') => ({ id, date, method: 'call', note: id, updatedAt: date })
  const withHistory = (contactHistory) => ({ ...original, people: [{ ...original.people[0], contactHistory }] })
  const shared = entry('基线记录')
  const mine = entry('本页新增')
  const theirs = entry('另一页新增')
  const merged = mergeData(withHistory([shared]), withHistory([mine]), withHistory([shared, theirs]))
  assert.deepEqual(new Set(merged.people[0].contactHistory.map((item) => item.id)), new Set([mine.id, theirs.id]))
  const firstWrites = mergeData(original, withHistory([mine]), withHistory([theirs]))
  assert.equal(firstWrites.people[0].contactHistory.length, 2)
})

test('手记备份保留记录，最新日期更新待联系，往年今日排除今年', async () => {
  const { collectContactEntries, wentByOnThisDay } = await import('../src/util/contactJournal.ts')
  const { makeBackup, validateBackup } = await import('../src/util/backup.ts')
  const { filterPeople } = await import('../src/util/queries.ts')
  const history = [
    { id:'year-old', date:'2024-11-26', method:'inPerson', note:'周年记录', updatedAt:'2024-11-26T00:00:00Z' },
    { id:'recent', date:'2025-11-26', method:'call', note:'本次联系', updatedAt:'2025-11-26T00:00:00Z' },
  ]
  const data = { ...original, people: [person('原联系人', { important:true, lastContactAt:'2024-02-01', contactHistory:history })] }
  const restore = validateBackup(JSON.parse(JSON.stringify(makeBackup(data))))
  assert.equal(restore.ok, true)
  assert.deepEqual(restore.data.people[0].contactHistory, history)
  const journal = collectContactEntries(restore.data.people)
  assert.deepEqual(journal.map(({ entry }) => entry.id), ['recent', 'year-old'])
  assert.deepEqual(journal.filter(({ entry }) => wentByOnThisDay(entry.date, '2025-11-26')).map(({ entry }) => entry.id), ['year-old'])
  assert.deepEqual(filterPeople(restore.data, { view:'followUp', search:'', groups:[], circles:[], tags:[] }, '2025-11-26'), [])
  assert.equal(validateBackup(original).ok, true)
  const invalid = { ...data, people: [person('重复编号', { contactHistory:[history[0], history[0]] })] }
  assert.equal(validateBackup(invalid).ok, false)
})
