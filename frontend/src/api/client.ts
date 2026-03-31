import axios from 'axios'
import type {
  Exercise, ExerciseCreate,
  Workout, WorkoutCreate, WorkoutSummary,
  BodyMetric, BodyMetricCreate,
  PR,
  Meet, MeetCreate,
  Program, ProgramCreate, ProgramGenerate,
  AIConversation, AIAskRequest, AIOverride,
  UserPreferences, UserPreferencesUpdate,
  AnalyticsSummary,
  ImportConfirmRequest,
  AuthToken, LoginRequest, RegisterRequest, AuthUser,
  EnduranceActivity, EnduranceCreate, AdminUser, Invite,
} from '../types'

const TOKEN_KEY = 'auth_token'

export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY)
export const setStoredToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token)
export const clearStoredToken = (): void => localStorage.removeItem(TOKEN_KEY)

const rawApiUrl = (import.meta.env.VITE_API_URL || '').replace(/^http:\/\//, 'https://')
const api = axios.create({
  baseURL: rawApiUrl,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request if present
api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Auth ──

export const auth = {
  register: (data: RegisterRequest) =>
    api.post<AuthToken>('/api/auth/register', data).then(r => r.data),
  login: (data: LoginRequest) =>
    api.post<AuthToken>('/api/auth/login', data).then(r => r.data),
  me: () =>
    api.get<AuthUser>('/api/auth/me').then(r => r.data),
}

// ── Exercises ──

export const exercises = {
  list: () =>
    api.get<Exercise[]>('/api/exercises').then(r => r.data),
  getById: (id: number) =>
    api.get<Exercise>(`/api/exercises/${id}`).then(r => r.data),
  create: (data: ExerciseCreate) =>
    api.post<Exercise>('/api/exercises', data).then(r => r.data),
  update: (id: number, data: Partial<ExerciseCreate>) =>
    api.put<Exercise>(`/api/exercises/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/api/exercises/${id}`).then(r => r.data),
}

// ── Workouts ──

export const workouts = {
  list: (params?: { start_date?: string; end_date?: string }) =>
    api.get<WorkoutSummary[]>('/api/workouts', { params }).then(r => r.data),
  getById: (id: number) =>
    api.get<Workout>(`/api/workouts/${id}`).then(r => r.data),
  create: (data: WorkoutCreate) =>
    api.post<Workout>('/api/workouts', data).then(r => r.data),
  update: (id: number, data: Partial<WorkoutCreate>) =>
    api.put<Workout>(`/api/workouts/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/api/workouts/${id}`).then(r => r.data),
  complete: (id: number) =>
    api.post<Workout>(`/api/workouts/${id}/complete`).then(r => r.data),
  copy: (id: number) =>
    api.post<Workout>(`/api/workouts/${id}/copy`).then(r => r.data),
  importPreview: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/api/workouts/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  importConfirm: (data: ImportConfirmRequest) =>
    api.post('/api/workouts/import/confirm', data).then(r => r.data),
  importTemplate: () =>
    api.get('/api/workouts/import/template', { responseType: 'blob' }).then(r => r.data),
}

// ── Body Metrics ──

export const bodyMetrics = {
  list: (params?: { start_date?: string; end_date?: string }) =>
    api.get<BodyMetric[]>('/api/body-metrics', { params }).then(r => r.data),
  latest: () =>
    api.get<BodyMetric>('/api/body-metrics/latest').then(r => r.data),
  create: (data: BodyMetricCreate) =>
    api.post<BodyMetric>('/api/body-metrics', data).then(r => r.data),
  update: (id: number, data: Partial<BodyMetricCreate>) =>
    api.put<BodyMetric>(`/api/body-metrics/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/api/body-metrics/${id}`).then(r => r.data),
}

// ── PRs ──

export const prs = {
  list: () =>
    api.get<PR[]>('/api/prs').then(r => r.data),
  byExercise: (exerciseId: number) =>
    api.get<PR[]>(`/api/prs/exercise/${exerciseId}`).then(r => r.data),
  recent: (limit = 10) =>
    api.get<PR[]>('/api/prs/recent', { params: { limit } }).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/api/prs/${id}`).then(r => r.data),
  recalculate: () =>
    api.post('/api/prs/recalculate').then(r => r.data),
}

// ── Meets ──

export const meets = {
  list: () =>
    api.get<Meet[]>('/api/meets').then(r => r.data),
  next: () =>
    api.get<Meet>('/api/meets/next').then(r => r.data),
  getById: (id: number) =>
    api.get<Meet>(`/api/meets/${id}`).then(r => r.data),
  create: (data: MeetCreate) =>
    api.post<Meet>('/api/meets', data).then(r => r.data),
  update: (id: number, data: Partial<MeetCreate>) =>
    api.put<Meet>(`/api/meets/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/api/meets/${id}`).then(r => r.data),
}

// ── Programs ──

export const programs = {
  list: () =>
    api.get<Program[]>('/api/programs').then(r => r.data),
  getById: (id: number) =>
    api.get<Program>(`/api/programs/${id}`).then(r => r.data),
  create: (data: ProgramCreate) =>
    api.post<Program>('/api/programs', data).then(r => r.data),
  update: (id: number, data: Partial<ProgramCreate>) =>
    api.put<Program>(`/api/programs/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/api/programs/${id}`).then(r => r.data),
  generate: (data: ProgramGenerate) =>
    api.post<Program>('/api/programs/generate', data).then(r => r.data),
}

// ── Analytics ──

export const analytics = {
  volume: (params?: { exercise_id?: number; period?: string }) =>
    api.get('/api/analytics/volume', { params }).then(r => r.data),
  intensity: (params?: { exercise_id?: number; period?: string }) =>
    api.get('/api/analytics/intensity', { params }).then(r => r.data),
  e1rm: (exerciseId: number) =>
    api.get('/api/analytics/e1rm', { params: { exercise_id: exerciseId } }).then(r => r.data),
  dots: () =>
    api.get('/api/analytics/dots').then(r => r.data),
  bodyweight: (params?: { period?: string }) =>
    api.get('/api/analytics/bodyweight', { params }).then(r => r.data),
  summary: (params?: { period?: string }) =>
    api.get<AnalyticsSummary>('/api/analytics/summary', { params }).then(r => r.data),
}

// ── AI Coach ──

export const ai = {
  ask: (data: AIAskRequest) =>
    api.post('/api/ai/ask', data).then(r => r.data),
  analyzeTraining: (params?: { period?: string }) =>
    api.get('/api/ai/analyze', { params }).then(r => r.data),
  meetPrep: (meetId: number) =>
    api.get(`/api/ai/meet-prep/${meetId}`).then(r => r.data),
  conversations: () =>
    api.get<AIConversation[]>('/api/ai/conversations').then(r => r.data),
  override: (data: AIOverride) =>
    api.post('/api/ai/override', data).then(r => r.data),
  importXlsx: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/api/ai/import-xlsx', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }).then(r => r.data)
  },
}

// ── Preferences ──

export const preferences = {
  get: () =>
    api.get<UserPreferences>('/api/preferences').then(r => r.data),
  update: (data: UserPreferencesUpdate) =>
    api.put<UserPreferences>('/api/preferences', data).then(r => r.data),
}

// ── Endurance ──

export const endurance = {
  list: (params?: { activity_type?: string; is_competition?: boolean }) =>
    api.get<EnduranceActivity[]>('/api/endurance', { params }).then(r => r.data),
  getById: (id: number) =>
    api.get<EnduranceActivity>(`/api/endurance/${id}`).then(r => r.data),
  create: (data: EnduranceCreate) =>
    api.post<EnduranceActivity>('/api/endurance', data).then(r => r.data),
  update: (id: number, data: Partial<EnduranceCreate>) =>
    api.put<EnduranceActivity>(`/api/endurance/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/api/endurance/${id}`).then(r => r.data),
  competitionTypes: () =>
    api.get<string[]>('/api/endurance/competition-types').then(r => r.data),
}

// ── Admin ──

export const adminApi = {
  users: () =>
    api.get<AdminUser[]>('/api/admin/users').then(r => r.data),
  updateStatus: (userId: number, status: string) =>
    api.patch<AdminUser>(`/api/admin/users/${userId}/status`, { status }).then(r => r.data),
  toggleAdmin: (userId: number) =>
    api.patch<AdminUser>(`/api/admin/users/${userId}/admin`).then(r => r.data),
  deleteUser: (userId: number) =>
    api.delete(`/api/admin/users/${userId}`).then(r => r.data),
  createInvite: (data: { label?: string; max_uses?: number; expires_in_days?: number }) =>
    api.post<Invite>('/api/admin/invites', data).then(r => r.data),
  listInvites: () =>
    api.get<Invite[]>('/api/admin/invites').then(r => r.data),
  revokeInvite: (inviteId: number) =>
    api.delete(`/api/admin/invites/${inviteId}`).then(r => r.data),
}

export default api
