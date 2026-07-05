import React from 'react'

interface Props {
  zoom: number
  onZoom: (delta: number) => void
}

const ZoomControls: React.FC<Props> = ({ zoom, onZoom }) => {
  const percent = Math.round(zoom * 100)
  return (
    <div className="zoom-controls-wrapper">
      <button onClick={() => onZoom(-0.05)} title="Уменьшить масштаб" style={{ position: 'relative' }}>
        -
        <span className="zoom-key-hint">9</span>
      </button>
      <span style={{ fontWeight: '700', width: '50px', textAlign: 'center', color: 'var(--text-color)' }}>{percent}%</span>
      <button onClick={() => onZoom(0.05)} title="Увеличить масштаб" style={{ position: 'relative' }}>
        +
        <span className="zoom-key-hint">0</span>
      </button>
    </div>
  )
}

export default ZoomControls