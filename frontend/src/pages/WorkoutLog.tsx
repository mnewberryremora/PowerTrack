import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Calendar, Dumbbell, ChevronLeft, ChevronRight, FileSpreadsheet, Download, Trash2, Copy, X } from 'lucide-react'
import { workouts } from '../api/client'
import type { WorkoutSummary } from '../types'
import { formatDate as _formatDate } from '../utils/date'

function formatDate(iso: string) {
  return _formatDate(iso, { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function WorkoutLog() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [monthOffset, setMonthOffset] = useState(0)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [copyingId, setCopyingId] = useState<number | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportStart, setExportStart] = useState('')
  const [exportEnd, setExportEnd] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)

  const { start, end, label } = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + monthOffset)
    const s = new Date(d.getFullYear(), d.getMonth(), 1)
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return {
      start: s.toISOString().slice(0, 10),
      end: e.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    }
  }, [monthOffset])

  const { data, isLoading, isError } = useQuery<WorkoutSummary[]>({
    queryKey: ['workouts', start, end],
    queryFn: () => workouts.list({ start_date: start, end_date: end }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => workouts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
      setConfirmDeleteId(null)
    },
  })

  const copyMutation = useMutation({
    mutationFn: (id: number) => workouts.copy(id),
    onMutate: (id) => setCopyingId(id),
    onSuccess: (newWorkout) => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
      navigate(`/workouts/${newWorkout.id}`)
    },
    onSettled: () => setCopyingId(null),
  })

  const exportMutation = useMutation({
    mutationFn: () =>
      workouts.export({
        start_date: exportStart || undefined,
        end_date: exportEnd || undefined,
      }),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const parts = ['training_export']
      if (exportStart) parts.push(exportStart)
      if (exportEnd) parts.push(exportEnd)
      a.download = parts.join('_') + '.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setExportOpen(false)
      setExportError(null)
    },
    onError: () => {
      setExportError('Export failed. Please try again.')
    },
  })

  const openExport = () => {
    setExportStart(start)
    setExportEnd(end)
    setExportError(null)
    setExportOpen(true)
  }

  const sorted = (data ?? []).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-text">Workout Log</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={openExport}
            className="flex items-center gap-2 bg-surface hover:bg-surface-light border border-surface-light text-text px-4 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Download size={18} /> Export XLSX
          </button>
          <Link
            to="/import"
            className="flex items-center gap-2 bg-surface hover:bg-surface-light border border-surface-light text-text px-4 py-2.5 rounded-lg font-medium transition-colors"
          >
            <FileSpreadsheet size={18} /> Import XLSX
          </Link>
          <Link
            to="/workouts/new"
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Plus size={18} /> New Workout
          </Link>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-4 bg-surface rounded-lg p-3 border border-surface-light w-fit">
        <button
          onClick={() => setMonthOffset((o) => o - 1)}
          className="p-1 hover:bg-surface-light rounded transition-colors text-text-muted hover:text-text"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-text font-medium min-w-[160px] text-center">{label}</span>
        <button
          onClick={() => setMonthOffset((o) => o + 1)}
          disabled={monthOffset >= 0}
          className="p-1 hover:bg-surface-light rounded transition-colors text-text-muted hover:text-text disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Error */}
      {isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger">
          Failed to load workouts.
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Workout list */}
      {!isLoading && !isError && (
        <>
          {sorted.length === 0 ? (
            <div className="text-center py-16">
              <Dumbbell size={48} className="mx-auto text-text-muted mb-4" />
              <p className="text-text-muted text-lg">No workouts this month.</p>
              <Link
                to="/workouts/new"
                className="inline-block mt-4 text-primary hover:text-primary-dark font-medium"
              >
                Log your first workout
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((w) => (
                <div
                  key={w.id}
                  className="bg-surface rounded-xl border border-surface-light hover:border-primary/30 transition-colors"
                >
                  {confirmDeleteId === w.id ? (
                    <div className="flex items-center justify-between p-4">
                      <span className="text-danger text-sm">
                        Delete &quot;{w.name || 'Workout'}&quot; on {formatDate(w.date)}?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => deleteMutation.mutate(w.id)}
                          disabled={deleteMutation.isPending}
                          className="px-3 py-1.5 rounded-lg text-sm bg-danger/20 text-danger hover:bg-danger/30 transition-colors disabled:opacity-50"
                        >
                          {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:text-text hover:bg-surface-light transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Link
                        to={`/workouts/${w.id}`}
                        className="flex-1 flex items-center justify-between p-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Calendar size={18} className="text-primary" />
                          </div>
                          <div>
                            <p className="text-text font-medium">
                              {w.name || 'Workout'}
                            </p>
                            <p className="text-text-muted text-sm">{formatDate(w.date)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <span className="text-text-muted">
                            {w.exercise_count} exercise{w.exercise_count !== 1 ? 's' : ''}
                          </span>
                          {w.total_volume_lbs > 0 && (
                            <span className="text-text-muted">
                              {Math.round(w.total_volume_lbs).toLocaleString()} lbs vol
                            </span>
                          )}
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              w.status === 'completed'
                                ? 'bg-success/20 text-success'
                                : w.status === 'in_progress'
                                  ? 'bg-accent/20 text-accent'
                                  : 'bg-surface-light text-text-muted'
                            }`}
                          >
                            {w.status.replace('_', ' ')}
                          </span>
                        </div>
                      </Link>
                      <button
                        onClick={() => copyMutation.mutate(w.id)}
                        disabled={copyingId === w.id}
                        className="p-3 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Copy workout"
                      >
                        {copyingId === w.id
                          ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          : <Copy size={16} />
                        }
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(w.id)}
                        className="p-3 mr-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                        title="Delete workout"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {exportOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => !exportMutation.isPending && setExportOpen(false)}
        >
          <div
            className="bg-surface rounded-xl border border-surface-light p-6 w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text flex items-center gap-2">
                <Download size={18} className="text-primary" /> Export workouts to XLSX
              </h2>
              <button
                onClick={() => setExportOpen(false)}
                disabled={exportMutation.isPending}
                className="text-text-muted hover:text-text disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-text-muted text-sm">
              Each row is one set, with workout metadata and bodyweight-aware load / volume / e1RM columns.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-text-muted text-xs font-medium">Start date</span>
                <input
                  type="date"
                  value={exportStart}
                  onChange={(e) => setExportStart(e.target.value)}
                  className="mt-1 w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text"
                />
              </label>
              <label className="block">
                <span className="text-text-muted text-xs font-medium">End date</span>
                <input
                  type="date"
                  value={exportEnd}
                  onChange={(e) => setExportEnd(e.target.value)}
                  className="mt-1 w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text"
                />
              </label>
            </div>
            <p className="text-text-muted text-xs">Leave either blank to go unbounded in that direction.</p>
            {exportError && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-danger text-sm">
                {exportError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setExportOpen(false)}
                disabled={exportMutation.isPending}
                className="px-4 py-2 rounded-lg text-text-muted hover:text-text transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {exportMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download size={16} /> Download
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
