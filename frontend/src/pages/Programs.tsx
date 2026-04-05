import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Sparkles, Calendar, ChevronDown, ChevronUp, X, BookOpen, Loader2,
} from 'lucide-react'
import { programs } from '../api/client'
import type { Program, ProgramCreate, ProgramGenerate } from '../types'
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
  const [showAiForm, setShowAiForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [weeks, setWeeks] = useState<number | ''>(8)
  const [goal, setGoal] = useState('strength')

  // AI form state
  const [aiGoal, setAiGoal] = useState('Increase total and DOTS score')
  const [aiWeeks, setAiWeeks] = useState<number>(12)
  const [aiDays, setAiDays] = useState<number>(4)
  const [aiLevel, setAiLevel] = useState('intermediate')
  const [aiWeakPoints, setAiWeakPoints] = useState('')

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

  const generateMutation = useMutation({
    mutationFn: (data: ProgramGenerate) => programs.generate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] })
      setShowAiForm(false)
      setAiGoal('Increase total and DOTS score')
      setAiWeeks(12)
      setAiDays(4)
      setAiLevel('intermediate')
      setAiWeakPoints('')
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
            onClick={() => { setShowAiForm((v) => !v); setShowForm(false) }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors border ${
              showAiForm
                ? 'bg-primary/20 border-primary/30 text-primary'
                : 'bg-surface border-surface-light text-text-muted hover:text-text'
            }`}
          >
            <Sparkles size={16} /> Generate with AI
          </button>
          <button
            onClick={() => { setShowForm((v) => !v); setShowAiForm(false) }}
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

      {/* AI Generate form */}
      {showAiForm && (
        <div className="bg-surface rounded-xl p-5 border border-primary/20 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text flex items-center gap-2">
              <Sparkles size={18} className="text-primary" /> Generate Program with AI
            </h2>
            <button onClick={() => setShowAiForm(false)} className="text-text-muted hover:text-text">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="text-text-muted text-sm font-medium block mb-1">Goals</label>
              <input
                type="text"
                value={aiGoal}
                onChange={(e) => setAiGoal(e.target.value)}
                placeholder="e.g. Increase total and DOTS score"
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">Duration (weeks)</label>
              <input
                type="number"
                min={4}
                max={52}
                value={aiWeeks}
                onChange={(e) => setAiWeeks(Number(e.target.value))}
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">Days / Week</label>
              <input
                type="number"
                min={2}
                max={7}
                value={aiDays}
                onChange={(e) => setAiDays(Number(e.target.value))}
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">Experience Level</label>
              <select
                value={aiLevel}
                onChange={(e) => setAiLevel(e.target.value)}
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-text-muted text-sm font-medium block mb-1">Weak Points</label>
              <input
                type="text"
                value={aiWeakPoints}
                onChange={(e) => setAiWeakPoints(e.target.value)}
                placeholder="e.g. Bench lockout, squat depth"
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <button
            onClick={() => generateMutation.mutate({
              goals: aiGoal,
              program_length_weeks: aiWeeks,
              days_per_week: aiDays,
              experience_level: aiLevel,
              weak_points: aiWeakPoints || undefined,
            })}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Generating (this may take a minute)...</>
            ) : (
              <><Sparkles size={16} /> Generate Program</>
            )}
          </button>
          {generateMutation.isError && (
            <p className="text-danger text-sm">
              {(generateMutation.error as any)?.response?.data?.detail ?? 'Failed to generate program.'}
            </p>
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
                const pdata = prog.program_data as Record<string, any> | null | undefined

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
                        {pdata?.weeks && Array.isArray(pdata.weeks) && pdata.weeks.length > 0 ? (
                          /* AI-generated format: { weeks: [{ week_number, block, days: [{ day_number, name, exercises }] }] } */
                          <div className="space-y-4">
                            {pdata.weeks.map((wk: any) => (
                              <div key={wk.week_number}>
                                <h4 className="text-text font-medium mb-2">
                                  Week {wk.week_number}{wk.block ? ` — ${wk.block}` : ''}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {(wk.days ?? []).map((day: any) => (
                                    <div
                                      key={day.day_number}
                                      className="bg-bg rounded-lg p-3 border border-surface-light"
                                    >
                                      <p className="text-text-muted text-xs font-medium mb-2">
                                        Day {day.day_number}{day.name ? ` — ${day.name}` : ''}
                                      </p>
                                      {(day.exercises ?? []).map((ex: any, i: number) => (
                                        <div
                                          key={i}
                                          className="flex items-center justify-between text-sm py-1"
                                        >
                                          <span className="text-text">{ex.exercise_name}</span>
                                          <span className="text-text-muted text-xs">
                                            {ex.sets}x{ex.reps}
                                            {ex.intensity_pct ? ` @${ex.intensity_pct}%` : ''}
                                            {ex.rpe_target ? ` RPE ${ex.rpe_target}` : ''}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : pdata && Object.keys(pdata).some(k => k !== 'duration_weeks' && k !== 'goal') ? (
                          /* Legacy/manual format with week/day keys */
                          <div className="space-y-4">
                            {Object.entries(pdata).filter(([k]) => k !== 'duration_weeks' && k !== 'goal').map(([week, days]) => (
                              <div key={week}>
                                <h4 className="text-text font-medium mb-2 capitalize">{week}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {Object.entries(days as Record<string, any>).map(([day, exs]) => (
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
                          <div className="text-text-muted text-sm space-y-1">
                            {pdata?.goal && <p>Goal: <span className="text-text capitalize">{pdata.goal}</span></p>}
                            {pdata?.duration_weeks && <p>Duration: <span className="text-text">{pdata.duration_weeks} weeks</span></p>}
                            {!pdata?.goal && !pdata?.duration_weeks && (
                              <p>No program structure yet.</p>
                            )}
                          </div>
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
