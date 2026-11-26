/**
 * [INPUT]: 使用 Node test、模拟文件 API 和浏览器存储。
 * [OUTPUT]: 覆盖保存、备份恢复、CSV 导入和待联系规则的回归测试。
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
