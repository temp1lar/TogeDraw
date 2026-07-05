import React, { useState } from 'react'
import Modal from './Modal'
import { accessApi } from '../services/api'
import type { BoardRole } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  boardId: string
  onInvited: () => void
}

const InviteModal: React.FC<Props> = ({ isOpen, onClose, boardId, onInvited }) => {
  const [mode, setMode] = useState<'email' | 'link'>('email')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<BoardRole>('Editor')
  const [isLoading, setIsLoading] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleInviteByEmail = async () => {
    if (!email.trim()) {
      setError('Введите email')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await accessApi.inviteUser(boardId, email, role)
      setEmail('')
      onInvited()
      alert('Пользователь приглашён!')
      onClose()
    } catch (err) {
      console.error('Failed to invite user:', err)
      setError('Не удалось пригласить пользователя. Проверьте email.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateInviteLink = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await accessApi.createInviteLink(boardId, role, 24, 100)
      const fullUrl = `${window.location.origin}/invite/${response.inviteToken}`
      setGeneratedLink(fullUrl)
    } catch (err) {
      console.error('Failed to create invite link:', err)
      setError('Не удалось создать ссылку')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard?.writeText(generatedLink)
      alert('Ссылка скопирована!')
    }
  }

  const handleClose = () => {
    setGeneratedLink(null)
    setError(null)
    setEmail('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Пригласить пользователя"
      onClose={handleClose}
    >
      <div style={{ textAlign: 'left' }}>
        {/* Переключатель режима */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            className={`modal-btn ${mode === 'email' ? 'confirm' : ''}`}
            onClick={() => setMode('email')}
            disabled={isLoading}
          >
            По Email
          </button>
          <button
            className={`modal-btn ${mode === 'link' ? 'confirm' : ''}`}
            onClick={() => setMode('link')}
            disabled={isLoading}
          >
            По ссылке
          </button>
        </div>

        {/* Выбор роли */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>
            Роль:
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as BoardRole)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="Viewer">Зритель (только просмотр)</option>
            <option value="Editor">Редактор (может рисовать)</option>
            <option value="Presenter">Презентер (может управлять режимом)</option>
          </select>
        </div>

        {/* Режим email */}
        {mode === 'email' && (
          <>
            <input
              type="email"
              className="modal-input"
              placeholder="Email пользователя"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ marginBottom: '15px' }}
            />
            <div className="modal-actions">
              <button className="modal-btn" onClick={handleClose} disabled={isLoading}>
                Отмена
              </button>
              <button
                className="modal-btn confirm"
                onClick={handleInviteByEmail}
                disabled={isLoading}
              >
                {isLoading ? 'Отправка...' : 'Пригласить'}
              </button>
            </div>
          </>
        )}

        {/* Режим ссылки */}
        {mode === 'link' && !generatedLink && (
          <div className="modal-actions">
            <button className="modal-btn" onClick={handleClose} disabled={isLoading}>
              Отмена
            </button>
            <button
              className="modal-btn confirm"
              onClick={handleCreateInviteLink}
              disabled={isLoading}
            >
              {isLoading ? 'Создание...' : 'Создать ссылку'}
            </button>
          </div>
        )}

        {mode === 'link' && generatedLink && (
          <>
            <div
              onClick={handleCopyLink}
              style={{
                background: 'var(--bg-main)',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '15px',
                fontWeight: '500',
                wordBreak: 'break-all',
                border: '1px dashed var(--border-color)',
                color: 'var(--accent-blue)',
                cursor: 'pointer',
              }}
            >
              {generatedLink}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
              Ссылка действительна 24 часа. Нажмите для копирования.
            </p>
            <div className="modal-actions">
              <button className="modal-btn" onClick={handleCopyLink}>
                Копировать
              </button>
              <button className="modal-btn confirm" onClick={handleClose}>
                Готово
              </button>
            </div>
          </>
        )}

        {error && (
          <p style={{ color: 'var(--danger-red)', marginTop: '10px', fontSize: '14px' }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

export default InviteModal