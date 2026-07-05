// базовые типы
export interface Room {
  id: string
  serverId?: string 
  name: string
  imageIndex?: number
}

export interface User {
  id: string
  name: string
  color: 'orange' | 'green' | 'blue' | 'purple' | 'pink'
}

export type PenType = 'pencil' | 'pen' | 'chalk'
export type ShapeType = 'line' | 'arrow' | 'rect' | 'circle' | 'triangle'
export type StrokePosition = 'outside' | 'inside' | 'center'

export interface Stroke {
  id: string
  userId?: string
  sequenceNumber?: number
  type: 'pen' | 'line' | 'rect' | 'circle' | 'triangle' | 'arrow' | 'eraser' | 'text' | 'fill'
  points: { x: number; y: number }[]
  color: string
  thickness: number
  start?: { x: number; y: number }
  end?: { x: number; y: number }
  strokeColor?: string
  strokeThickness?: number
  strokePosition?: StrokePosition
  angle?: number
  penType?: PenType
  text?: string
  fontSize?: number
  fillColor?: string
  fillOpacity?: number
  borderRadius?: number
}

export type ToolType = 'hand' | 'pen' | 'line' | 'rect' | 'circle' | 'triangle' | 'arrow' | 'text' | 'eraser' | 'fill' | 'trash' | 'undo' | 'redo'

// типы для бека
export type BoardRole = 'Viewer' | 'Editor' | 'Presenter' | 'Owner'
export type BoardMode = 'FreeForAll' | 'PresenterOnly' | 'ReadOnly'

export interface BoardEvent {
  sequenceNumber: number
  userId: string
  userName?: string
  eventType: string
  payload: any
  timestamp: string
}

export interface ServerUser {
  id: string
  email: string
  displayName: string
}

export interface ServerBoard {
  id: string
  title: string
  createdAt: string
  updatedAt?: string
  ownerId?: string
}

export interface BoardMember {
  userId: string
  email: string
  displayName: string
  role: BoardRole
  addedAt: string
}

export interface UploadedImage {
  elementId: string
  s3Key: string
  fileName: string
  contentType: string
  sizeBytes: number
  width: number
  height: number
  presignedUrl: string
}

export interface BoardSnapshot {
  id: string
  boardId: string
  sequenceNumber: number
  s3Key: string
  createdAt: string
  presignedUrl: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
}

export interface InviteLinkResponse {
  inviteToken: string
  inviteUrl: string
  expiresAt: string
}