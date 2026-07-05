import type { BoardMember } from '../types'

interface Props {
  members: BoardMember[]  // ← Было: users: User[]
  onInvite: () => void
  onKick: (userId: string) => void
  onBan: (userId: string) => void
  onCrown: (userId: string) => void
  onClose: () => void
  onReorder: (members: BoardMember[]) => void
}

const SidebarRight: React.FC<Props> = ({
  members,
  onInvite,
  onKick,
  onBan,
  onCrown,
  onReorder,
}) => {
  // Цвета для аватаров
  const getAvatarColor = (index: number) => {
    const colors = ['orange', 'green', 'blue', 'purple', 'pink']
    return colors[index % colors.length]
  }

  // Иконки для ролей
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Owner': return '👑'
      case 'Presenter': return '🎤'
      case 'Editor': return '✏️'
      case 'Viewer': return '👁️'
      default: return '👤'
    }
  }

  return (
    <div className="sidebar-right">
      <div className="sidebar-header">
        <h3>Участники ({members.length})</h3>
        <button className="invite-btn" onClick={onInvite}>
          + Пригласить
        </button>
      </div>

      <div className="users-list">
        {members.map((member, index) => (
          <div key={member.userId} className="user-item">
            <div className={`user-avatar ${getAvatarColor(index)}`}>
              {member.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">
                {member.displayName}
                <span className="role-icon" title={member.role}>
                  {getRoleIcon(member.role)}
                </span>
              </span>
              <span className="user-role">{member.role}</span>
            </div>
            {/* Кнопки действий (только для Owner/Presenter) */}
            {member.role !== 'Owner' && (
              <div className="user-actions">
                <button
                  className="action-btn"
                  onClick={() => onKick(member.userId)}
                  title="Удалить"
                >
                  🚫
                </button>
                <button
                  className="action-btn"
                  onClick={() => onBan(member.userId)}
                  title="Запретить рисовать"
                >
                  ⛔
                </button>
                <button
                  className="action-btn"
                  onClick={() => onCrown(member.userId)}
                  title="Сделать владельцем"
                >
                  👑
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default SidebarRight