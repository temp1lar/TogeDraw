import { useRef, useState, useEffect, useCallback } from 'react'
import { Stroke, ToolType, PenType, ShapeType, StrokePosition } from '../types'
import { boardHub } from '../services/signalR'

type ToolSettings = {
  color: string
  thickness: number
  strokeColor: string
  strokeThickness: number
  fillColor: string
  fillOpacity: number
  angle: number
  strokePosition: StrokePosition
  borderRadius: number
}

const defaultSettings: ToolSettings = {
  color: '#000000',
  thickness: 10,
  strokeColor: '#000000',
  strokeThickness: 0,
  fillColor: '#ffffff',
  fillOpacity: 1,
  angle: 0,
  strokePosition: 'outside',
  borderRadius: 0,
}

const initialToolSettings: Record<ToolType, ToolSettings> = {
  hand: { ...defaultSettings },
  pen: { ...defaultSettings, borderRadius: 360 },
  line: { ...defaultSettings },
  rect: { ...defaultSettings },
  circle: { ...defaultSettings },
  triangle: { ...defaultSettings },
  arrow: { ...defaultSettings },
  text: { ...defaultSettings },
  eraser: { ...defaultSettings, borderRadius: 360 },
  fill: { ...defaultSettings },
  trash: { ...defaultSettings },
  undo: { ...defaultSettings },
  redo: { ...defaultSettings },
}

