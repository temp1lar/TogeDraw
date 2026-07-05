import React, { useState } from 'react'
import { ToolType, PenType, ShapeType } from '../types'

interface Props {
  isOpen: boolean
  tool: ToolType
  penType: PenType
  shapeType: ShapeType
  brushType: 'pencil' | 'pen' | 'chalk' | 'fill'
  onToolChange: (tool: ToolType) => void
  onPenTypeChange: (type: PenType) => void
  onShapeTypeChange: (type: ShapeType) => void
  onBrushSelect: (type: 'pencil' | 'pen' | 'chalk' | 'fill') => void
  onOpenSettings: () => void
  onCloseSettings: () => void
  onToggleSettings: () => void
  isOwner?: boolean
  onClear: () => void
  onUndo: () => void
  onRedo: () => void
  onToolSelect: (name: string) => void
  undoCount?: number
  maxUndoCount?: number 
}

const Toolbar: React.FC<Props> = ({
  isOpen,
  tool, penType, shapeType, brushType,
  onToolChange, onPenTypeChange, onShapeTypeChange,
  onBrushSelect,
  onOpenSettings, onCloseSettings, onToggleSettings,
  onUndo, onRedo, onClear, onToolSelect, isOwner
}) => {
  const [penSubmenuOpen, setPenSubmenuOpen] = useState(false)
  const [shapeSubmenuOpen, setShapeSubmenuOpen] = useState(false)

  const togglePenMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPenSubmenuOpen(!penSubmenuOpen)
    setShapeSubmenuOpen(false)
  }

  const toggleShapeMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShapeSubmenuOpen(!shapeSubmenuOpen)
    setPenSubmenuOpen(false)
  }

  const selectPenType = (type: PenType, name: string) => {
    onPenTypeChange(type)
    onBrushSelect(type)
    onToolChange('pen')
    onToolSelect(name)
    setPenSubmenuOpen(false)
  }

  const selectShapeType = (type: ShapeType, name: string) => {
    onShapeTypeChange(type)
    onToolChange(type as ToolType)
    onToolSelect(name)
    setShapeSubmenuOpen(false)
  }

  const handleToolClick = (type: ToolType) => {
    const isSettingsTool = ['pen', 'line', 'rect', 'circle', 'triangle', 'arrow', 'text', 'eraser', 'fill'].includes(type)
    if (isSettingsTool) {
      if (tool === type) {
        onToggleSettings()
      } else {
        onToolChange(type)
        onOpenSettings()
      }
    } else {
      onToolChange(type)
      onCloseSettings()
    }
    setPenSubmenuOpen(false)
    setShapeSubmenuOpen(false)
  }

  const handleBrushButtonClick = () => {
    if (brushType === 'fill') {
      if (tool === 'fill') {
        onToggleSettings()
      } else {
        onToolChange('fill')
        onOpenSettings()
      }
    } else {
      const newPenType = brushType as PenType
      onPenTypeChange(newPenType)
      if (tool === 'pen' && penType === newPenType) {
        onToggleSettings()
      } else {
        onToolChange('pen')
        onOpenSettings()
      }
    }
    setPenSubmenuOpen(false)
    setShapeSubmenuOpen(false)
  }

  const getShapeIcon = () => {
    if (shapeType === 'line') return '/icons/line.png'
    if (shapeType === 'arrow') return '/icons/arrow.png'
    if (shapeType === 'rect') return '/icons/rect.png'
    if (shapeType === 'circle') return '/icons/circle.png'
    if (shapeType === 'triangle') return '/icons/triangle.png'
    return '/icons/rect.png'
  }

  const getBrushIcon = () => {
    if (brushType === 'pencil') return '/icons/pencil.png'
    if (brushType === 'pen') return '/icons/pen.png'
    if (brushType === 'chalk') return '/icons/chalk.png'
    if (brushType === 'fill') return '/icons/fill.png'
    return '/icons/pencil.png'
  }

  return (
    <div className={`toolbar ${isOpen ? 'active' : ''}`}>
      <button className="tool-icon" onClick={() => handleToolClick('hand')} style={{ background: tool === 'hand' ? 'var(--hover-bg)' : '' }} title="Рука">
        <img src="/icons/hand.png" alt="Рука" className="tool-icon-img" />
        <span className="number">1</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <button className="tool-icon" onClick={handleBrushButtonClick} style={{ background: (tool === 'pen' || tool === 'fill') ? 'var(--hover-bg)' : '' }} title="Кисти">
          <img src={getBrushIcon()} alt="Кисти" className="tool-icon-img" />
          <span className="number">2</span>
        </button>
        <div className="tool-arrow-box" onClick={togglePenMenu}>
          <span>▼</span>
        </div>
        <div className={`tool-submenu ${penSubmenuOpen ? 'active' : ''}`}>
          <button onClick={() => selectPenType('pencil', 'Карандаш')}>Карандаш</button>
          <button onClick={() => selectPenType('pen', 'Перо')}>Перо</button>
          <button onClick={() => selectPenType('chalk', 'Мелок')}>Мелок</button>
          <button onClick={() => {
            onBrushSelect('fill')
            onToolChange('fill')
            onToolSelect('Заливка')
            onOpenSettings()
            setPenSubmenuOpen(false)
          }}>Заливка</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <button className="tool-icon" onClick={() => handleToolClick(shapeType as ToolType)} style={{ background: ['line','rect','circle','triangle','arrow'].includes(tool) ? 'var(--hover-bg)' : '' }} title="Фигуры">
          <img src={getShapeIcon()} alt="Фигуры" className="tool-icon-img" />
          <span className="number">3</span>
        </button>
        <div className="tool-arrow-box" onClick={toggleShapeMenu}>
          <span>▼</span>
        </div>
        <div className={`tool-submenu ${shapeSubmenuOpen ? 'active' : ''}`}>
          <button onClick={() => selectShapeType('line', 'Линия')}>Линия</button>
          <button onClick={() => selectShapeType('arrow', 'Стрелка')}>Стрелка</button>
          <button onClick={() => selectShapeType('rect', 'Прямоугольник')}>Прямоугольник</button>
          <button onClick={() => selectShapeType('circle', 'Круг')}>Круг</button>
          <button onClick={() => selectShapeType('triangle', 'Треугольник')}>Треугольник</button>
        </div>
      </div>

      <button className="tool-icon" onClick={() => handleToolClick('text')} title="Текст">
        <img src="/icons/text.png" alt="Текст" className="tool-icon-img" />
        <span className="number">4</span>
      </button>
      <button className="tool-icon" onClick={() => handleToolClick('eraser')} title="Ластик">
        <img src="/icons/eraser.png" alt="Ластик" className="tool-icon-img" />
        <span className="number">5</span>
      </button>

      <button className="tool-icon" onClick={onClear} disabled={!isOwner} title={isOwner ? 'Очистить' : 'Только владельцу'} style={{ opacity: isOwner ? 1 : 0.5 }}>
        <img src="/icons/trash.png" alt="Очистить" className="tool-icon-img" />
        <span className="number">6</span>
      </button>
      <button className="tool-icon" onClick={onUndo} title="Отменить">
        <img src="/icons/undo.png" alt="Отменить" className="tool-icon-img" />
        <span className="number">7</span>
      </button>
      <button className="tool-icon" onClick={onRedo} title="Повторить">
        <img src="/icons/redo.png" alt="Повторить" className="tool-icon-img" />
        <span className="number">8</span>
      </button>
    </div>
  )
}

export default Toolbar