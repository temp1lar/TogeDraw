import { useState, useEffect } from 'react'
import MainMenu from './components/MainMenu'
import CanvasScreen from './components/CanvasScreen'
import { Room } from './types'
import { accessApi } from './services/api'

function App() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)

  // Проверяем URL на invite-токен
  useEffect(() => {
    const path = window.location.pathname
    if (path.startsWith('/invite/')) {
      const inviteToken = path.split('/invite/')[1]
      handleAcceptInvite(inviteToken)
    }
  }, [])

  const handleAcceptInvite = async (inviteToken: string) => {
    try {
      const member = await accessApi.acceptInvite(inviteToken)
      alert(`Вы присоединились к доске! Роль: ${member.role}`)
      // Перезагружаем список досок
      window.location.href = '/'
    } catch (err) {
      console.error('Failed to accept invite:', err)
      alert('Не удалось принять приглашение. Ссылка может быть недействительной.')
    }
  }

  const handleEnterRoom = (room: Room) => setCurrentRoom(room)
  const handleExitRoom = () => setCurrentRoom(null)

  if (currentRoom) {
    return (
      <CanvasScreen
        room={currentRoom}
        onExit={handleExitRoom}
        onUpdateRoom={(updated) => {
          setRooms(rooms.map(r => r.id === updated.id ? updated : r))
          setCurrentRoom(updated)
        }}
      />
    )
  }

  return (
    <MainMenu
      rooms={rooms}
      setRooms={setRooms}
      onEnterRoom={handleEnterRoom}
    />
  )
}

export default App