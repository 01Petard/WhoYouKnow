/**
 * [INPUT]: 依赖路由导航、资料头像、全局资料与圈子成员查询。
 * [OUTPUT]: 导出 ProfilePage 组件。
 * [POS]: 展示当前用户的身份、基本资料、分类与关系概览；编辑复用人物表单。
 * [PROTOCOL]: Update this header on change, then check AGENTS.md
 */
import { useNavigate } from 'react-router-dom'
import { CircleDot, Folder, Pencil, Users } from 'lucide-react'
import { Avatar } from '../components/PersonCard'
import { useStore } from '../store/useStore'
import { circlesOfPerson } from '../util/queries'

export function ProfilePage() {
  const data = useStore((state) => state.data)
  const navigate = useNavigate()
  const self = data.me

  if (!self) {
    return (
      <div className="content person-workspace">
        <div className="page-header"><h1 className="page-title">我的信息</h1></div>
        <p className="hint">还没有设置当前用户。</p>
      </div>
    )
  }

  const circles = circlesOfPerson(data, self)
  const hasCategories = self.tags.length > 0 || self.groups.length > 0 || circles.length > 0
  const overview = [
    { label: '联系人', value: data.people.length, Icon: Users },
    { label: '分组', value: data.groups.length, Icon: Folder },
    { label: '圈子', value: data.circles.length, Icon: CircleDot },
  ]

  return (
    <div className="content person-workspace">
      <div className="page-header"><h1 className="page-title">我的信息</h1></div>

      <header className="person-identity person-identity-self">
        <Avatar person={self} />
        <div className="person-identity-copy">
          <h2>{self.name}</h2>
        </div>
        <div className="person-identity-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/profile/edit')}>
            <Pencil size={16} aria-hidden="true" /> 编辑我的信息
          </button>
        </div>
      </header>

      <div className="person-workspace-grid">
        <section className="card person-panel" aria-labelledby="profile-details-heading">
          <h2 id="profile-details-heading" className="section-title">基本资料</h2>
          <dl className="person-facts">
            <div><dt>认识渠道</dt><dd>{self.channel || '未填写'}</dd></div>
            <div><dt>认识时间</dt><dd>{self.metAt || '未填写'}</dd></div>
            <div><dt>生日</dt><dd>{self.birthday || '未填写'}</dd></div>
            <div><dt>性别</dt><dd>{self.gender || '未填写'}</dd></div>
          </dl>
          <div className="person-note">
            <h3>备注</h3>
            <p>{self.note || '暂无备注'}</p>
          </div>

          {hasCategories && (
            <div className="person-note">
              <h3>分类</h3>
              <div className="tag-chips">
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
            </div>
          )}
        </section>

        <section className="card person-panel" aria-labelledby="profile-overview-heading">
          <h2 id="profile-overview-heading" className="section-title">关系概览</h2>
          <dl className="profile-overview">
            {overview.map(({ label, value, Icon }) => (
              <div key={label}>
                <dt><Icon size={18} strokeWidth={1.7} aria-hidden="true" /> {label}</dt>
                <dd className="tabular">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  )
}
