// ── Auth ──

export interface AuthUser {
  id: number
  email: string
  display_name?: string
  is_active: boolean
  status: string
  is_admin: boolean
  created_at: string
}

export interface AuthToken {
  access_token: string
  token_type: string
  user: AuthUser
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  display_name?: string
  invite_token?: string
}

// ── Exercises ──

export interface Exercise {
  id: number
  name: string
  category: string
  is_competition: boolean
  is_custom: boolean
  equipment?: string
  notes?: string
  created_at: string
}

export interface ExerciseCreate {
  name: string
  category: string
  is_competition?: boolean
  is_custom?: boolean
  equipment?: string
  notes?: string
}

// ── Sets ──

export interface SetData {
  id: number
  set_number: number
  weight_lbs: number
  reps: number
  rpe?: number
  set_type: string
  is_pr: boolean
  e1rm_lbs?: number
  notes?: string
}

export interface SetCreate {
  set_number: number
  weight_lbs: number
  reps: number
  rpe?: number
  set_type?: string
  notes?: string
}

// ── Workout Exercises ──

export interface WorkoutExercise {
  id: number
  exercise_id: number
  exercise: Exercise
  order_index: number
  sets: SetData[]
  notes?: string
}

export interface WorkoutExerciseCreate {
  exercise_id: number
  order_index: number
  sets: SetCreate[]
  notes?: string
}

// ── Workouts ──

export interface Workout {
  id: number
  date: string
  name?: string
  notes?: string
  duration_minutes?: number
  bodyweight_lbs?: number
  sleep_quality?: number
  fatigue_level?: number
  completed: boolean
  created_at: string
  exercises: WorkoutExercise[]
}

export interface WorkoutCreate {
  date: string
  name?: string
  notes?: string
  duration_minutes?: number
  bodyweight_lbs?: number
  sleep_quality?: number
  fatigue_level?: number
  completed?: boolean
  exercises: WorkoutExerciseCreate[]
}

export interface WorkoutSummary {
  id: number
  date: string
  name?: string
  status: 'planned' | 'in_progress' | 'completed'
  exercise_count: number
  total_volume_lbs: number
  duration_minutes?: number
}

// ── Body Metrics ──

export interface BodyMetric {
  id: number
  date: string
  bodyweight_lbs?: number
  body_fat_pct?: number
  notes?: string
  created_at: string
}

export interface BodyMetricCreate {
  date: string
  bodyweight_lbs?: number
  body_fat_pct?: number
  notes?: string
}

// ── PRs ──

export interface PR {
  id: number
  exercise_id: number
  exercise_name?: string
  set_id: number
  rep_count: number
  weight_lbs: number
  e1rm_lbs?: number
  date: string
  previous_weight_lbs?: number
}

// ── Meets ──

export interface Meet {
  id: number
  name: string
  date: string
  location?: string
  federation: string
  weight_class_kg?: number
  status: string
  squat_opener_lbs?: number
  bench_opener_lbs?: number
  deadlift_opener_lbs?: number
  actual_results?: Record<string, unknown>
  notes?: string
  created_at: string
}

export interface MeetCreate {
  name: string
  date: string
  location?: string
  federation?: string
  weight_class_kg?: number
  status?: string
  squat_opener_lbs?: number
  bench_opener_lbs?: number
  deadlift_opener_lbs?: number
  actual_results?: Record<string, unknown>
  notes?: string
}

// ── Programs ──

export interface Program {
  id: number
  name: string
  description?: string
  meet_id?: number
  start_date?: string
  end_date?: string
  status: string
  ai_generated: boolean
  program_data?: Record<string, unknown>
  created_at: string
}

export interface ProgramCreate {
  name: string
  description?: string
  meet_id?: number
  start_date?: string
  end_date?: string
  status?: string
  ai_generated?: boolean
  program_data?: Record<string, unknown>
}

export interface ProgramGenerate {
  goal: string
  duration_weeks: number
  training_days_per_week: number
  meet_date?: string
  weak_points?: string[]
  notes?: string
}

// ── AI Coach ──

export interface AIConversation {
  id: number
  context_type?: string
  user_message: string
  ai_response?: string
  context_snapshot?: Record<string, unknown>
  accepted?: boolean
  user_override_notes?: string
  created_at: string
}

export interface AIAskRequest {
  message: string
  context_type?: string
  context?: Record<string, unknown>
}

export interface AIOverride {
  conversation_id: number
  user_override_notes: string
}

// ── Preferences ──

export interface UserPreferences {
  display_unit: string
  training_days_per_week?: number
  preferred_rep_schemes?: Record<string, unknown>
  preferred_exercises?: Record<string, unknown>
  meet_weight_class_kg?: number
  notes?: string
}

export interface UserPreferencesUpdate {
  display_unit?: string
  training_days_per_week?: number
  preferred_rep_schemes?: Record<string, unknown>
  preferred_exercises?: Record<string, unknown>
  meet_weight_class_kg?: number
  notes?: string
}

// ── Invites ──

export interface Invite {
  id: number
  token: string
  label: string | null
  max_uses: number | null
  use_count: number
  expires_at: string | null
  is_active: boolean
  created_at: string
}

// ── Import ──

export interface ImportPreviewWorkout {
  date: string
  name?: string
  bodyweight?: number
  sleep_quality?: number
  fatigue_level?: number
  exercises: Array<{
    name: string
    matched_exercise_id: number | null
    order_index: number
    sets: Array<{
      set_number: number
      weight_lbs: number
      reps: number
      rpe?: number
      set_type: string
      notes?: string
    }>
  }>
}

export interface ImportPreview {
  workouts: ImportPreviewWorkout[]
  unmatched_exercises: string[]
  exercise_suggestions: Record<string, number | null>
  warnings: string[]
  stats: {
    total_workouts: number
    total_sets: number
    date_range: string
  }
}

export interface ImportConfirmRequest {
  workouts: ImportPreviewWorkout[]
  exercise_map: Record<string, number>
}

export interface ImportResult {
  created_workout_ids: number[]
  created: number
  errors: string[]
}

// ── Endurance ──

export interface EnduranceActivity {
  id: number
  activity_date: string
  activity_type: 'run' | 'erg'
  sub_type: string
  name?: string
  distance_m?: number
  duration_s?: number
  avg_heart_rate?: number
  avg_split_500m_s?: number
  stroke_rate?: number
  calories?: number
  is_competition: boolean
  competition_name?: string
  competition_type?: string
  place?: number
  notes?: string
  pace_per_km?: number  // computed by backend
  split_500m_display?: string  // computed by backend, e.g. "1:52"
  created_at: string
}

export interface EnduranceCreate {
  activity_date: string
  activity_type: 'run' | 'erg'
  sub_type: string
  name?: string
  distance_m?: number
  duration_s?: number
  avg_heart_rate?: number
  avg_split_500m_s?: number
  stroke_rate?: number
  calories?: number
  is_competition?: boolean
  competition_name?: string
  competition_type?: string
  place?: number
  notes?: string
}

// ── Admin ──

export interface AdminUser {
  id: number
  email: string
  display_name?: string
  status: 'pending' | 'approved' | 'denied'
  is_admin: boolean
  is_active: boolean
  created_at: string
  ai_tokens_used: number
  ai_token_limit: number | null
}

// ── Analytics ──

export interface AnalyticsSummary {
  period: string
  total_workouts: number
  total_volume_lbs: number
  avg_intensity_pct: number
  estimated_1rms: Record<string, number>
  dots_score?: number
  bodyweight_trend: Array<{ date: string; weight_lbs: number }>
  volume_by_muscle_group: Record<string, number>
}
