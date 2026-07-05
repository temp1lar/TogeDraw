import React, { useRef, useState, useEffect } from 'react'
import { Room, ToolType, Stroke, PenType } from '../types'
import { useTheme } from '../hooks/useTheme'
import { useCanvas } from '../hooks/useCanvas'
import SidebarLeft from './SidebarLeft'
import SidebarRight from './SidebarRight'
import ZoomControls from './ZoomControls'
import Toolbar from './Toolbar'
import ToolSettingsModal from './ToolSettingsModal'
import Toast from './Toast'
import Modal from './Modal'
import { boardHub } from '../services/signalR'
//import type { BoardEvent } from '../types'
import { authApi } from '../services/api'
import { accessApi } from '../services/api'
import InviteModal from './InviteModal'
import type { BoardMember } from '../types'

interface Props {
  room: Room
  onExit: () => void
  onUpdateRoom: (room: Room) => void
}

const CanvasScreen: React.FC<Props> = ({ room, onExit, onUpdateRoom }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [roomName, setRoomName] = useState(room.name)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showKickModal, setShowKickModal] = useState(false)
  const [showBanModal, setShowBanModal] = useState(false)
  const [showCrownModal, setShowCrownModal] = useState(false)
  const [sidebarLeftOpen, setSidebarLeftOpen] = useState(false)
  const [filePanelOpen, setFilePanelOpen] = useState(false)
  const [toolSettingsOpen, setToolSettingsOpen] = useState(false)
  const [isToolbarOpen, setIsToolbarOpen] = useState(false)
  const [selectedCanvasIndex, setSelectedCanvasIndex] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [sidebarRightOpen, setSidebarRightOpen] = useState(false)
  const [textPos, setTextPos] = useState({ x: 0, y: 0 })
  const [textValue, setTextValue] = useState('')
//  const [inviteLink, setInviteLink] = useState('')
//  const [inviteLoading, setInviteLoading] = useState(false)
//  const [inviteError, setInviteError] = useState('')
  const [violationInfo, setViolationInfo] = useState<{
    violationType: string
    confidence: number
    detectedAt: string
  } | null>(null)
  
//  const [hasViolation, setHasViolation] = useState(false)
  const [members, setMembers] = useState<BoardMember[]>([])

  const [brushType, setBrushType] = useState<'pencil' | 'pen' | 'chalk' | 'fill'>('pencil')

  const {
    tool, setTool,
    penType, setPenType,
    shapeType, setShapeType,
    color, setColor,
    thickness, setThickness,
    strokeColor, setStrokeColor,
    strokeThickness, setStrokeThickness,
    fillColor, setFillColor,
    fillOpacity, setFillOpacity,
    angle, setAngle,
    strokePosition, setStrokePosition,
    borderRadius, setBorderRadius,
    zoom, updateZoom,
    panX, panY,
    undoCount,
    MAX_UNDO_COUNT,
    startDrawing, draw, stopDrawing,
    clearCanvas, undo, redo,
    renderCanvas,
    getCanvasCoords,
    setStrokes,
    applyFill,
  } = useCanvas(canvasRef, room.serverId || room.id, currentUserId)

  const { isLight, toggle } = useTheme()

  //const [state1, setState1] = useState(...)
  //const [state2, setState2] = useState(...)

  const [toast, setToast] = useState('')
  const showCanvasToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }
  const isOwner = members.some(m => 
    m.userId === currentUserId && m.role === 'Owner'
  )
  const handleSaveRoomName = () => {
    if (roomName.trim()) {
      onUpdateRoom({ ...room, name: roomName.trim() })
      showCanvasToast('Название комнаты сохранено')
    } else {
      showCanvasToast('Введите название комнаты')
    }
  }

  const handleExit = () => {
    setShowExitModal(false)
    onExit()
  }

  const handleClearCanvas = async () => {
  if (!isOwner) return;
  
  try {
    const boardId = room.serverId || room.id;
    // 1. Сообщаем серверу (код серверного метода будет в шаге 3)
    await boardHub.clearBoard(boardId); 
    
    // 2. Очищаем локально сразу, чтобы у владельца не было задержки
    clearCanvas(); 
    showCanvasToast('Холст очищен');
  } catch (err) {
    console.error('Ошибка синхронизации очистки:', err);
    showCanvasToast('Не удалось очистить холст на сервере');
  }
}
//  const handleInvite = () => {
//    setShowInviteModal(true)
//  }

  const toggleMenu = () => {
    setSidebarLeftOpen(!sidebarLeftOpen)
  }

  const toggleFilePanel = () => {
    if (!sidebarLeftOpen) setSidebarLeftOpen(true)
    setFilePanelOpen(!filePanelOpen)
  }

  const toggleToolbar = () => {
    setIsToolbarOpen(!isToolbarOpen)
  }

  const openToolSettings = () => {
    setToolSettingsOpen(true)
  }

  const closeToolSettings = () => {
    setToolSettingsOpen(false)
  }

  const toggleToolSettings = () => {
    setToolSettingsOpen(prev => !prev)
  }

  const handleSelectCanvas = (index: number) => {
    setSelectedCanvasIndex(index)
    showCanvasToast('Полотно выбрано')
  }

  const handleCloseLanguage = () => {}

