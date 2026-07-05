import React, { useState, useEffect } from 'react'

interface Props {
  isOpen: boolean
  onToggleTheme: () => void
  isLight: boolean
  onOpenHelp: () => void
  onToggleFilePanel: () => void
  onSelectCanvas: (index: number) => void
  selectedCanvasIndex: number
  onCloseLanguage: () => void
}

const SidebarLeft: React.FC<Props> = ({
  isOpen,
  onToggleTheme,
  isLight,
  onOpenHelp,
  onToggleFilePanel,
  onSelectCanvas,
  selectedCanvasIndex,
  onCloseLanguage
}) => {
  const [langOpen, setLangOpen] = useState(false)
  const [currentLang, setCurrentLang] = useState('Русский')

  useEffect(() => {
    if (!isOpen) {
      setLangOpen(false)
      onCloseLanguage()
    }
  }, [isOpen, onCloseLanguage])

  const setLanguage = (lang: string) => {
    setCurrentLang(lang === 'ru' ? 'Русский' : 'English')
    setLangOpen(false)
  }

  const handleThemeClick = () => {
    onToggleTheme()
    if (!isOpen) return
  }

  const canvasIcons = [
    '/icons/canvas-1.png',
    '/icons/canvas-2.png',
    '/icons/canvas-3.png',
    '/icons/canvas-4.png',
    '/icons/canvas-5.png'
  ]

  return (
    <div className={`sidebar-left ${isOpen ? 'is-open' : ''}`}>
      <ul>
        <li onClick={onToggleFilePanel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Файл</span>
          <span style={{ fontSize: '12px' }}>▶</span>
        </li>
        <li onClick={onOpenHelp}>Помощь</li>
        <li onClick={handleThemeClick} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Тема</span>
          <img src={isLight ? '/icons/sun.png' : '/icons/moon.png'} alt="Тема" style={{ width: '20px', height: '20px' }} />
        </li>
        <li style={{ position: 'relative', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px' }} onClick={() => setLangOpen(!langOpen)}>
          <span id="current-lang">{currentLang}</span>
          <span style={{ fontSize: '12px', fontWeight: '700' }}>▼</span>
          {langOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', zIndex: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
              <button onClick={() => setLanguage('ru')} style={{ padding: '8px 12px', textAlign: 'left', width: '100%', background: 'transparent', color: 'var(--text-color)', fontWeight: '400', borderBottom: '1px solid var(--border-color)' }}>Русский</button>
              <button onClick={() => setLanguage('en')} style={{ padding: '8px 12px', textAlign: 'left', width: '100%', background: 'transparent', color: 'var(--text-color)', fontWeight: '400' }}>English</button>
            </div>
          )}
        </li>
        <li className="sub-menu-item">
          Выбор полотна
          <ul>
            {canvasIcons.map((src, i) => (
              <li
                key={i}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  padding: 0,
                  cursor: 'pointer',
                  border: selectedCanvasIndex === i ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  boxSizing: 'border-box',
                  overflow: 'hidden'
                }}
                onClick={() => onSelectCanvas(i)}
              >
                <img src={src} alt={`Полотно ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </li>
            ))}
          </ul>
        </li>
      </ul>
    </div>
  )
}

export default SidebarLeft