export function useCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>, boardId?: string, currentUserId?: string) {
  const [strokes, setStrokes] = useState<Stroke[]>([])
  
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [tool, setTool] = useState<ToolType>('pen')
  const [penType, setPenType] = useState<PenType>('pencil')
  const [shapeType, setShapeType] = useState<ShapeType>('rect')
  const [toolSettings, setToolSettings] = useState<Record<ToolType, ToolSettings>>(initialToolSettings)

  const [color, setColor] = useState(defaultSettings.color)
  const [thickness, setThickness] = useState(defaultSettings.thickness)
  const [strokeColor, setStrokeColor] = useState(defaultSettings.strokeColor)
  const [strokeThickness, setStrokeThickness] = useState(defaultSettings.strokeThickness)
  const [fillColor, setFillColor] = useState(defaultSettings.fillColor)
  const [fillOpacity, setFillOpacity] = useState(defaultSettings.fillOpacity)
  const [angle, setAngle] = useState(defaultSettings.angle)
  const [strokePosition, setStrokePosition] = useState<StrokePosition>(defaultSettings.strokePosition)
  const [borderRadius, setBorderRadius] = useState(defaultSettings.borderRadius)

  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [redoStack, setRedoStack] = useState<Stroke[][]>([])

  const isDrawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef<{ x: number; y: number } | null>(null)

  const [undoCount, setUndoCount] = useState(0)
  const MAX_UNDO_COUNT = 3

  const applyToolSettings = useCallback((t: ToolType) => {
    const settings = toolSettings[t]
    setColor(settings.color)
    setThickness(settings.thickness)
    setStrokeColor(settings.strokeColor)
    setStrokeThickness(settings.strokeThickness)
    setFillColor(settings.fillColor)
    setFillOpacity(settings.fillOpacity)
    setAngle(settings.angle)
    setStrokePosition(settings.strokePosition)
    setBorderRadius(settings.borderRadius)
  }, [toolSettings])

  const updateToolSettings = useCallback((t: ToolType, updates: Partial<ToolSettings>) => {
    setToolSettings(prev => ({
      ...prev,
      [t]: { ...prev[t], ...updates }
    }))
  }, [])


  useEffect(() => {
    applyToolSettings(tool)
  }, [tool, applyToolSettings])

  const handleSetTool = useCallback((t: ToolType) => {
    setTool(t)
  }, [])

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX / zoom - panX,
      y: (e.clientY - rect.top) * scaleY / zoom - panY,
    }
  }, [panX, panY, zoom, canvasRef])

  const sendStrokeToServer = useCallback(async (stroke: Stroke) => {
  if (!boardId) {
    console.warn('No boardId provided, skipping server sync')
    return
  }

  try {
    if (stroke.type === 'pen' || stroke.type === 'eraser') {
      await boardHub.drawStroke(boardId, {
        elementId: stroke.id,
        points: stroke.points.map(p => ({
          x: p.x,
          y: p.y,
          pressure: 0.5,
          timestamp: Date.now()
        })),
        color: stroke.color,
        thickness: stroke.thickness,
      })
    } else if (['line', 'rect', 'circle', 'triangle', 'arrow'].includes(stroke.type)) {
  const start = stroke.start || stroke.points[0]
  const end = stroke.end || stroke.points[stroke.points.length - 1]
  
  const shapeTypeMap: Record<string, string> = {
    'line': 'Line',
    'rect': 'Rectangle',
    'circle': 'Ellipse',
    'triangle': 'Triangle',
    'arrow': 'Arrow'
  }
  
  await boardHub.createShape(boardId, {
    elementId: stroke.id,
    type: shapeTypeMap[stroke.type] || 'Rectangle',
    x: start.x, 
    y: start.y,
    width: end.x - start.x,
    height: end.y - start.y, 
    strokeColor: stroke.strokeColor || stroke.color,
    fillColor: stroke.fillColor,
    strokeWidth: stroke.strokeThickness || stroke.thickness,
  })
} else if (stroke.type === 'text') {
      console.log('Text event not implemented on backend yet')
    } else if (stroke.type === 'fill') {
      console.log('Fill event not implemented on backend yet')
    }
  } catch (err) {
    console.error('Failed to send stroke to server:', err)
  }
}, [boardId])

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'hand') {
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY }
      return
    }
    if (tool === 'text' || tool === 'fill') {
      return
    }
    if (tool === 'trash' || tool === 'undo' || tool === 'redo') return
    isDrawing.current = true
    const pos = getCanvasCoords(e)
    lastPoint.current = pos

    const actualType = tool === 'pen' ? 'pen' :
                       tool === 'eraser' ? 'eraser' :
                       tool === 'line' ? 'line' :
                       tool === 'arrow' ? 'arrow' :
                       tool === 'rect' ? 'rect' :
                       tool === 'circle' ? 'circle' :
                       tool === 'triangle' ? 'triangle' : 'pen'

    const newStroke: Stroke = {
      id: crypto.randomUUID(),
      userId: currentUserId,
      type: actualType,
      points: [pos],
      color: tool === 'eraser' ? '#ffffff' : color,
      thickness: thickness,
      start: pos,
      end: pos,
      strokeColor: strokeColor,
      strokeThickness: strokeThickness,
      strokePosition: strokePosition,
      angle: angle,
      penType: tool === 'pen' ? penType : undefined,
      fillColor: fillColor,
      fillOpacity: fillOpacity,
      borderRadius: borderRadius,
    }
    setCurrentStroke(newStroke)
  }, [tool, color, thickness, strokeColor, strokeThickness, strokePosition, angle, penType, fillColor, fillOpacity, borderRadius, getCanvasCoords, currentUserId])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'hand' && isPanning.current && panStart.current) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        setPanX(prev => prev + dx * scaleX / zoom)
        setPanY(prev => prev + dy * scaleY / zoom)
      }
      panStart.current = { x: e.clientX, y: e.clientY }
      return
    }
    if (!isDrawing.current || !currentStroke) return
    const pos = getCanvasCoords(e)

    let endPos = pos
    if (e.shiftKey) {
      const start = currentStroke.start!
      const dx = pos.x - start.x
      const dy = pos.y - start.y
      if (tool === 'rect') {
        const size = Math.max(Math.abs(dx), Math.abs(dy))
        endPos = {
          x: start.x + Math.sign(dx) * size,
          y: start.y + Math.sign(dy) * size,
        }
      } else if (tool === 'circle') {
        const r = Math.max(Math.abs(dx), Math.abs(dy))
        endPos = {
          x: start.x + Math.sign(dx) * r,
          y: start.y + Math.sign(dy) * r,
        }
      } else if (tool === 'triangle') {
        const base = Math.abs(dx)
        const height = base * Math.sqrt(3) / 2
        const signY = Math.sign(dy)
        endPos = {
          x: pos.x,
          y: start.y + signY * height,
        }
      }
    }

    setCurrentStroke(prev => {
      if (!prev) return null
      const newPoints = [...prev.points, endPos]
      return { ...prev, points: newPoints, end: endPos }
    })
  }, [currentStroke, getCanvasCoords, tool, canvasRef, zoom])

  const stopDrawing = useCallback(() => {
  if (tool === 'hand') {
    isPanning.current = false
    panStart.current = null
    return
  }
  if (isDrawing.current && currentStroke) {
    setStrokes(prev => [...prev, currentStroke])
    sendStrokeToServer(currentStroke)
    setRedoStack([])
    setUndoCount(0)
    setCurrentStroke(null)
  }
  isDrawing.current = false
  lastPoint.current = null
}, [currentStroke, sendStrokeToServer, tool, boardId])

  const floodFill = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, fillColor: string) => {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    const data = imageData.data
    const width = imageData.width
    const height = imageData.height

    const targetColor = ctx.getImageData(x, y, 1, 1).data
    const targetR = targetColor[0]
    const targetG = targetColor[1]
    const targetB = targetColor[2]
    const targetA = targetColor[3]

    const fillR = parseInt(fillColor.slice(1, 3), 16)
    const fillG = parseInt(fillColor.slice(3, 5), 16)
    const fillB = parseInt(fillColor.slice(5, 7), 16)
    const fillA = 255

    if (targetR === fillR && targetG === fillG && targetB === fillB) return

    const stack: [number, number][] = [[x, y]]
    const visited = new Set<number>()

    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!
      const index = (cy * width + cx) * 4
      if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue
      const key = cy * width + cx
      if (visited.has(key)) continue

      const r = data[index]
      const g = data[index + 1]
      const b = data[index + 2]
      const a = data[index + 3]

      if (r !== targetR || g !== targetG || b !== targetB || a !== targetA) continue

      visited.add(key)

      data[index] = fillR
      data[index + 1] = fillG
      data[index + 2] = fillB
      data[index + 3] = fillA

      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
    }

    ctx.putImageData(imageData, 0, 0)
  }, [])

  const applyFill = useCallback((x: number, y: number) => {
  const canvas = canvasRef.current
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const newStroke: Stroke = {
    id: crypto.randomUUID(),
    userId: currentUserId,
    type: 'fill',
    points: [{ x, y }],
    color: color,
    thickness: 0,
    start: { x, y },
    end: { x, y },
  }
  setStrokes(prev => [...prev, newStroke])
  sendStrokeToServer(newStroke)
  setRedoStack([])
}, [color, canvasRef, sendStrokeToServer, boardId, currentUserId])

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(panX, panY)

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes

    const nonFillStrokes = allStrokes.filter(s => s.type !== 'fill')
    for (const stroke of nonFillStrokes) {
      if (stroke.type === 'text' && stroke.text) {
        ctx.font = `${stroke.fontSize || 20}px sans-serif`
        ctx.fillStyle = stroke.color
        ctx.fillText(stroke.text, stroke.start?.x || 0, stroke.start?.y || 0)
        if (stroke.strokeThickness && stroke.strokeThickness > 0) {
          ctx.strokeStyle = stroke.strokeColor || '#000000'
          ctx.lineWidth = stroke.strokeThickness
          ctx.strokeText(stroke.text, stroke.start?.x || 0, stroke.start?.y || 0)
        }
        continue
      }

      if (stroke.type === 'pen') {
        ctx.beginPath()
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.thickness
        ctx.lineCap = (stroke.borderRadius || 0) > 0 ? 'round' : 'butt'
        ctx.lineJoin = 'round'
        if (stroke.penType === 'chalk') {
          for (let i = 0; i < stroke.points.length - 1; i++) {
            const p1 = stroke.points[i]
            const p2 = stroke.points[i+1]
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
            const steps = Math.max(1, Math.floor(dist / 2))
            for (let s = 0; s < steps; s++) {
              const t = s / steps
              const x = p1.x + (p2.x - p1.x) * t + (Math.random() - 0.5) * 4
              const y = p1.y + (p2.y - p1.y) * t + (Math.random() - 0.5) * 4
              const radius = stroke.thickness * (0.2 + Math.random() * 0.6)
              ctx.beginPath()
              ctx.arc(x, y, radius, 0, Math.PI * 2)
              ctx.fillStyle = stroke.color
              ctx.globalAlpha = 0.6 + Math.random() * 0.4
              ctx.fill()
            }
          }
          ctx.globalAlpha = 1.0
          continue
        } else if (stroke.penType === 'pen') {
          if (stroke.points.length < 2) continue
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
          for (let i = 1; i < stroke.points.length - 1; i++) {
            const midX = (stroke.points[i].x + stroke.points[i+1].x) / 2
            const midY = (stroke.points[i].y + stroke.points[i+1].y) / 2
            ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY)
          }
          ctx.stroke()
          continue
        } else {
          if (stroke.points.length < 2) continue
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
          }
          ctx.stroke()
          continue
        }
      }

      if (stroke.type === 'eraser') {
        if (stroke.points.length < 2) continue
        ctx.beginPath()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = stroke.thickness
        ctx.lineCap = (stroke.borderRadius || 0) > 0 ? 'round' : 'butt'
        ctx.lineJoin = 'round'
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
        }
        ctx.stroke()
        continue
      }

      const start = stroke.start
      const end = stroke.end
      if (!start || !end) continue

      const drawShape = (drawFn: () => void) => {
        if (stroke.angle && stroke.angle !== 0) {
          const cx = (start.x + end.x) / 2
          const cy = (start.y + end.y) / 2
          ctx.save()
          ctx.translate(cx, cy)
          ctx.rotate((stroke.angle || 0) * Math.PI / 180)
          ctx.translate(-cx, -cy)
          drawFn()
          ctx.restore()
        } else {
          drawFn()
        }
      }

      const getStrokeOffset = () => {
        if (!stroke.strokePosition || stroke.strokePosition === 'center') return 0
        const half = (stroke.strokeThickness || 0) / 2
        return stroke.strokePosition === 'outside' ? half : -half
      }

      const useRoundCap = (stroke.borderRadius || 0) > 0

      if (stroke.type === 'line') {
        drawShape(() => {
          ctx.beginPath()
          ctx.strokeStyle = stroke.color
          ctx.lineWidth = stroke.thickness
          ctx.lineCap = useRoundCap ? 'round' : 'butt'
          ctx.moveTo(start.x, start.y)
          ctx.lineTo(end.x, end.y)
          ctx.stroke()
        })
      } else if (stroke.type === 'arrow') {
      drawShape(() => {
    ctx.beginPath()
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.thickness
    ctx.lineCap = useRoundCap ? 'round' : 'butt'
    
    const dx = end.x - start.x
    const dy = end.y - start.y
    const len = Math.hypot(dx, dy)
    if (len < 10) return
    
    const angle = Math.atan2(dy, dx)
    const headLen = Math.min(30, len * 0.45)
    const headAngle = 0.3
    
    // Рисуем линию от start к end
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    
    // Рисуем наконечник стрелки
    ctx.beginPath()
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(
      end.x - headLen * Math.cos(angle - headAngle),
      end.y - headLen * Math.sin(angle - headAngle)
    )
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(
      end.x - headLen * Math.cos(angle + headAngle),
      end.y - headLen * Math.sin(angle + headAngle)
    )
    ctx.stroke()
      })
      } else if (stroke.type === 'rect') {
        drawShape(() => {
          const offset = getStrokeOffset()
          const x = Math.min(start.x, end.x) - offset
          const y = Math.min(start.y, end.y) - offset
          const w = Math.abs(end.x - start.x) + offset * 2
          const h = Math.abs(end.y - start.y) + offset * 2
          const radius = stroke.borderRadius || 0

          if (stroke.fillColor && stroke.fillColor !== 'transparent') {
            ctx.fillStyle = stroke.fillColor
            if (stroke.fillOpacity !== undefined && stroke.fillOpacity < 1) {
              ctx.globalAlpha = stroke.fillOpacity
            }
            if (radius > 0) {
              ctx.beginPath()
              ctx.moveTo(x + radius, y)
              ctx.lineTo(x + w - radius, y)
              ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
              ctx.lineTo(x + w, y + h - radius)
              ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
              ctx.lineTo(x + radius, y + h)
              ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
              ctx.lineTo(x, y + radius)
              ctx.quadraticCurveTo(x, y, x + radius, y)
              ctx.closePath()
              ctx.fill()
            } else {
              ctx.fillRect(x, y, w, h)
            }
            ctx.globalAlpha = 1
          }

          ctx.beginPath()
          ctx.strokeStyle = stroke.color
          ctx.lineWidth = stroke.thickness
          if (radius > 0) {
            ctx.moveTo(x + radius, y)
            ctx.lineTo(x + w - radius, y)
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
            ctx.lineTo(x + w, y + h - radius)
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
            ctx.lineTo(x + radius, y + h)
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
            ctx.lineTo(x, y + radius)
            ctx.quadraticCurveTo(x, y, x + radius, y)
            ctx.closePath()
            ctx.stroke()
          } else {
            ctx.strokeRect(x, y, w, h)
          }

          if (stroke.strokeThickness && stroke.strokeThickness > 0) {
            ctx.save()
            ctx.strokeStyle = stroke.strokeColor || '#000000'
            ctx.lineWidth = stroke.strokeThickness
            const off = stroke.strokeThickness / 2
            let x1 = x, y1 = y, w1 = w, h1 = h
            if (stroke.strokePosition === 'outside') {
              x1 -= off; y1 -= off; w1 += off*2; h1 += off*2
            } else if (stroke.strokePosition === 'inside') {
              x1 += off; y1 += off; w1 -= off*2; h1 -= off*2
            }
            if (radius > 0) {
              const r2 = Math.max(0, radius - (stroke.strokeThickness/2))
              ctx.beginPath()
              ctx.moveTo(x1 + r2, y1)
              ctx.lineTo(x1 + w1 - r2, y1)
              ctx.quadraticCurveTo(x1 + w1, y1, x1 + w1, y1 + r2)
              ctx.lineTo(x1 + w1, y1 + h1 - r2)
              ctx.quadraticCurveTo(x1 + w1, y1 + h1, x1 + w1 - r2, y1 + h1)
              ctx.lineTo(x1 + r2, y1 + h1)
              ctx.quadraticCurveTo(x1, y1 + h1, x1, y1 + h1 - r2)
              ctx.lineTo(x1, y1 + r2)
              ctx.quadraticCurveTo(x1, y1, x1 + r2, y1)
              ctx.closePath()
              ctx.stroke()
            } else {
              ctx.strokeRect(x1, y1, w1, h1)
            }
            ctx.restore()
          }
        })
      } else if (stroke.type === 'circle') {
        drawShape(() => {
          const cx = (start.x + end.x) / 2
          const cy = (start.y + end.y) / 2
          const rx = Math.abs(end.x - start.x) / 2
          const ry = Math.abs(end.y - start.y) / 2
          const offset = getStrokeOffset()
          const rX = rx + offset
          const rY = ry + offset

          if (stroke.fillColor && stroke.fillColor !== 'transparent') {
            ctx.fillStyle = stroke.fillColor
            if (stroke.fillOpacity !== undefined && stroke.fillOpacity < 1) {
              ctx.globalAlpha = stroke.fillOpacity
            }
            ctx.beginPath()
            ctx.ellipse(cx, cy, rX, rY, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.globalAlpha = 1
          }

          ctx.beginPath()
          ctx.strokeStyle = stroke.color
          ctx.lineWidth = stroke.thickness
          ctx.ellipse(cx, cy, rX, rY, 0, 0, Math.PI * 2)
          ctx.stroke()

          if (stroke.strokeThickness && stroke.strokeThickness > 0) {
            ctx.save()
            ctx.strokeStyle = stroke.strokeColor || '#000000'
            ctx.lineWidth = stroke.strokeThickness
            let offX = 0, offY = 0
            if (stroke.strokePosition === 'outside') {
              offX = stroke.strokeThickness / 2
              offY = stroke.strokeThickness / 2
            } else if (stroke.strokePosition === 'inside') {
              offX = -stroke.strokeThickness / 2
              offY = -stroke.strokeThickness / 2
            }
            ctx.beginPath()
            ctx.ellipse(cx, cy, rX + offX, rY + offY, 0, 0, Math.PI * 2)
            ctx.stroke()
            ctx.restore()
          }
        })
      } else if (stroke.type === 'triangle') {
        drawShape(() => {
          const offset = getStrokeOffset()
          const x1 = start.x - offset
          const y1 = end.y + offset
          const x2 = end.x + offset
          const y2 = end.y + offset
          const x3 = (start.x + end.x) / 2
          const y3 = start.y - offset

          const radius = stroke.borderRadius || 0
          const useRoundJoin = radius > 0

          if (stroke.fillColor && stroke.fillColor !== 'transparent') {
            ctx.fillStyle = stroke.fillColor
            if (stroke.fillOpacity !== undefined && stroke.fillOpacity < 1) {
              ctx.globalAlpha = stroke.fillOpacity
            }
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.lineTo(x3, y3)
            ctx.closePath()
            ctx.fill()
            ctx.globalAlpha = 1
          }

          ctx.beginPath()
          ctx.strokeStyle = stroke.color
          ctx.lineWidth = stroke.thickness
          ctx.lineJoin = useRoundJoin ? 'round' : 'miter'
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.lineTo(x3, y3)
          ctx.closePath()
          ctx.stroke()

          if (stroke.strokeThickness && stroke.strokeThickness > 0) {
            ctx.save()
            ctx.strokeStyle = stroke.strokeColor || '#000000'
            ctx.lineWidth = stroke.strokeThickness
            ctx.lineJoin = useRoundJoin ? 'round' : 'miter'
            const off = stroke.strokeThickness / 2
            let x1o, y1o, x2o, y2o, x3o, y3o
            if (stroke.strokePosition === 'outside') {
              x1o = x1 - off; y1o = y1 + off
              x2o = x2 + off; y2o = y2 + off
              x3o = x3; y3o = y3 - off
            } else if (stroke.strokePosition === 'inside') {
              x1o = x1 + off; y1o = y1 - off
              x2o = x2 - off; y2o = y2 - off
              x3o = x3; y3o = y3 + off
            } else {
              x1o = x1; y1o = y1
              x2o = x2; y2o = y2
              x3o = x3; y3o = y3
            }
            ctx.beginPath()
            ctx.moveTo(x1o, y1o)
            ctx.lineTo(x2o, y2o)
            ctx.lineTo(x3o, y3o)
            ctx.closePath()
            ctx.stroke()
            ctx.restore()
          }
        })
      }
    }

    const fillStrokes = allStrokes.filter(s => s.type === 'fill')
    for (const stroke of fillStrokes) {
      if (stroke.start) {
        const canvasX = Math.round(stroke.start.x)
        const canvasY = Math.round(stroke.start.y)
        floodFill(ctx, canvasX, canvasY, stroke.color)
      }
    }

    ctx.restore()
  }, [strokes, currentStroke, panX, panY, canvasRef, floodFill])

  useEffect(() => {
    renderCanvas()
  }, [renderCanvas])

  const clearCanvas = () => {
    setStrokes([])
    setRedoStack([])
    setUndoCount(0)
  }

  const undo = useCallback(async () => {
  if (undoCount >= MAX_UNDO_COUNT) {
    console.warn('Undo limit reached')
    return
  }
  
  if (!boardId) {
    // Fallback на локальный undo
    if (strokes.length === 0) return
    setRedoStack(prev => [...prev, strokes])
    setStrokes(prev => prev.slice(0, -1))
    setUndoCount(prev => prev + 1)
    return
  }
  
  try {
    await boardHub.undoLastAction(boardId)
    setUndoCount(prev => prev + 1)
    // Удаление произойдёт через событие ActionUndone от сервера
  } catch (err) {
    console.error('Failed to undo:', err)
  }
}, [boardId, strokes, undoCount])

