import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, Save, CheckCircle, Star, Search, GripVertical, ArrowLeft,
} from 'lucide-react'
import { workouts, exercises as exercisesApi } from '../api/client'
import type { Workout, WorkoutCreate, Exercise } from '../types'

// ── Types for local form state ──

interface LocalSet {
  key: string
  set_number: number
  weight_lbs: number | ''
  reps: number | ''
  rpe: number | ''
  type: 'warmup' | 'working' | 'backoff' | 'amrap'
  notes: string
}

interface LocalExercise {
  key: string
  exercise_id: number | null
  exercise_name: string
  order: number
  notes: string
  sets: LocalSet[]
}

interface FormState {
  date: string
  name: string
  notes: string
  bodyweight: number | ''
  sleep_quality: number
  fatigue_level: number
  exercises: LocalExercise[]
}

const RPE_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const SET_TYPES: LocalSet['type'][] = ['warmup', 'working', 'backoff', 'amrap']

let keyCounter = 0
function nextKey() {
  return `k${++keyCounter}`
}

function emptySet(num: number): LocalSet {
  return {
    key: nextKey(),
    set_number: num,
    weight_lbs: '',
    reps: '',
    rpe: '',
    type: 'working',
    notes: '',
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ── Star rating component ──

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (v: number) => void
  label: string
}) {
  return (
    <div>
      <label className="text-text-muted text-sm font-medium block mb-1">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="focus:outline-none"
          >
            <Star
              size={20}
              className={n <= value ? 'text-accent fill-accent' : 'text-surface-light'}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main component ──

export default function WorkoutDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id
  const initialDate = searchParams.get('date') || todayStr()

  const [form, setForm] = useState<FormState>({
    date: initialDate,
    name: '',
    notes: '',
    bodyweight: '',
    sleep_quality: 3,
    fatigue_level: 3,
    exercises: [],
  })

  const [exerciseSearch, setExerciseSearch] = useState('')
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [prNotifications, setPrNotifications] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Fetch existing workout
  const workoutQuery = useQuery<Workout>({
    queryKey: ['workout', id],
    queryFn: () => workouts.getById(Number(id)),
    enabled: !isNew,
  })

  // Fetch exercise library
  const exerciseListQuery = useQuery<Exercise[]>({
    queryKey: ['exercises'],
    queryFn: exercisesApi.list,
  })

  // Populate form from fetched workout
  useEffect(() => {
    if (workoutQuery.data) {
      const w = workoutQuery.data
      setForm({
        date: w.date.slice(0, 10),
        name: w.name || '',
        notes: w.notes || '',
        bodyweight: w.bodyweight_lbs ?? '',
        sleep_quality: w.sleep_quality ?? 3,
        fatigue_level: w.fatigue_level ?? 3,
        exercises: w.exercises.map((ex) => ({
          key: nextKey(),
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise.name,
          order: ex.order_index,
          notes: ex.notes || '',
          sets: ex.sets.map((s) => ({
            key: nextKey(),
            set_number: s.set_number,
            weight_lbs: s.weight_lbs,
            reps: s.reps,
            rpe: s.rpe ?? '',
            type: (s.set_type === 'warmup' ? 'warmup' : s.set_type === 'backoff' ? 'backoff' : s.set_type === 'amrap' ? 'amrap' : 'working') as LocalSet['type'],
            notes: s.notes || '',
          })),
        })),
      })
    }
  }, [workoutQuery.data])

  // ── Mutations ──

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: WorkoutCreate = {
        date: form.date,
        name: form.name || undefined,
        notes: form.notes || undefined,
        bodyweight_lbs: form.bodyweight ? Number(form.bodyweight) : undefined,
        sleep_quality: form.sleep_quality,
        fatigue_level: form.fatigue_level,
        exercises: form.exercises
          .filter((e) => e.exercise_id !== null)
          .map((e) => ({
            exercise_id: e.exercise_id!,
            order_index: e.order,
            notes: e.notes || undefined,
            sets: e.sets.map((s) => ({
              set_number: s.set_number,
              weight_lbs: Number(s.weight_lbs) || 0,
              reps: Number(s.reps) || 0,
              rpe: s.rpe ? Number(s.rpe) : undefined,
              set_type: s.type,
              notes: s.notes || undefined,
            })),
          })),
      }
      if (isNew) {
        return workouts.create(payload)
      }
      return workouts.update(Number(id), payload)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
      queryClient.invalidateQueries({ queryKey: ['workout', String(data.id)] })
      if (isNew) {
        navigate(`/workouts/${data.id}`, { replace: true })
      }
    },
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      // Save first, then complete
      let workout: Workout
      const payload: WorkoutCreate = {
        date: form.date,
        name: form.name || undefined,
        notes: form.notes || undefined,
        bodyweight_lbs: form.bodyweight ? Number(form.bodyweight) : undefined,
        sleep_quality: form.sleep_quality,
        fatigue_level: form.fatigue_level,
        exercises: form.exercises
          .filter((e) => e.exercise_id !== null)
          .map((e) => ({
            exercise_id: e.exercise_id!,
            order_index: e.order,
            notes: e.notes || undefined,
            sets: e.sets.map((s) => ({
              set_number: s.set_number,
              weight_lbs: Number(s.weight_lbs) || 0,
              reps: Number(s.reps) || 0,
              rpe: s.rpe ? Number(s.rpe) : undefined,
              set_type: s.type,
              notes: s.notes || undefined,
            })),
          })),
      }
      if (isNew) {
        workout = await workouts.create(payload)
      } else {
        workout = await workouts.update(Number(id), payload)
      }
      return workouts.complete(workout.id)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
      queryClient.invalidateQueries({ queryKey: ['prs'] })
      // Check for new PRs
      const newPrs = data.exercises.flatMap((ex) =>
        ex.sets.filter((s) => s.is_pr).map((s) => `${ex.exercise.name}: ${s.weight_lbs} lbs x ${s.reps}`),
      )
      if (newPrs.length > 0) {
        setPrNotifications(newPrs)
      }
      if (isNew) {
        navigate(`/workouts/${data.id}`, { replace: true })
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => workouts.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
      navigate('/workouts', { replace: true })
    },
  })

  // ── Form helpers ──

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((f) => ({ ...f, [key]: value }))
    },
    [],
  )

  const addExercise = useCallback((exercise: Exercise) => {
    setForm((f) => ({
      ...f,
      exercises: [
        ...f.exercises,
        {
          key: nextKey(),
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          order: f.exercises.length + 1,
          notes: '',
          sets: [emptySet(1)],
        },
      ],
    }))
    setShowExercisePicker(false)
    setExerciseSearch('')
  }, [])

  const removeExercise = useCallback((key: string) => {
    setForm((f) => ({
      ...f,
      exercises: f.exercises
        .filter((e) => e.key !== key)
        .map((e, i) => ({ ...e, order: i + 1 })),
    }))
  }, [])

  const updateExerciseNotes = useCallback((key: string, notes: string) => {
    setForm((f) => ({
      ...f,
      exercises: f.exercises.map((e) => (e.key === key ? { ...e, notes } : e)),
    }))
  }, [])

  const addSet = useCallback((exKey: string) => {
    setForm((f) => ({
      ...f,
      exercises: f.exercises.map((e) =>
        e.key === exKey
          ? { ...e, sets: [...e.sets, emptySet(e.sets.length + 1)] }
          : e,
      ),
    }))
  }, [])

  const removeSet = useCallback((exKey: string, setKey: string) => {
    setForm((f) => ({
      ...f,
      exercises: f.exercises.map((e) =>
        e.key === exKey
          ? {
              ...e,
              sets: e.sets
                .filter((s) => s.key !== setKey)
                .map((s, i) => ({ ...s, set_number: i + 1 })),
            }
          : e,
      ),
    }))
  }, [])

  const updateSet = useCallback(
    (exKey: string, setKey: string, field: keyof LocalSet, value: unknown) => {
      setForm((f) => ({
        ...f,
        exercises: f.exercises.map((e) =>
          e.key === exKey
            ? {
                ...e,
                sets: e.sets.map((s) =>
                  s.key === setKey ? { ...s, [field]: value } : s,
                ),
              }
            : e,
        ),
      }))
    },
    [],
  )

  // ── Filtered exercise list for picker ──
  const filteredExercises = (exerciseListQuery.data ?? []).filter((ex) =>
    ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()),
  )

  const isWorkoutLoading = !isNew && workoutQuery.isLoading

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* PR Notifications */}
      {prNotifications.length > 0 && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-5">
          <h3 className="text-accent font-bold text-lg mb-2">New Personal Records!</h3>
          <ul className="space-y-1">
            {prNotifications.map((pr, i) => (
              <li key={i} className="text-text flex items-center gap-2">
                <Star size={16} className="text-accent fill-accent" /> {pr}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setPrNotifications([])}
            className="mt-3 text-sm text-text-muted hover:text-text"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/workouts')}
            className="p-2 text-text-muted hover:text-text hover:bg-surface-light rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-3xl font-bold text-text">
            {isNew ? 'New Workout' : 'Edit Workout'}
          </h1>
        </div>
        <div className="flex gap-3">
          {!isNew && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-danger text-sm">Delete workout?</span>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-2 bg-danger/20 text-danger hover:bg-danger/30 px-3 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-light transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 text-text-muted hover:text-danger hover:bg-danger/10 px-3 py-2 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )
          )}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || completeMutation.isPending}
            className="flex items-center gap-2 bg-surface hover:bg-surface-light border border-surface-light text-text px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => completeMutation.mutate()}
            disabled={saveMutation.isPending || completeMutation.isPending}
            className="flex items-center gap-2 bg-success hover:bg-success/80 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <CheckCircle size={16} />
            {completeMutation.isPending ? 'Completing...' : 'Complete Workout'}
          </button>
        </div>
      </div>

      {/* Save/complete error */}
      {(saveMutation.isError || completeMutation.isError) && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger text-sm">
          Failed to save workout. Please try again.
        </div>
      )}

      {isWorkoutLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isWorkoutLoading && (
        <>
          {/* Metadata fields */}
          <div className="bg-surface rounded-xl p-5 border border-surface-light space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-text-muted text-sm font-medium block mb-1">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => updateField('date', e.target.value)}
                  className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-text-muted text-sm font-medium block mb-1">
                  Workout Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Heavy Squat Day"
                  className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-text-muted text-sm font-medium block mb-1">
                  Bodyweight (lbs)
                </label>
                <input
                  type="number"
                  value={form.bodyweight}
                  onChange={(e) =>
                    updateField('bodyweight', e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="e.g. 185"
                  className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StarRating
                label="Sleep Quality"
                value={form.sleep_quality}
                onChange={(v) => updateField('sleep_quality', v)}
              />
              <StarRating
                label="Fatigue Level"
                value={form.fatigue_level}
                onChange={(v) => updateField('fatigue_level', v)}
              />
              <div>
                <label className="text-text-muted text-sm font-medium block mb-1">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Session notes..."
                  className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Exercise blocks */}
          {form.exercises.map((ex) => (
            <div
              key={ex.key}
              className="bg-surface rounded-xl border border-surface-light overflow-hidden"
            >
              {/* Exercise header */}
              <div className="flex items-center justify-between p-4 border-b border-surface-light">
                <div className="flex items-center gap-3">
                  <GripVertical size={16} className="text-text-muted" />
                  <h3 className="text-text font-semibold text-lg">
                    {ex.exercise_name || 'Select Exercise'}
                  </h3>
                </div>
                <button
                  onClick={() => removeExercise(ex.key)}
                  className="p-1.5 text-text-muted hover:text-danger rounded transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Per-exercise notes */}
              <div className="px-4 pt-3">
                <textarea
                  value={ex.notes}
                  onChange={(e) => updateExerciseNotes(ex.key, e.target.value)}
                  placeholder="Exercise notes..."
                  rows={1}
                  className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Sets table */}
              <div className="p-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-muted text-left">
                      <th className="pb-2 pr-2 w-12">Set</th>
                      <th className="pb-2 pr-2 w-28">Weight (lbs)</th>
                      <th className="pb-2 pr-2 w-20">Reps</th>
                      <th className="pb-2 pr-2 w-24">RPE</th>
                      <th className="pb-2 pr-2 w-28">Type</th>
                      <th className="pb-2 pr-2">Notes</th>
                      <th className="pb-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ex.sets.map((s) => (
                      <tr key={s.key} className="border-t border-surface-light/50">
                        <td className="py-2 pr-2 text-text-muted font-medium">
                          {s.set_number}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            value={s.weight_lbs}
                            onChange={(e) =>
                              updateSet(
                                ex.key,
                                s.key,
                                'weight_lbs',
                                e.target.value === '' ? '' : Number(e.target.value),
                              )
                            }
                            className="w-full bg-bg border border-surface-light rounded px-2 py-1.5 text-text focus:outline-none focus:border-primary"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            value={s.reps}
                            onChange={(e) =>
                              updateSet(
                                ex.key,
                                s.key,
                                'reps',
                                e.target.value === '' ? '' : Number(e.target.value),
                              )
                            }
                            className="w-full bg-bg border border-surface-light rounded px-2 py-1.5 text-text focus:outline-none focus:border-primary"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            value={s.rpe}
                            onChange={(e) =>
                              updateSet(
                                ex.key,
                                s.key,
                                'rpe',
                                e.target.value === '' ? '' : Number(e.target.value),
                              )
                            }
                            className="w-full bg-bg border border-surface-light rounded px-2 py-1.5 text-text focus:outline-none focus:border-primary"
                          >
                            <option value="">--</option>
                            {RPE_OPTIONS.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            value={s.type}
                            onChange={(e) =>
                              updateSet(ex.key, s.key, 'type', e.target.value)
                            }
                            className="w-full bg-bg border border-surface-light rounded px-2 py-1.5 text-text focus:outline-none focus:border-primary"
                          >
                            {SET_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={s.notes}
                            onChange={(e) =>
                              updateSet(ex.key, s.key, 'notes', e.target.value)
                            }
                            className="w-full bg-bg border border-surface-light rounded px-2 py-1.5 text-text focus:outline-none focus:border-primary"
                            placeholder=""
                          />
                        </td>
                        <td className="py-2">
                          {ex.sets.length > 1 && (
                            <button
                              onClick={() => removeSet(ex.key, s.key)}
                              className="p-1 text-text-muted hover:text-danger transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={() => addSet(ex.key)}
                  className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:text-primary-dark font-medium transition-colors"
                >
                  <Plus size={14} /> Add Set
                </button>
              </div>
            </div>
          ))}

          {/* Add Exercise */}
          <div className="relative">
            <button
              onClick={() => setShowExercisePicker((v) => !v)}
              className="w-full flex items-center justify-center gap-2 p-4 bg-surface border-2 border-dashed border-surface-light rounded-xl text-text-muted hover:text-text hover:border-primary/30 transition-colors"
            >
              <Plus size={18} /> Add Exercise
            </button>

            {showExercisePicker && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-surface-light rounded-xl shadow-xl z-20 max-h-80 overflow-hidden flex flex-col">
                <div className="p-3 border-b border-surface-light">
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                    <input
                      type="text"
                      value={exerciseSearch}
                      onChange={(e) => setExerciseSearch(e.target.value)}
                      placeholder="Search exercises..."
                      autoFocus
                      className="w-full bg-bg border border-surface-light rounded-lg pl-9 pr-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">
                  {exerciseListQuery.isLoading && (
                    <p className="p-4 text-text-muted text-sm">Loading exercises...</p>
                  )}
                  {filteredExercises.length === 0 && !exerciseListQuery.isLoading && (
                    <p className="p-4 text-text-muted text-sm">No exercises found.</p>
                  )}
                  {filteredExercises.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => addExercise(ex)}
                      className="w-full text-left px-4 py-2.5 hover:bg-surface-light transition-colors flex items-center justify-between"
                    >
                      <span className="text-text">{ex.name}</span>
                      <span className="text-text-muted text-xs capitalize">{ex.category}</span>
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-surface-light">
                  <button
                    onClick={() => {
                      setShowExercisePicker(false)
                      setExerciseSearch('')
                    }}
                    className="w-full text-sm text-text-muted hover:text-text py-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
