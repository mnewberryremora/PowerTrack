import { useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  Download,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
} from 'lucide-react'
import { workouts, ai } from '../api/client'
import type { ImportPreview, ImportPreviewWorkout, ImportResult } from '../types'

type Step = 'upload' | 'preview' | 'done'

export default function ImportWorkouts() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [exerciseMap, setExerciseMap] = useState<Record<string, number>>({})
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [useAI, setUseAI] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Upload handlers ──

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('Please select an .xlsx or .xls file.')
      return
    }
    setFile(f)
    setError(null)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback(() => setDragOver(false), [])

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile],
  )

  const uploadFile = useCallback(async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const data: ImportPreview = useAI
        ? await ai.importXlsx(file)
        : await workouts.importPreview(file)
      setPreview(data)
      // Pre-populate exercise map with already-matched exercises
      const map: Record<string, number> = {}
      data.workouts.forEach((w) =>
        w.exercises.forEach((ex) => {
          if (ex.matched_exercise_id !== null) {
            map[ex.name] = ex.matched_exercise_id
          }
        }),
      )
      setExerciseMap(map)
      setStep('preview')
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to parse file.')
    } finally {
      setLoading(false)
    }
  }, [file, useAI])

  const downloadTemplate = useCallback(async () => {
    try {
      const blob = await workouts.importTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'workout_import_template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Failed to download template.')
    }
  }, [])

  // ── Confirm import ──

  const confirmImport = useCallback(async () => {
    if (!preview) return
    setLoading(true)
    setError(null)
    try {
      const data: ImportResult = await workouts.importConfirm({
        workouts: preview.workouts,
        exercise_map: exerciseMap,
      })
      setResult(data)
      setStep('done')
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Import failed.')
    } finally {
      setLoading(false)
    }
  }, [preview, exerciseMap])

  // ── Exercise mapping handler ──

  const updateMapping = useCallback((exerciseName: string, exerciseId: number | null) => {
    setExerciseMap((prev) => {
      if (exerciseId === null) {
        const next = { ...prev }
        delete next[exerciseName]
        return next
      }
      return { ...prev, [exerciseName]: exerciseId }
    })
  }, [])

  // ── Render helpers ──

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-text">Import Workouts</h1>
        {step !== 'upload' && step !== 'done' && (
          <button
            onClick={() => {
              setStep('upload')
              setPreview(null)
              setFile(null)
              setError(null)
            }}
            className="flex items-center gap-2 text-text-muted hover:text-text text-sm transition-colors"
          >
            <ArrowLeft size={16} /> Start Over
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 text-sm">
        <StepBadge num={1} label="Upload" active={step === 'upload'} done={step !== 'upload'} />
        <ArrowRight size={14} className="text-text-muted" />
        <StepBadge num={2} label="Preview & Map" active={step === 'preview'} done={step === 'done'} />
        <ArrowRight size={14} className="text-text-muted" />
        <StepBadge num={3} label="Done" active={step === 'done'} done={false} />
      </div>

      {/* Global error */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
          <div className="flex-1 text-danger text-sm">{error}</div>
          <button onClick={() => setError(null)} className="text-danger hover:text-danger/70">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ═══════ STEP 1: UPLOAD ═══════ */}
      {step === 'upload' && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              dragOver
                ? 'border-primary bg-primary/5'
                : file
                  ? 'border-success/50 bg-success/5'
                  : 'border-surface-light bg-surface hover:border-primary/30'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={onFileChange}
              className="hidden"
            />
            {file ? (
              <>
                <FileSpreadsheet size={40} className="text-success mb-3" />
                <p className="text-text font-medium">{file.name}</p>
                <p className="text-text-muted text-sm mt-1">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <p className="text-text-muted text-xs mt-2">Click or drop to replace</p>
              </>
            ) : (
              <>
                <Upload size={40} className="text-text-muted mb-3" />
                <p className="text-text font-medium">Drop your .xlsx file here</p>
                <p className="text-text-muted text-sm mt-1">or click to browse</p>
              </>
            )}
          </div>

          {/* AI toggle */}
          <div className="bg-surface rounded-xl border border-surface-light p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setUseAI((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  useAI ? 'bg-accent' : 'bg-surface-light'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                    useAI ? 'translate-x-5' : ''
                  }`}
                />
              </div>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className={useAI ? 'text-accent' : 'text-text-muted'} />
                <span className="text-text font-medium">AI-Powered Import</span>
              </div>
            </label>
            <p className="text-text-muted text-xs mt-2 ml-14">
              {useAI
                ? 'AI will interpret any spreadsheet format — no specific column names needed.'
                : 'Standard import requires columns: Date, Exercise, Weight, Reps.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 text-primary hover:text-primary-dark text-sm font-medium transition-colors"
            >
              <Download size={16} /> Download Template
            </button>

            <button
              onClick={uploadFile}
              disabled={!file || loading}
              className={`flex items-center gap-2 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                useAI
                  ? 'bg-accent hover:bg-accent/80'
                  : 'bg-primary hover:bg-primary-dark'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {useAI ? 'AI is reading...' : 'Parsing...'}
                </>
              ) : (
                <>
                  {useAI ? <Sparkles size={16} /> : <Upload size={16} />}
                  {useAI ? 'AI Import' : 'Upload & Preview'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══════ STEP 2: PREVIEW & MAP ═══════ */}
      {step === 'preview' && preview && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Workouts" value={preview.stats.total_workouts} />
            <StatCard label="Total Sets" value={preview.stats.total_sets} />
            <StatCard label="Date Range" value={preview.stats.date_range} text />
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 space-y-2">
              <h3 className="text-accent font-semibold flex items-center gap-2">
                <AlertTriangle size={16} /> Warnings
              </h3>
              <ul className="text-text text-sm space-y-1">
                {preview.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">-</span> {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Unmatched exercises mapping */}
          {preview.unmatched_exercises.length > 0 && (
            <div className="bg-surface rounded-xl border border-surface-light p-5 space-y-4">
              <h3 className="text-text font-semibold text-lg">Map Unmatched Exercises</h3>
              <p className="text-text-muted text-sm">
                The following exercises could not be auto-matched. Map them to existing exercises or
                leave unmapped to create new ones.
              </p>
              <div className="space-y-3">
                {preview.unmatched_exercises.map((name) => {
                  const suggestedId = preview.exercise_suggestions[name]
                  return (
                    <div
                      key={name}
                      className="flex items-center gap-4 flex-wrap sm:flex-nowrap"
                    >
                      <span className="text-text font-medium min-w-[180px]">{name}</span>
                      <ArrowRight size={14} className="text-text-muted shrink-0 hidden sm:block" />
                      <div className="relative flex-1 min-w-[200px]">
                        <input
                          type="number"
                          value={exerciseMap[name] ?? suggestedId ?? ''}
                          onChange={(e) =>
                            updateMapping(
                              name,
                              e.target.value === '' ? null : Number(e.target.value),
                            )
                          }
                          placeholder="Exercise ID (leave blank to create new)"
                          className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="bg-surface rounded-xl border border-surface-light overflow-hidden">
            <div className="p-4 border-b border-surface-light">
              <h3 className="text-text font-semibold text-lg">Workout Preview</h3>
            </div>
            <div className="divide-y divide-surface-light">
              {preview.workouts.map((w, wi) => (
                <WorkoutPreviewRow key={wi} workout={w} />
              ))}
            </div>
          </div>

          {/* Confirm */}
          <div className="flex justify-end">
            <button
              onClick={confirmImport}
              disabled={loading}
              className="flex items-center gap-2 bg-success hover:bg-success/80 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Check size={16} /> Import {preview.stats.total_workouts} Workout
                  {preview.stats.total_workouts !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══════ STEP 3: DONE ═══════ */}
      {step === 'done' && result && (
        <div className="bg-surface rounded-xl border border-surface-light p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto">
            <Check size={32} className="text-success" />
          </div>
          <h2 className="text-text text-2xl font-bold">Import Complete</h2>
          <div className="flex justify-center gap-8 text-sm">
            <div>
              <p className="text-text-muted">Workouts Created</p>
              <p className="text-text text-2xl font-bold">{result.created}</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-left mt-4">
              <h4 className="text-danger font-semibold text-sm mb-2">Errors</h4>
              <ul className="text-danger text-sm space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i}>- {e}</li>
                ))}
              </ul>
            </div>
          )}

          <Link
            to="/workouts"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-lg font-medium transition-colors mt-4"
          >
            Go to Workout Log <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──

function StepBadge({
  num,
  label,
  active,
  done,
}: {
  num: number
  label: string
  active: boolean
  done: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          done
            ? 'bg-success text-white'
            : active
              ? 'bg-primary text-white'
              : 'bg-surface-light text-text-muted'
        }`}
      >
        {done ? <Check size={12} /> : num}
      </div>
      <span className={active ? 'text-text font-medium' : 'text-text-muted'}>{label}</span>
    </div>
  )
}

function StatCard({
  label,
  value,
  text,
}: {
  label: string
  value: number | string
  text?: boolean
}) {
  return (
    <div className="bg-surface rounded-xl border border-surface-light p-4">
      <p className="text-text-muted text-sm">{label}</p>
      <p className={`text-text font-bold ${text ? 'text-base mt-1' : 'text-2xl'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  )
}

function WorkoutPreviewRow({ workout }: { workout: ImportPreviewWorkout }) {
  const [expanded, setExpanded] = useState(false)
  const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-light/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <FileSpreadsheet size={16} className="text-primary shrink-0" />
          <div>
            <p className="text-text font-medium">
              {new Date(workout.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <p className="text-text-muted text-xs">{workout.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-text-muted">
          <span>
            {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
          </span>
          <span>{totalSets} sets</span>
          <ChevronDown
            size={14}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {workout.exercises.map((ex, ei) => (
            <div key={ei} className="bg-bg rounded-lg p-3">
              <p className="text-text font-medium text-sm mb-2">
                {ex.name}
                {ex.matched_exercise_id === null && (
                  <span className="ml-2 text-xs text-accent">(new)</span>
                )}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-muted text-left">
                      <th className="pb-1 pr-3">Set</th>
                      <th className="pb-1 pr-3">Weight</th>
                      <th className="pb-1 pr-3">Reps</th>
                      <th className="pb-1 pr-3">RPE</th>
                      <th className="pb-1">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ex.sets.map((s, si) => (
                      <tr key={si} className="text-text">
                        <td className="py-0.5 pr-3">{s.set_number}</td>
                        <td className="py-0.5 pr-3">{s.weight_lbs} lbs</td>
                        <td className="py-0.5 pr-3">{s.reps}</td>
                        <td className="py-0.5 pr-3">{s.rpe ?? '-'}</td>
                        <td className="py-0.5">{s.set_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
