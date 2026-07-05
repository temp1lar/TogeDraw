import React, { ReactNode } from 'react'

interface Props {
  isOpen: boolean
  title: string
  desc?: string
  onClose: () => void
  actions?: ReactNode
  children?: ReactNode
}

const Modal: React.FC<Props> = ({ isOpen, title, desc, onClose, actions, children }) => {
  if (!isOpen) return null

  return (
    <div className="modal-overlay active" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <button className="close-cross-btn" onClick={onClose}>✕</button>
        <div className="modal-title">{title}</div>
        {desc && <div className="modal-desc">{desc}</div>}
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  )
}

export default Modal