const redo = useCallback(async () => {
  // TODO: redo сложнее — нужно хранить историю отменённых действий
  // Пока сбрасываем счётчик undo
  setUndoCount(0)
  console.warn('Redo not implemented yet')
}, [])

  const updateZoom = (delta: number) => {
    const newZoom = Math.min(Math.max(zoom + delta, 0.05), 2)
    setZoom(newZoom)
  }

  const handleSetColor = (c: string) => {
    setColor(c)
    updateToolSettings(tool, { color: c })
  }

  const handleSetThickness = (t: number) => {
    setThickness(t)
    updateToolSettings(tool, { thickness: t })
  }

  const handleSetStrokeColor = (c: string) => {
    setStrokeColor(c)
    updateToolSettings(tool, { strokeColor: c })
  }

  const handleSetStrokeThickness = (t: number) => {
    setStrokeThickness(t)
    updateToolSettings(tool, { strokeThickness: t })
  }

  const handleSetFillColor = (c: string) => {
    setFillColor(c)
    updateToolSettings(tool, { fillColor: c })
  }

  const handleSetFillOpacity = (o: number) => {
    setFillOpacity(o)
    updateToolSettings(tool, { fillOpacity: o })
  }

  const handleSetAngle = (a: number) => {
    setAngle(a)
    updateToolSettings(tool, { angle: a })
  }

  const handleSetStrokePosition = (p: StrokePosition) => {
    setStrokePosition(p)
    updateToolSettings(tool, { strokePosition: p })
  }

  const handleSetBorderRadius = (r: number) => {
    setBorderRadius(r)
    updateToolSettings(tool, { borderRadius: r })
  }

  useEffect(() => {
  const canvas = canvasRef.current
  if (!canvas) return

  const getTouchPos = (e: TouchEvent) => {
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    return {
      x: (touch.clientX - rect.left - panX) / zoom,
      y: (touch.clientY - rect.top - panY) / zoom,
    }
  }

  const handleTouchStart = (e: TouchEvent) => {
    e.preventDefault() // Предотвращаем скролл
    const pos = getTouchPos(e)
    // Эмулируем mousedown
    startDrawing({ clientX: pos.x, clientY: pos.y } as any)
  }

  const handleTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    const pos = getTouchPos(e)
    draw({ clientX: pos.x, clientY: pos.y } as any)
  }

  const handleTouchEnd = (e: TouchEvent) => {
    e.preventDefault()
    stopDrawing()
  }

  canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
  canvas.addEventListener('touchend', handleTouchEnd, { passive: false })

  return () => {
    canvas.removeEventListener('touchstart', handleTouchStart)
    canvas.removeEventListener('touchmove', handleTouchMove)
    canvas.removeEventListener('touchend', handleTouchEnd)
  }
}, [zoom, panX, panY, startDrawing, draw, stopDrawing])


  return {
    strokes,
    setStrokes,
    currentStroke,
    tool,
    setTool: handleSetTool,
    penType,
    setPenType,
    shapeType,
    setShapeType,
    color,
    setColor: handleSetColor,
    thickness,
    setThickness: handleSetThickness,
    strokeColor,
    setStrokeColor: handleSetStrokeColor,
    strokeThickness,
    setStrokeThickness: handleSetStrokeThickness,
    fillColor,
    setFillColor: handleSetFillColor,
    fillOpacity,
    setFillOpacity: handleSetFillOpacity,
    angle,
    setAngle: handleSetAngle,
    strokePosition,
    setStrokePosition: handleSetStrokePosition,
    borderRadius,
    setBorderRadius: handleSetBorderRadius,
    zoom,
    updateZoom,
    panX,
    panY,
    setPan: (x: number, y: number) => { setPanX(x); setPanY(y) },
    startDrawing,
    draw,
    stopDrawing,
    clearCanvas,
    undoCount,
    setUndoCount,
    MAX_UNDO_COUNT,
    undo,
    redo,
    renderCanvas,
    getCanvasCoords,
    applyFill,
  }
}