//  const reorderUsers = (newUsers: User[]) => {
//    console.log('Reorder users:', newUsers)
//  }

  const handleBrushSelect = (type: 'pencil' | 'pen' | 'chalk' | 'fill') => {
    setBrushType(type)
    if (type === 'fill') {
      if (tool === 'fill') {
        toggleToolSettings()
      } else {
        setTool('fill')
        openToolSettings()
      }
    } else {
      const newPenType = type as PenType
      setPenType(newPenType)
      if (tool === 'pen' && penType === newPenType) {
        toggleToolSettings()
      } else {
        setTool('pen')
        openToolSettings()
      }
    }
  }

  // Загружаем участников доски при монтировании
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const boardId = room.serverId || room.id
        const membersList = await accessApi.getMembers(boardId)
        setMembers(membersList)
      } catch (err) {
        console.error('Failed to load members:', err)
      }
    }
    loadMembers()
  }, [room.serverId, room.id])

  useEffect(() => {
    authApi.me()
      .then(user => setCurrentUserId(user.id))
      .catch(err => console.error('Failed to get current user:', err))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
      renderCanvas()
    }
  }, [])


  const handleContentViolation = (data: any) => {
  console.warn('🚨 Content violation detected:', data)
  
  // Сохраняем информацию о нарушении
  setViolationInfo({
    violationType: data.violationType,
    confidence: data.confidence,
    detectedAt: data.detectedAt
  })
  
  // Показываем toast
  showCanvasToast(
    `⚠️ ${data.message || 'Обнаружен нежелательный контент'} (уверенность: ${data.confidence?.toFixed(1)}%)`
  )
  
  // Автоматически убираем выделение через 10 секунд
  setTimeout(() => {
    setViolationInfo(null)
  }, 10000)
}

