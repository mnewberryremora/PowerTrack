import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Sparkles, Calendar, ChevronDown, ChevronUp, X, BookOpen,
} from 'lucide-react'
import { programs } from '../api/client'
import type { Program, ProgramCreate } from '../types'
import { formatDate } from '../utils/date'

const GOALS = ['strength', 'hypertrophy', 'peaking', 'general'] as const

function statusBadge(program: Program) {
  if (program.status === 'active') {
    return { label: 'Active', cls: 'bg-success/20 text-success' }
  }
  if (program.status === 'completed') {
    return { label: 'Completed', cls: 'bg-text-muted/20 text-text-muted' }
  }
  return { label: program.status || 'Draft', cls: 'bg-accent/20 text-accent' }
}

export default function Programs() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [weeks, setWeeks] = useState<number | ''>(8)
  const [goal, setGoal] = useState('strength')

  const { data: programList, isLoading, isError } = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: programs.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: ProgramCreate) => programs.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] })
      resetForm()
    },
  })

  const resetForm = () => {
    setName('')
    setDescription('')
    setWeeks(8)
    setGoal('strength')
    setShowForm(false)
  }

  const handleCreate = () => {
    if (!name.trim() || !weeks) return
    createMutation.mutate({
      name: name.trim(),
      description: description || undefined,
      program_data: { duration_weeks: Number(weeks), goal },
    })
  }

  const sorted = (programList ?? []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-text">Programs</h1>
        <div className="flex gap-3">
          <button
            className="flex items-center gap-2 bg-surface border border-surface-light text-text-muted px-4 py-2.5 rounded-lg font-medium cursor-not-allowed opacity-60"
            disabled
            title="Coming soon"
          >
            <Sparkles size={16} /> Generate with AI
            <span className="px-1.5 py-0.5 bg-accent/20 text-accent rounded text-[10px] font-medium ml-1">
              SOON
            </span>
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Plus size={18} /> New Program
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-surface rounded-xl p-5 border border-surface-light space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Create Program</h2>
            <button onClick={resetForm} className="text-text-muted hover:text-text">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="text-text-muted text-sm font-medium block mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 12-Week Peaking Block"
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">
                Duration (weeks)
              </label>
              <input
                type="number"
                min={1}
                max={52}
                value={weeks}
                onChange={(e) =>
                  setWeeks(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">Goal</label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
              >
                {GOALS.map((g) => (
                  <option key={g} value={g}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-text-muted text-sm font-medium block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Program description and notes..."
              rows={3}
              className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary resize-none"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={createMutation.isPending || !name.trim() || !weeks}
            className="bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Program'}
          </button>
          {createMutation.isError && (
            <p className="text-danger text-sm">Failed to create program.</p>
          )}
        </div>
      )}

      {isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger">
          Failed to load programs.
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {sorted.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen size={48} className="mx-auto text-text-muted mb-4" />
              <p className="text-text-muted text-lg">No programs yet.</p>
              <p className="text-text-muted text-sm mt-1">
                Create a program to structure your training.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sorted.map((prog) => {
                const badge = statusBadge(prog)
                const expanded = expandedId === prog.id
                const template = prog.program_data as
                  | Record<string, Record<string, Array<{ exercise: string; sets: number; reps: string; intensity: string }>>>
                  | null
                  | undefined

                return (
                  <div
                    key={prog.id}
                    className="bg-surface rounded-xl border border-surface-light overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedId(expanded ? null : prog.id)}
                      className="w-full p-5 text-left flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-text font-semibold text-lg">{prog.name}</h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                          {prog.ai_generated && (
                            <span className="px-2 py-0.5 bg-primary/20 text-primary rounded text-xs font-medium flex items-center gap-1">
                              <Sparkles size={10} /> AI
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-text-muted text-sm">
                          {prog.start_date && prog.end_date && (
                            <span className="flex items-center gap-1">
                              <Calendar size={14} /> {formatDate(prog.start_date)} – {formatDate(prog.end_date)}
                            </span>
                          )}
                          <span>{formatDate(prog.created_at)}</span>
                        </div>
                        {prog.description && (
                          <p className="text-text-muted text-sm mt-2">{prog.description}</p>
                        )}
                      </div>
                      {expanded ? (
                        <ChevronUp size={18} className="text-text-muted" />
                      ) : (
                        <ChevronDown size={18} className="text-text-muted" />
                      )}
                    </button>

                    {expanded && (
                      <div className="border-t border-surface-light p-5">
                        {template && Object.keys(template).length > 0 ? (
                          <div className="space-y-4">
                            {Object.entries(template).map(([week, days]) => (
                              <div key={week}>
                                <h4 className="text-text font-medium mb-2 capitalize">{week}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {Object.entries(days).map(([day, exs]) => (
                                    <div
                                      key={day}
                                      className="bg-bg rounded-lg p-3 border border-surface-light"
                                    >
                                      <p className="text-text-muted text-xs font-medium mb-2 capitalize">
                                        {day}
                                      </p>
                                      {(exs as Array<{ exercise: string; sets: number; reps: string; intensity: string }>).map(
                                        (item, i) => (
                                          <div
                                            key={i}
                                            className="flex items-center justify-between text-sm py-1"
                                          >
                                            <span className="text-text">{item.exercise}</span>
                                            <span className="text-text-muted text-xs">
                                              {item.sets}x{item.reps}{' '}
                                              {item.intensity && `@${item.intensity}`}
                                            </span>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-text-muted text-sm">
                            No template data yet. This program does not have a detailed week/day
                            structure configured.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
