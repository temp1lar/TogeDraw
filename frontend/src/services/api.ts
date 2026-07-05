import type { 
  AuthResponse, 
  ServerBoard, 
  BoardMember, 
  BoardRole, 
  UploadedImage, 
  BoardSnapshot,
  InviteLinkResponse 
} from '../types'

const BASE_URL = '/api'

// мэнэджмент токенов тута
let accessToken: string | null = null
let refreshToken: string | null = null

export const setTokens = (access: string, refresh: string) => {
  accessToken = access
  refreshToken = refresh
  localStorage.setItem('accessToken', access)
  localStorage.setItem('refreshToken', refresh)
}

export const getAccessToken = () => {
  if (!accessToken) {
    accessToken = localStorage.getItem('accessToken')
  }
  return accessToken
}

export const clearTokens = () => {
  accessToken = null
  refreshToken = null
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
}

// http клиентус
async function request<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken()
  
  const headers: HeadersInit = {
    ...options.headers,
  }

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  // Не добавляем Content-Type для FormData
  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401 && refreshToken) {
    // Попробовать обновить токен
    const success = await refreshAccessToken()
    if (success) {
      // Повторить запрос с новым токеном
      return request<T>(endpoint, options)
    } else {
      clearTokens()
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false

  try {
    const response = await fetch(`${BASE_URL}/Auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) return false

    const data: AuthResponse = await response.json()
    setTokens(data.accessToken, data.refreshToken)
    return true
  } catch {
    return false
  }
}

// auth апишка
export const authApi = {
  register: (email: string, displayName: string, password: string) =>
    request<AuthResponse>('/Auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, displayName, password }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/Auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<void>('/Auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logoutAll: () =>
    request<void>('/Auth/logout-all', {
      method: 'POST',
    }),

  me: () =>
    request<{ id: string; displayName: string; email: string }>('/Auth/me'),
}

// апи досок
export const boardsApi = {
  create: (title: string) =>
    request<ServerBoard>('/Boards', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  getMyBoards: () =>
    request<ServerBoard[]>('/Boards'),

  getBoard: (id: string) =>
    request<ServerBoard>(`/Boards/${id}`),

  deleteBoard: (id: string) =>
    request<void>(`/Boards/${id}`, {
      method: 'DELETE',
    }),
}

// апи доступа к доскам
export const accessApi = {
  getMembers: (boardId: string) =>
    request<BoardMember[]>(`/boards/${boardId}/access/members`),

  inviteUser: (boardId: string, email: string, role: BoardRole) =>
    request<BoardMember>(`/boards/${boardId}/access/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  updateRole: (boardId: string, userId: string, newRole: BoardRole) =>
    request<void>(`/boards/${boardId}/access/role`, {
      method: 'PUT',
      body: JSON.stringify({ userId, newRole }),
    }),

  removeUser: (boardId: string, userId: string) =>
    request<void>(`/boards/${boardId}/access/members/${userId}`, {
      method: 'DELETE',
    }),

  createInviteLink: (boardId: string, role: BoardRole, expirationHours = 24, maxUses = 100) =>
    request<InviteLinkResponse>(`/boards/${boardId}/access/invite-link`, {
      method: 'POST',
      body: JSON.stringify({ role, expirationHours, maxUses }),
    }),

  acceptInvite: (inviteToken: string) =>
    request<BoardMember>(`/Invite/accept/${inviteToken}`, {
      method: 'POST',
    }),
}

// апи картинок
export const imagesApi = {
  upload: (boardId: string, file: File, width: number, height: number) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('width', width.toString())
    formData.append('height', height.toString())

    return request<UploadedImage>(`/boards/${boardId}/images`, {
      method: 'POST',
      body: formData,
    })
  },
}

// апи снимков
export const snapshotsApi = {
  getHistory: (boardId: string, limit = 10) =>
    request<BoardSnapshot[]>(`/boards/${boardId}/snapshots?limit=${limit}`),

  create: (boardId: string) =>
    request<{ s3Key: string }>(`/boards/${boardId}/snapshots`, {
      method: 'POST',
    }),

  getLatest: (boardId: string) =>
    request<{ s3Key: string; presignedUrl: string }>(`/boards/${boardId}/snapshots/latest`),
}