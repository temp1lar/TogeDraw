import React from 'react'
import { ToolType, StrokePosition } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  tool: ToolType
  color: string
  setColor: (c: string) => void
  thickness: number
  setThickness: (t: number) => void
  strokeColor: string
  setStrokeColor: (c: string) => void
  strokeThickness: number
  setStrokeThickness: (t: number) => void
  fillColor: string
  setFillColor: (c: string) => void
  fillOpacity: number
  setFillOpacity: (o: number) => void
  angle: number
  setAngle: (a: number) => void
  strokePosition: StrokePosition
  setStrokePosition: (p: StrokePosition) => void
  borderRadius: number
  setBorderRadius: (r: number) => void
}

const ToolSettingsModal: React.FC<Props> = ({
  isOpen, onClose, tool,
  color, setColor,
  thickness, setThickness,
  strokeColor, setStrokeColor,
  strokeThickness, setStrokeThickness,
  fillColor, setFillColor,
  fillOpacity, setFillOpacity,
  angle, setAngle,
  strokePosition, setStrokePosition,
  borderRadius, setBorderRadius
}) => {
  if (!isOpen) return null

  const isEraser = tool === 'eraser'
  const isPen = tool === 'pen'
  const isFill = tool === 'fill'
  const isShape = ['line', 'arrow', 'rect', 'circle', 'triangle'].includes(tool)
  const isText = tool === 'text'
  const showStrokeOptions = isShape || isText
  const showAngle = !isEraser && !isPen && !isFill
  const showBorderRadius = tool === 'pen' || tool === 'eraser' || (isShape && tool !== 'circle')

  if (isFill) {
    return (
      <div className="tool-settings-modal active">
        <button className="close-btn" onClick={onClose}>✕</button>
        <h4 style={{ marginBottom: '15px', fontWeight: '700' }}>Заливка</h4>
        <div className="setting-group" id="color-group">
          <label>Цвет:</label>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} />
        </div>
      </div>
    )
  }

  const handleThicknessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThickness(Number(e.target.value))
  }

  const handleThicknessInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    if (!isNaN(val) && val >= 0) setThickness(val)
  }

  const handleStrokeThicknessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStrokeThickness(Number(e.target.value))
  }

  const handleStrokeThicknessInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    if (!isNaN(val) && val >= 0) setStrokeThickness(val)
  }

  const handleAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAngle(Number(e.target.value))
  }

  const handleStrokePositionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStrokePosition(e.target.value as StrokePosition)
  }

  const handleFillOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFillOpacity(Number(e.target.value))
  }

  const handleFillOpacityInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    if (!isNaN(val) && val >= 0 && val <= 1) setFillOpacity(val)
  }

  const handleBorderRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBorderRadius(Number(e.target.value))
  }

  const handleBorderRadiusInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    if (!isNaN(val) && val >= 0) setBorderRadius(val)
  }

  return (
    <div className="tool-settings-modal active">
      <button className="close-btn" onClick={onClose}>✕</button>
      <h4 style={{ marginBottom: '15px', fontWeight: '700' }}>Инструмент</h4>

      <div className="setting-group" id="thickness-group">
        <label>Размер: <span id="thickness-val">{thickness}</span></label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="range" min="0" max="1000" value={thickness} onChange={handleThicknessChange} style={{ flex: 1 }} />
          <input type="number" min="0" max="1000" value={thickness} onChange={handleThicknessInput} style={{ width: '70px', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-color)' }} />
        </div>
        <div className="range-labels"><span>0</span><span>1000</span></div>
      </div>

      {!isEraser && (
        <div className="setting-group" id="color-group">
          <label>Цвет:</label>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} />
        </div>
      )}

      {isShape && (
        <>
          <div className="setting-group" id="fill-color-group">
            <label>Цвет заливки:</label>
            <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)} />
          </div>
          <div className="setting-group" id="fill-opacity-group">
            <label>Прозрачность заливки: <span id="fill-opacity-val">{Math.round(fillOpacity * 100)}%</span></label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="range" min="0" max="1" step="0.01" value={fillOpacity} onChange={handleFillOpacityChange} style={{ flex: 1 }} />
              <input type="number" min="0" max="1" step="0.01" value={fillOpacity} onChange={handleFillOpacityInput} style={{ width: '70px', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-color)' }} />
            </div>
          </div>
        </>
      )}

      {showStrokeOptions && (
        <>
          <div className="setting-group" id="stroke-color-group">
            <label>Цвет обводки:</label>
            <input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} />
          </div>

          <div className="setting-group" id="stroke-position-group">
            <label>Тип обводки:</label>
            <select value={strokePosition} onChange={handleStrokePositionChange} style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-color)', fontSize: '14px' }}>
              <option value="outside">Снаружи</option>
              <option value="inside">Внутри</option>
              <option value="center">По центру</option>
            </select>
          </div>

          <div className="setting-group" id="stroke-thickness-group">
            <label>Толщина обводки: <span id="stroke-val">{strokeThickness}</span></label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="range" min="0" max="100" value={strokeThickness} onChange={handleStrokeThicknessChange} style={{ flex: 1 }} />
              <input type="number" min="0" max="100" value={strokeThickness} onChange={handleStrokeThicknessInput} style={{ width: '70px', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-color)' }} />
            </div>
            <div className="range-labels"><span>0</span><span>100</span></div>
          </div>
        </>
      )}

      {showBorderRadius && (
        <div className="setting-group" id="border-radius-group">
          <label>Скругление: <span id="border-radius-val">{borderRadius}</span></label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="range" min="0" max="360" value={borderRadius} onChange={handleBorderRadiusChange} style={{ flex: 1 }} />
            <input type="number" min="0" max="360" value={borderRadius} onChange={handleBorderRadiusInput} style={{ width: '70px', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-color)' }} />
          </div>
          <div className="range-labels"><span>0</span><span>360</span></div>
        </div>
      )}

      {showAngle && (
        <div className="setting-group" id="angle-group">
          <label>Угол:</label>
          <input type="number" value={angle} min="0" max="360" onChange={handleAngleChange} />
        </div>
      )}
    </div>
  )
}

export default ToolSettingsModal