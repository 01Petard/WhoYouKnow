/**
 * [INPUT]: 依赖 react-router-dom 的 useNavigate；依赖 lucide-react 的 Pencil；依赖 ../components/PersonCard 的 Avatar；依赖 ../store/useStore 的 data；依赖 ../util/queries 的 circlesOfPerson
 * [OUTPUT]: 导出 ProfilePage 组件
 * [POS]: 「我的信息」页面；只展示当前用户自己的资料、分组与圈子，编辑复用人物表单
 * [PROTOCOL]: Update this header on change, then check CLAUDE.md
 */
import { useNavigate } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { Avatar } from '../components/PersonCard'
import { useStore } from '../store/useStore'
import { circlesOfPerson } from '../util/queries'

export function ProfilePage() {
  const data = useStore((s) => s.data)
  const navigate = useNavigate()
  const self = data.me

  if (!self) {
    return (
      <div className="content">
        <div className="page-header"><h1 className="page-title">我的信息</h1></div>
        <p className="hint">还没有设置当前用户。</p>
      </div>
    )
  }

  const circles = circlesOfPerson(data, self)

  return (
    <div className="content">
      <div className="page-header"><h1 className="page-title">我的信息</h1></div>
      <div className="profile-grid">
      <section className="card profile-card">
        <div className="profile-head">
          <Avatar person={self} />
          <div className="profile-title">
            <h2 className="section-title">{self.name}</h2>
            <p className="hint">{self.groups.length ? self.groups.join('、') : '未分组'}</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/profile/edit')}>
            <Pencil size={16} aria-hidden="true" /> 编辑我的信息
          </button>
        </div>

        {(self.tags.length > 0 || self.groups.length > 0 || circles.length > 0) && (
          <div className="tag-chips" style={{ marginTop: 'var(--sp-4)' }}>
            {self.tags.map((tag) => <span className="tag-chip" key={`tag-${tag}`}>标签 · {tag}</span>)}
            {self.groups.map((group) => (
              <button
                type="button"
                className="tag-chip tag-chip-link"
                key={`group-${group}`}
                onClick={() => navigate(`/categories/groups?name=${encodeURIComponent(group)}`)}
              >
                分组 · {group}
              </button>
            ))}
            {circles.map((circle) => (
              <button
                type="button"
                className="tag-chip tag-chip-link"
                key={`circle-${circle.id}`}
                onClick={() => navigate(`/categories/circles/${circle.id}`)}
              >
                圈子 · {circle.name}
              </button>
            ))}
          </div>
        )}

        <div className="details-grid" style={{ marginTop: 'var(--sp-4)' }}>
          <p className="hint">认识渠道：{self.channel || '未填写'}</p>
          <p className="hint">认识时间：{self.metAt || '未填写'}</p>
          <p className="hint">生日：{self.birthday || '未填写'}</p>
          <p className="hint">性别：{self.gender || '未填写'}</p>
        </div>
        {self.note && <p className="hint" style={{ marginTop: 'var(--sp-3)' }}>备注：{self.note}</p>}
      </section>

      <section className="card profile-stats">
        <h2 className="section-title" style={{ fontSize: 'var(--fs-h3)' }}>关系概览</h2>
        <div className="profile-stat-grid">
          <div><span className="profile-stat-value">{data.people.length}</span><span className="hint">位联系人</span></div>
          <div><span className="profile-stat-value">{data.groups.length}</span><span className="hint">个分组</span></div>
          <div><span className="profile-stat-value">{data.circles.length}</span><span className="hint">个圈子</span></div>
        </div>
        <p className="hint" style={{ marginTop: 'var(--sp-4)' }}>
          所有人默认与你相识；你只需要维护联系人的分组、圈子与标签。
        </p>
      </section>
      </div>
    </div>
  )
}