// === ПОДКЛЮЧЕНИЕ К SIGNALR ===
useEffect(() => {
  let isMounted = true
  let connectionEstablished = false
  let currentUserId = ''

  // Получаем текущий userId
  authApi.me()
    .then(user => { currentUserId = user.id })
    .catch(err => console.error('Failed to get current user:', err))

  const connectToHub = async () => {
    const boardId = room.serverId || room.id
    if (!boardId) {
      console.warn('No board ID available')
      return
    }

    await new Promise(resolve => setTimeout(resolve, 100))

    if (!isMounted) {
      console.log('[CanvasScreen] Component unmounted before connection')
      return
    }

    try {
      await boardHub.connect(boardId)
      
      if (!isMounted) {
        console.log('[CanvasScreen] Component unmounted during connection, disconnecting')
        await boardHub.disconnect()
        return
      }

      connectionEstablished = true
      console.log('Connected to board hub')

      if (boardHub.isConnected()) {
        await boardHub.requestHistory(boardId, 0)
      }
    } catch (err) {
      if (isMounted) {
        console.error('Failed to connect to board hub:', err)
        showCanvasToast('Не удалось подключиться к серверу')
      }
    }
  }

  

  connectToHub()

  

  // === МАППИНГ БЭКЕНД-СОБЫТИЯ → РОНТЕНД STROKE ===
  const mapBackendEventToStroke = (eventType: string, payload: any, event?: any): Stroke | null => {
    try {
      if (!payload) {
        console.warn('Empty payload for event:', eventType)
        return null
      }

      if (eventType === 'StrokeCreated') {
        if (!payload.points || !Array.isArray(payload.points)) {
          console.warn('StrokeCreated without points:', payload)
          return null
        }
        return {
          id: payload.elementId,
          userId: event?.userId,              
          sequenceNumber: event?.sequenceNumber,
          type: 'pen',
          points: payload.points.map((p: any) => ({ x: p.x, y: p.y })),
          color: payload.color || '#000000',
          thickness: payload.thickness || 2,
          start: payload.points[0] ? { x: payload.points[0].x, y: payload.points[0].y } : undefined,
          end: payload.points[payload.points.length - 1] 
            ? { x: payload.points[payload.points.length - 1].x, y: payload.points[payload.points.length - 1].y } 
            : undefined,
        }
      }
      
      if (eventType === 'ShapeCreated') {
        const shapeTypeMap: Record<string, string> = {
          'Rectangle': 'rect',
          'Ellipse': 'circle',
          'Line': 'line',
          'Triangle': 'triangle',
          'Arrow': 'arrow'
        }
        
        const frontendType = shapeTypeMap[payload.type] || 'rect'
        
        return {
          id: payload.elementId,
          userId: event?.userId,            
          sequenceNumber: event?.sequenceNumber,
          type: frontendType as 'line' | 'rect' | 'circle' | 'triangle' | 'arrow',
          points: [],
          color: payload.strokeColor || '#000000',
          thickness: payload.strokeWidth || 2,
          start: { x: payload.x || 0, y: payload.y || 0 },
          end: { 
            x: (payload.x || 0) + (payload.width || 0), 
            y: (payload.y || 0) + (payload.height || 0) 
          },
          strokeColor: payload.strokeColor,
          strokeThickness: payload.strokeWidth,
          fillColor: payload.fillColor,
        }
      }

      if (eventType === 'TextCreated') {
      return {
        id: payload.elementId,
        userId: event?.userId,
        sequenceNumber: event?.sequenceNumber,
        type: 'text',
        points: [{ x: payload.x, y: payload.y }],
        color: payload.color || '#000000',
        thickness: 0,
        start: { x: payload.x, y: payload.y },
        end: { x: payload.x, y: payload.y },
        text: payload.text,
        fontSize: payload.fontSize || 20,
        strokeColor: payload.strokeColor,
        strokeThickness: payload.strokeThickness,
      }
}
      
      if (eventType === 'ActionUndone') return null

      console.warn('Unknown event type:', eventType)
      return null
    } catch (err) {
      console.error('Failed to map event to stroke:', err, { eventType, payload })
      return null
    }
  }

  

  // === ОБРАБОТЧИКИ СОБЫТИЙ ===
  
  const handleBoardEvent = (event: any) => {
  console.log('Received board event:', event)
  
  // === Обработка ActionUndone ===
  if (event.eventType === 'ActionUndone') {
    const undoneSeq = event.payload?.undoneSequenceNumber
    console.log(`🔴 Action undone: sequence ${undoneSeq}`, event)
    
    if (undoneSeq === undefined) {
      console.error('❌ undoneSequenceNumber is undefined!', event.payload)
      return
    }
    
    setStrokes(prev => {
      const filtered = prev.filter(s => s.sequenceNumber !== undoneSeq)
      console.log(`Filtered strokes: ${prev.length} → ${filtered.length}`)
      return filtered
    })
    return
  }
  if (event.eventType === 'BoardCleared') {
    clearCanvas(); // Очищаем локальные штрихи
    // setUndoCount(0) уже вызывается внутри clearCanvas после нашей правки в хуке!
    showCanvasToast('Холст был очищен создателем');
    return;
  }
  // === Если это НАШЕ событие — обновляем sequenceNumber в существующем stroke ===
  if (event.userId === currentUserId) {
    if (['StrokeCreated', 'ShapeCreated', 'TextCreated'].includes(event.eventType)) {
      const elementId = event.payload?.elementId
      if (elementId) {
        setStrokes(prev => prev.map(s => 
          s.id === elementId ? { ...s, sequenceNumber: event.sequenceNumber } : s
        ))
        console.log(`✅ Updated sequenceNumber for stroke ${elementId}: ${event.sequenceNumber}`)
      }
    }
    return  // Не добавляем как новый stroke, он уже есть локально
  }
  
  // === События от других пользователей — добавляем как новые strokes ===
  const stroke = mapBackendEventToStroke(event.eventType, event.payload, event)
  if (stroke) {
    setStrokes(prev => [...prev, stroke])
  }
}

  const handleHistoryResponse = (data: any) => {
  console.log('Received history:', data.events?.length || 0, 'events')
  
  if (!data.events || data.events.length === 0) return
  
  const strokes: Stroke[] = []
  const undoneSequences = new Set<number>()  // ← НОВОЕ: храним отменённые sequenceNumber
  
  // Первый проход: собираем все отменённые sequenceNumber
  for (const event of data.events) {
    if (event.eventType === 'ActionUndone') {
      try {
        let payload = event.payload
        if (typeof event.payloadJson === 'string') {
          payload = JSON.parse(event.payloadJson)
        } else if (event.payloadJson) {
          payload = event.payloadJson
        }
        if (payload?.undoneSequenceNumber !== undefined) {
          undoneSequences.add(payload.undoneSequenceNumber)
        }
      } catch (err) {
        console.error('Failed to parse ActionUndone event:', err)
      }
    }
  }
  
  console.log(`Found ${undoneSequences.size} undone actions in history`)
  
  // Второй проход: применяем события, пропуская отменённые
  for (const event of data.events) {
    try {
      // Пропускаем сами ActionUndone события
      if (event.eventType === 'ActionUndone') continue
      
      // Пропускаем отменённые события
      if (undoneSequences.has(event.sequenceNumber)) {
        console.log(`Skipping undone event: sequence ${event.sequenceNumber}`)
        continue
      }
      
      let payload = event.payload
      if (typeof event.payloadJson === 'string') {
        payload = JSON.parse(event.payloadJson)
      } else if (event.payloadJson) {
        payload = event.payloadJson
      }
      
      const stroke = mapBackendEventToStroke(event.eventType, payload, event)
      if (stroke) {
        strokes.push(stroke)
      }
    } catch (err) {
      console.error('Failed to parse history event:', err, event)
    }
  }
  
  if (strokes.length > 0) {
    setStrokes(strokes)
    console.log(`✅ Applied ${strokes.length} strokes from history`)
  } else {
    console.log('📭 History is empty (all events were undone)')
    setStrokes([])
  }
}

  const handleUserJoined = (data: any) => {
    console.log('User joined:', data)
    showCanvasToast(`${data.displayName} присоединился`)
  }

  const handleUserLeft = (data: any) => {
    console.log('User left:', data)
    showCanvasToast(`${data.displayName} вышел`)
  }

  const handleAccessDenied = (data: any) => {
    console.log('Access denied:', data)
    showCanvasToast(data.message)
  }

  boardHub.on('BoardEventReceived', handleBoardEvent)
  boardHub.on('HistoryResponse', handleHistoryResponse)
  boardHub.on('UserJoined', handleUserJoined)
  boardHub.on('UserLeft', handleUserLeft)
  boardHub.on('AccessDenied', handleAccessDenied)
  boardHub.on('ContentViolation', handleContentViolation)

  return () => {
    console.log('[CanvasScreen] Cleaning up SignalR connection')
    isMounted = false
    boardHub.off('BoardEventReceived', handleBoardEvent)
    boardHub.off('HistoryResponse', handleHistoryResponse)
    boardHub.off('UserJoined', handleUserJoined)
    boardHub.off('UserLeft', handleUserLeft)
    boardHub.off('AccessDenied', handleAccessDenied)
    boardHub.off('ContentViolation', handleContentViolation)
    
    if (connectionEstablished) {
      boardHub.disconnect()
    }
  }
}, [room.serverId, room.id])
  useEffect(() => {
    renderCanvas()
  }, [zoom, panX, panY])

  useEffect(() => {
    if (!sidebarLeftOpen) {
      setFilePanelOpen(false)
    }
  }, [sidebarLeftOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }
      const key = e.key
      if (key >= '1' && key <= '8') {
        const num = parseInt(key)
        const toolMap: { [key: number]: () => void } = {
          1: () => { setTool('hand'); closeToolSettings() },
          2: () => {
            handleBrushSelect(brushType)
          },
          3: () => {
            const currentShape = shapeType as ToolType
            if (tool === currentShape) {
              toggleToolSettings()
            } else {
              setTool(currentShape)
              openToolSettings()
            }
          },
          4: () => {
            if (tool === 'text') {
              toggleToolSettings()
            } else {
              setTool('text')
              openToolSettings()
            }
          },
          5: () => {
            if (tool === 'eraser') {
              toggleToolSettings()
            } else {
              setTool('eraser')
              openToolSettings()
            }
          },
          6: () => { clearCanvas(); closeToolSettings() },
          7: () => { undo(); closeToolSettings() },
          8: () => { redo(); closeToolSettings() },
        }
        if (toolMap[num]) {
          e.preventDefault()
          toolMap[num]()
          const names: { [key: number]: string } = {
            1: 'Рука',
            2: brushType === 'fill' ? 'Заливка' : 
               brushType === 'pencil' ? 'Карандаш' :
               brushType === 'pen' ? 'Перо' : 'Мелок',
            3: 'Фигура',
            4: 'Текст',
            5: 'Ластик',
            6: 'Очистить',
            7: 'Отменить',
            8: 'Повторить'
          }
          showCanvasToast(`Инструмент ${num} активирован: ${names[num] || ''}`)
        }
      } else if (key === '9') {
        e.preventDefault()
        updateZoom(-0.05)
        closeToolSettings()
        showCanvasToast('Масштаб уменьшен')
      } else if (key === '0') {
        e.preventDefault()
        updateZoom(0.05)
        closeToolSettings()
        showCanvasToast('Масштаб увеличен')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setTool, clearCanvas, undo, redo, updateZoom, shapeType, tool, toggleToolSettings, brushType, handleBrushSelect, penType])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'text') {
      const pos = getCanvasCoords(e)
      setTextPos({ x: pos.x, y: pos.y })
      setShowTextInput(true)
      setTextValue('')
    } else if (tool === 'fill') {
      const pos = getCanvasCoords(e)
      applyFill(pos.x, pos.y)
      showCanvasToast('Заливка выполнена')
    }
  }

  const handleTextInputBlur = async () => {
  if (textValue.trim()) {
    const textId = crypto.randomUUID()
    
    const newStroke: Stroke = {
      id: textId,
      userId: currentUserId,
      type: 'text',
      points: [{ x: textPos.x, y: textPos.y }],
      color: color,
      thickness: thickness,
      start: { x: textPos.x, y: textPos.y },
      end: { x: textPos.x, y: textPos.y },
      text: textValue.trim(),
      fontSize: thickness * 2 + 10,
      fillColor: fillColor,
      strokeColor: strokeColor,
      strokeThickness: strokeThickness,
      strokePosition: strokePosition,
      fillOpacity: fillOpacity,
      borderRadius: borderRadius,
    }
    
    setStrokes(prev => [...prev, newStroke])
    
    // Отправляем на сервер
    try {
      await boardHub.addText(room.serverId || room.id, {
        elementId: textId,
        x: textPos.x,
        y: textPos.y,
        text: textValue.trim(),
        fontSize: thickness * 2 + 10,
        color: color,
        strokeColor: strokeColor,
        strokeThickness: strokeThickness,
      })
    } catch (err) {
      console.error('Failed to send text to server:', err)
    }
  }
  setShowTextInput(false)
  setTextValue('')
}

  const handleTextInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTextInputBlur()
    }
  }

  const handleTextInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextValue(e.target.value)
  }

  const handleReload = () => {
    window.location.reload()
  }

  return (
    <div id="canvas-screen" className="active">
      {toast && <Toast message={toast} className="canvas-feedback-toast" />}

      {/* --- ИЗМЕНЕНИЕ: Весь header-right перемещен внутрь header --- */}
      <header className="header">
        <div className="header-left">
          <button className="header-btn" onClick={toggleMenu}>☰</button>
          <span className="header-title" onClick={handleReload} style={{ cursor: 'pointer' }}>TogeDraw</span>
        </div>
        <div className="header-center">
          <input
            type="text"
            placeholder="Название комнаты"
            value={roomName}
            onChange={e => setRoomName(e.target.value)}
          />
          <button onClick={handleSaveRoomName}>Сохранить</button>
        </div>
        <div className="header-right">
          <button 
            className="header-btn" 
            onClick={() => setSidebarRightOpen(!sidebarRightOpen)}
            style={{ fontSize: '18px' }}
          >
            👥
          </button>
        </div>
      </header>

      <SidebarLeft
        isOpen={sidebarLeftOpen}
        onToggleTheme={toggle}
        isLight={isLight}
        onOpenHelp={() => setShowHelpModal(true)}
        onToggleFilePanel={toggleFilePanel}
        onSelectCanvas={handleSelectCanvas}
        selectedCanvasIndex={selectedCanvasIndex}
        onCloseLanguage={handleCloseLanguage}
      />

      <div className={`file-panel ${filePanelOpen ? 'open' : ''}`}>
        <div className="file-menu-item" onClick={() => showCanvasToast('Файл импортирован')}>
          <img src="/icons/open.png" alt="Открыть" style={{ width: '20px', height: '20px' }} />
          <span>Открыть</span>
        </div>
        <div className="file-menu-item" onClick={() => showCanvasToast('Файл экспортирован')}>
          <img src="/icons/save.png" alt="Сохранить как" style={{ width: '20px', height: '20px' }} />
          <span>Сохранить как</span>
        </div>
      </div>
<div className={`sidebar-right ${sidebarRightOpen ? 'open' : ''}`}>
  <SidebarRight
    members={members}
    onInvite={() => setShowInviteModal(true)}
    onClose={() => setSidebarRightOpen(false)}
    onKick={(_userId) => showCanvasToast('Функция в разработке')}
    onBan={(_userId) => showCanvasToast('Функция в разработке')}
    onCrown={(_userId) => showCanvasToast('Функция в разработке')}
    onReorder={(_newMembers) => {}}
  />
</div>
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        boardId={room.serverId || room.id}
        onInvited={() => {
          // Перезагружаем список участников
          const loadMembers = async () => {
            try {
              const membersList = await accessApi.getMembers(room.serverId || room.id)
              setMembers(membersList)
            } catch (err) {
              console.error('Failed to reload members:', err)
            }
          }
          loadMembers()
        }}
      />

      <div className="global-exit-btn" onClick={() => setShowExitModal(true)}>
        <img src="/icons/exit.png" alt="Выйти" style={{ width: '24px', height: '24px' }} />
      </div>

      <div className="canvas-wrapper">
        <div className="canvas-container" style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onClick={handleCanvasClick}
            style={{ width: '100%', height: '100%', cursor: tool === 'hand' ? 'grab' : 'crosshair' }}
          />

          {/* Метка нарушения */}
    {violationInfo && (
      <div 
        style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#dc3545',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 'bold',
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          animation: 'pulse 2s infinite'
        }}
      >
        ⚠️ {violationInfo.violationType} ({violationInfo.confidence.toFixed(1)}%)
      </div>
    )}

          {showTextInput && (
            <input
              type="text"
              style={{
                position: 'absolute',
                left: (textPos.x + panX) * zoom,
                top: (textPos.y + panY) * zoom,
                fontSize: thickness * 2 + 10,
                color: color,
                background: 'transparent',
                border: 'none',
                outline: '1px dashed var(--accent-blue)',
                padding: '2px',
                fontFamily: 'sans-serif',
                zIndex: 50,
                minWidth: '50px',
              }}
              value={textValue}
              onChange={handleTextInputChange}
              onBlur={handleTextInputBlur}
              onKeyDown={handleTextInputKeyDown}
              autoFocus
            />
          )}
        </div>

        <ZoomControls zoom={zoom} onZoom={updateZoom} />

        <div className="toolbar-container">
          <Toolbar
            isOwner={isOwner}
            onClear={isOwner ? handleClearCanvas : () => showCanvasToast('Только владелец может очистить холст')}
            isOpen={isToolbarOpen}
            tool={tool}
            penType={penType}
            shapeType={shapeType}
            brushType={brushType}
            onToolChange={setTool}
            onPenTypeChange={setPenType}
            onShapeTypeChange={setShapeType}
            onBrushSelect={handleBrushSelect}
            onOpenSettings={openToolSettings}
            onCloseSettings={closeToolSettings}
            onToggleSettings={toggleToolSettings}
            onUndo={undo}
            onRedo={redo}
            onToolSelect={showCanvasToast}
            undoCount={undoCount}
            maxUndoCount={MAX_UNDO_COUNT}
          />
          <button
            className={`tool-toggle-btn ${isToolbarOpen ? 'open' : ''}`}
            onClick={toggleToolbar}
          >
            {isToolbarOpen ? '▲' : '▼'}
          </button>
        </div>

        <ToolSettingsModal
          isOpen={toolSettingsOpen}
          onClose={closeToolSettings}
          tool={tool}
          color={color}
          setColor={setColor}
          thickness={thickness}
          setThickness={setThickness}
          strokeColor={strokeColor}
          setStrokeColor={setStrokeColor}
          strokeThickness={strokeThickness}
          setStrokeThickness={setStrokeThickness}
          fillColor={fillColor}
          setFillColor={setFillColor}
          fillOpacity={fillOpacity}
          setFillOpacity={setFillOpacity}
          angle={angle}
          setAngle={setAngle}
          strokePosition={strokePosition}
          setStrokePosition={setStrokePosition}
          borderRadius={borderRadius}
          setBorderRadius={setBorderRadius}
        />
      </div>

      <Modal isOpen={showExitModal} title="Выйти из комнаты?" desc="Вы действительно хотите выйти из комнаты?" onClose={() => setShowExitModal(false)} actions={
        <>
          <button className="modal-btn" onClick={() => setShowExitModal(false)}>Отмена</button>
          <button className="modal-btn danger" onClick={handleExit}>Выйти</button>
        </>
      } />

      <Modal isOpen={showHelpModal} title="Общие сведения" desc="Помощь скоро здесь появится" onClose={() => setShowHelpModal(false)} />

      <Modal isOpen={showKickModal} title="Удалить пользователя?" desc="Вы действительно хотите удалить этого пользователя из комнаты?" onClose={() => setShowKickModal(false)} actions={
        <>
          <button className="modal-btn" onClick={() => setShowKickModal(false)}>Отмена</button>
          <button className="modal-btn danger" onClick={() => { setShowKickModal(false); showCanvasToast('Пользователь удален') }}>Удалить</button>
        </>
      } />

      <Modal isOpen={showBanModal} title="Запретить рисовать?" desc="Вы действительно хотите запретить этому пользователю рисовать на полотне?" onClose={() => setShowBanModal(false)} actions={
        <>
          <button className="modal-btn" onClick={() => setShowBanModal(false)}>Отмена</button>
          <button className="modal-btn danger" onClick={() => { setShowBanModal(false); showCanvasToast('Пользователю запрещено рисовать') }}>Запретить</button>
        </>
      } />

      <Modal isOpen={showCrownModal} title="Сделать создателем?" desc="Вы действительно хотите передать права создателя этому пользователю?" onClose={() => setShowCrownModal(false)} actions={
        <>
          <button className="modal-btn" onClick={() => setShowCrownModal(false)}>Отмена</button>
          <button className="modal-btn confirm" onClick={() => { setShowCrownModal(false); showCanvasToast('Права переданы') }}>Назначить</button>
        </>
      } />
    </div>
  )
}

export default CanvasScreen