import * as signalR from '@microsoft/signalr'
import { getAccessToken } from './api'
import type { BoardEvent } from '../types'

const HUB_URL = '/boardHub'

class BoardHubService {
  private connection: signalR.HubConnection | null = null
  private eventHandlers: Map<string, ((event: any) => void)[]> = new Map()
  private isConnecting = false

  async connect(boardId: string): Promise<void> {
    // Если уже подключаемся, ждём
    if (this.isConnecting) {
      console.log('[SignalR] Already connecting, waiting...')
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Если уже подключены, выходим
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      console.log('[SignalR] Already connected')
      return
    }

    this.isConnecting = true

    try {
      const token = getAccessToken()
      if (!token) {
        throw new Error('No access token available')
      }

      // Если есть старое подключение, закрываем его
      if (this.connection) {
        await this.connection.stop()
        this.connection = null
      }

      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(`${HUB_URL}?boardId=${boardId}`, {
          accessTokenFactory: () => token,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Information)
        .build()

      // Регистрация обработчиков
      this.connection.on('BoardEventReceived', (event: BoardEvent) => {
        this.emit('BoardEventReceived', event)
      })

      this.connection.on('ContentViolation', (data: any) => {
        this.emit('ContentViolation', data)
      })

      this.connection.on('HistoryResponse', (events: BoardEvent[]) => {
        this.emit('HistoryResponse', { events })
      })

      this.connection.on('UserJoined', (data: { userId: string; displayName: string }) => {
        this.emit('UserJoined', data)
      })

      this.connection.on('UserLeft', (data: { userId: string; displayName: string }) => {
        this.emit('UserLeft', data)
      })

      this.connection.on('AccessDenied', (message: string) => {
        this.emit('AccessDenied', { message })
      })

      this.connection.on('Error', (message: string) => {
        this.emit('Error', { message })
      })

      this.connection.onreconnecting(() => {
        console.log('[SignalR] Reconnecting...')
      })

      this.connection.onreconnected(() => {
        console.log('[SignalR] Reconnected')
      })

      this.connection.onclose(() => {
        console.log('[SignalR] Connection closed')
      })

      await this.connection.start()
      console.log('[SignalR] Connected to board', boardId)
    } catch (err) {
      console.error('[SignalR] Connection failed:', err)
      throw err
    } finally {
      this.isConnecting = false
    }
  }
  
  async undoLastAction(boardId: string): Promise<void> {
    if (!this.isConnected()) throw new Error('Not connected')
    await this.connection!.invoke('UndoLastAction', boardId)
  }

    async clearBoard(boardId: string): Promise<void> {
    if (!this.isConnected()) throw new Error('Not connected')
    await this.connection!.invoke('ClearBoard', boardId)
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop()
      } catch (err) {
        console.warn('[SignalR] Error during disconnect:', err)
      }
      this.connection = null
      this.eventHandlers.clear()
    }
  }

  async addText(boardId: string, textData: any): Promise<void> {
    if (!this.isConnected()) throw new Error('Not connected')
    await this.connection!.invoke('AddText', boardId, textData)
  }


  async drawStroke(boardId: string, stroke: any): Promise<void> {
    if (!this.isConnected()) throw new Error('Not connected')
    await this.connection!.invoke('DrawStroke', boardId, stroke)
  }

  async createShape(boardId: string, shape: any): Promise<void> {
    if (!this.isConnected()) throw new Error('Not connected')
    await this.connection!.invoke('CreateShape', boardId, shape)
  }

  async moveElement(boardId: string, moveData: any): Promise<void> {
    if (!this.isConnected()) throw new Error('Not connected')
    await this.connection!.invoke('MoveElement', boardId, moveData)
  }

  async deleteElement(boardId: string, elementId: string): Promise<void> {
    if (!this.isConnected()) throw new Error('Not connected')
    await this.connection!.invoke('DeleteElement', boardId, { elementId })
  }

  async addImage(boardId: string, imageData: any): Promise<void> {
    if (!this.isConnected()) throw new Error('Not connected')
    await this.connection!.invoke('AddImage', boardId, imageData)
  }

  async changeMode(boardId: string, mode: string, presenterId?: string): Promise<void> {
    if (!this.isConnected()) throw new Error('Not connected')
    await this.connection!.invoke('ChangeMode', boardId, mode, presenterId)
  }

  async requestHistory(boardId: string, afterSequence: number): Promise<void> {
    if (!this.isConnected()) {
      console.warn('[SignalR] Cannot request history: not connected')
      return
    }
    await this.connection!.invoke('RequestHistory', boardId, afterSequence)
  }


  isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  off(event: string, handler: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(data))
    }
  }
}

export const boardHub = new BoardHubService()