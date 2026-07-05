import React, { useState, useEffect } from 'react'  // ← useEffect добавлен
import { Room } from '../types'
import { useTheme } from '../hooks/useTheme'
import Toast from './Toast'
import Modal from './Modal'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination, Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import { boardsApi, authApi, setTokens, getAccessToken, clearTokens } from '../services/api'

interface Props {
  rooms: Room[]
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>
  onEnterRoom: (room: Room) => void
}

const MainMenu: React.FC<Props> = ({ rooms, setRooms, onEnterRoom }) => {
  //const [userName, setUserName] = useState('')
  const [roomName, setRoomName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [toast, setToast] = useState('')
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null)
  const [editName, setEditName] = useState('')
  const [isJoinMode, setIsJoinMode] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: string; displayName: string; email: string } | null>(null)
  
  // Auth modal
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authDisplayName, setAuthDisplayName] = useState('')
  
  const { isLight, toggle } = useTheme()

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const getNextImageIndex = (): number => {
    const usedIndices = rooms.map(r => r.imageIndex || 0)
    for (let i = 1; i <= 5; i++) {
      if (!usedIndices.includes(i)) return i
    }
    return Math.floor(Math.random() * 5) + 1
  }

  useEffect(() => {
    const token = getAccessToken()
    if (token) {
      setIsLoggedIn(true)
      authApi.me()
        .then(user => setCurrentUser(user))
        .catch(() => {
          clearTokens()
          setIsLoggedIn(false)
        })
    }
  }, [])

  // доски с сервера
  useEffect(() => {
  if (!isLoggedIn) return
  const loadBoards = async () => {
    try {
      setIsLoading(true)
      const boards = await boardsApi.getMyBoards()
      console.log('📥 Loaded boards from server:', boards)
      
      const loadedRooms: Room[] = boards.map(b => ({
        id: b.id,
        serverId: b.id,
        name: b.title,
        imageIndex: getNextImageIndex()
      }))
      
      console.log('📦 Created rooms:', loadedRooms)
      setRooms(loadedRooms)
    } catch (err) {
      console.error('Failed to load boards:', err)
      showToast('Не удалось загрузить доски')
    } finally {
      setIsLoading(false)
    }
  }
  loadBoards()
}, [isLoggedIn])

  const handleLogin = async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      showToast('Заполните все поля')
      return
    }

    try {
      setIsLoading(true)
      const response = await authApi.login(authEmail, authPassword)
      setTokens(response.accessToken, response.refreshToken)
      setIsLoggedIn(true)
      setShowAuthModal(false)
      showToast('Вход выполнен успешно!')
      
      const user = await authApi.me()
      setCurrentUser(user)
    } catch (err) {
      console.error('Login failed:', err)
      showToast('Неверный email или пароль')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!authEmail.trim() || !authPassword.trim() || !authDisplayName.trim()) {
      showToast('Заполните все поля')
      return
    }

    try {
      setIsLoading(true)
      const response = await authApi.register(authEmail, authDisplayName, authPassword)
      setTokens(response.accessToken, response.refreshToken)
      setIsLoggedIn(true)
      setShowAuthModal(false)
      showToast('Регистрация успешна!')
      
      const user = await authApi.me()
      setCurrentUser(user)
    } catch (err) {
      console.error('Register failed:', err)
      showToast('Ошибка регистрации. Email может быть занят.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    clearTokens()
    setIsLoggedIn(false)
    setCurrentUser(null)
    setRooms([])
    showToast('Вы вышли из системы')
  }

  // через апишку создание доски
  const handleCreateRoom = async () => {
    const name = roomName.trim() || `Комната ${rooms.length + 1}`
    
    if (rooms.length >= 5) {
      showToast('Достигнут лимит комнат (максимум 5)')
      return
    }

    try {
      setIsLoading(true)
      const board = await boardsApi.create(name)
      const newRoom: Room = {
        id: board.id,
        serverId: board.id,
        name: board.title,
        imageIndex: getNextImageIndex()  // ← НОВОЕ
      }
      setRooms([...rooms, newRoom])
      setRoomName('')
      showToast(`Комната "${name}" создана`)
    } catch (err) {
      console.error('Failed to create board:', err)
      showToast('Не удалось создать доску')
    } finally {
      setIsLoading(false)
    }
  }

  // через апи удалить доску
  const deleteRoom = async () => {
    if (!deletingRoom) return

    try {
      if (deletingRoom.serverId) {
        await boardsApi.deleteBoard(deletingRoom.serverId)
      }
      setRooms(rooms.filter(r => r.id !== deletingRoom.id))
      showToast(`Комната "${deletingRoom.name}" удалена`)
    } catch (err) {
      console.error('Failed to delete board:', err)
      showToast('Не удалось удалить доску')
    } finally {
      setDeletingRoom(null)
    }
  }

  const joinRoom = () => {
    if (!inviteCode.trim()) {
      showToast('Введите пригласительный код')
      return
    }
    showToast(`Попытка присоединиться к комнате с кодом "${inviteCode}"`)
  }

  /*const saveEditRoom = () => {
    if (editingRoom && editName.trim()) {
      setRooms(rooms.map(r => r.id === editingRoom.id ? { ...r, name: editName.trim() } : r))
      showToast('Название обновлено')
      setEditingRoom(null)
      setEditName('')
    }
  }*/

  const handleReload = () => {
    window.location.reload()
  }

  /*const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIndex) return
    const newRooms = [...rooms]
    const [removed] = newRooms.splice(draggedIndex, 1)
    newRooms.splice(targetIndex, 0, removed)
    setRooms(newRooms)
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  } */

  // не авторизован
  if (!isLoggedIn) {
    return (
      <div id="main-menu">
        {toast && <Toast message={toast} className="main-menu-toast" />}
        <div className="menu-logo">
          <button className="menu-theme-btn" onClick={toggle}>
            <img src={isLight ? '/icons/sun.png' : '/icons/moon.png'} alt="Тема" style={{ width: '20px', height: '20px' }} />
          </button>
          <h1 onClick={handleReload} style={{ cursor: 'pointer' }}>TogeDraw</h1>
          <div className="avatar-placeholder">
            <img src="/icons/logo.png" alt="Логотип" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <p className="menu-label">Добро пожаловать!</p>
          <button 
            className="menu-action-btn" 
            onClick={() => setShowAuthModal(true)}
            style={{ marginTop: '20px', padding: '15px 30px', fontSize: '16px' }}
          >
            Войти или зарегистрироваться
          </button>
        </div>

        <Modal
          isOpen={showAuthModal}
          title={authMode === 'login' ? 'Вход в систему' : 'Регистрация'}
          onClose={() => setShowAuthModal(false)}
        >
          <div style={{ textAlign: 'left', marginBottom: 10 }}>
            <input
              type="email"
              className="modal-input"
              placeholder="Email"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              style={{ marginBottom: '10px' }}
            />
            {authMode === 'register' && (
              <input
                type="text"
                className="modal-input"
                placeholder="Отображаемое имя"
                value={authDisplayName}
                onChange={e => setAuthDisplayName(e.target.value)}
                style={{ marginBottom: '10px' }}
              />
            )}
            <input
              type="password"
              className="modal-input"
              placeholder="Пароль"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              style={{ marginBottom: '15px' }}
            />
          </div>
          <div className="modal-actions">
            <button 
              className="modal-btn" 
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              disabled={isLoading}
            >
              {authMode === 'login' ? 'Регистрация' : 'Вход'}
            </button>
            <button 
              className="modal-btn confirm" 
              onClick={authMode === 'login' ? handleLogin : handleRegister}
              disabled={isLoading}
            >
              {isLoading ? 'Загрузка...' : (authMode === 'login' ? 'Войти' : 'Зарегистрироваться')}
            </button>
          </div>
        </Modal>
      </div>
    )
  }

  // основа
  return (
    <div id="main-menu">
      {toast && <Toast message={toast} className="main-menu-toast" />}
      <div className="menu-logo">
        <button className="menu-theme-btn" onClick={toggle}>
          <img src={isLight ? '/icons/sun.png' : '/icons/moon.png'} alt="Тема" style={{ width: '20px', height: '20px' }} />
        </button>
        <h1 onClick={handleReload} style={{ cursor: 'pointer' }}>TogeDraw</h1>
        <div className="avatar-placeholder">
          <img src="/icons/logo.png" alt="Логотип" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <p className="menu-label">Привет, {currentUser?.displayName || 'Пользователь'}!</p>
        <div className="menu-input-group">
          {!isJoinMode ? (
            <>
              <input
                type="text"
                placeholder="Название комнаты"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
              />
              <button onClick={handleCreateRoom} disabled={isLoading}>
                {isLoading ? 'Создание...' : 'Создать'}
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Пригласительный код"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
              />
              <button onClick={joinRoom} disabled={isLoading}>Войти</button>
            </>
          )}
        </div>
        {!isJoinMode ? (
          <button className="menu-action-btn" onClick={() => setIsJoinMode(true)}>Присоединиться</button>
        ) : (
          <button className="menu-action-btn" onClick={() => setIsJoinMode(false)}>Назад</button>
        )}
        <button 
          className="menu-action-btn" 
          onClick={handleLogout}
          style={{ marginTop: '10px', background: 'var(--danger-red, #ff4444)' }}
        >
          Выйти
        </button>
      </div>

           <div className="rooms-container">
        <h3 className="section-title">Мои комнаты {rooms.length}/5</h3>
        
        {rooms.length > 0 ? (
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={16}
            slidesPerView={1}
            navigation
            pagination={{ clickable: true }}
            autoplay={{ delay: 5000, disableOnInteraction: false }}
            loop={false}
            observer={true}
            observeParents={true}
            key={rooms.length}
            className="rooms-swiper"
            style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }} // ← Убрали вложенный div, стили сюда
          >
            {rooms.map((room) => (
              <SwiperSlide key={room.id}>
                <div className="room-card">
                  <div className="room-card-inner">
                    <div
                      className="room-card-image"
                      onClick={() => onEnterRoom(room)}
                    >
                      <img
                        src={`/backgrounds/bg${room.imageIndex || 1}.png`}
                        alt={room.name}
                      />
                    </div>
                    <div className="room-card-name">{room.name}</div>
                    <div className="room-card-actions">
                      <button
                        className="btn-edit"
                        onClick={() => {
                          setEditingRoom(room)
                          setEditName(room.name)
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => setDeletingRoom(room)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        ) : (
          <p className="no-rooms">У вас пока нет комнат</p>
        )}
      </div>
            {/* Восстанавливаем модалку для подтверждения удаления комнаты */}
      {deletingRoom && (
        <Modal
          isOpen={!!deletingRoom}
          title={`Удалить комнату "${deletingRoom.name}"?`}
          desc="Это действие необратимо. Все рисунки и данные комнаты будут удалены с сервера."
          onClose={() => setDeletingRoom(null)}
          actions={
            <>
              <button className="modal-btn" onClick={() => setDeletingRoom(null)}>Отмена</button>
              <button className="modal-btn danger" onClick={deleteRoom}>Удалить</button>
            </>
          }
        />
      )}
</div>
  )
}

export default MainMenu