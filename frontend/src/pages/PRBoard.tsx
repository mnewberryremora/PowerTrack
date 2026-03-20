import { useState, useMemo } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Trophy, Award, Filter, TrendingUp, RefreshCw } from 'lucide-react'
import { prs, exercises as exercisesApi, analytics } from '../api/client'
import type { PR, Exercise } from '../types'
import { formatDate, daysSince } from '../utils/date'

const REP_BUCKETS = [1, 2, 3, 5, 8, 10] as const

function isRecent(dateStr: string, days = 30) {
  return daysSince(dateStr) < days
}

interface ExercisePRRow {
  exerciseId: number
  exerciseName: string
  isCompetition: boolean
  repMap: Record<number, PR | undefined>
  bestE1RM: number | null
}

const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981']

export default function PRBoard() {
  const queryClient = useQueryClient()
  const [compOnly, setCompOnly] = useState(false)
  const [showCharts, setShowCharts] = useState(true)

  const recalcMutation = useMutation({
    mutationFn: () => prs.recalculate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prs'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })

  const prQuery = useQuery<PR[]>({ queryKey: ['prs'], queryFn: prs.list })
  const exQuery = useQuery<Exercise[]>({
    queryKey: ['exercises'],
    queryFn: exercisesApi.list,
  })

  // Get competition exercises for e1RM charts
  const compExercises = useMemo(() => {
    return (exQuery.data ?? []).filter((e) => e.is_competition)
  }, [exQuery.data])

  // Fetch e1RM progression for each competition lift
  const e1rmQueries = useQueries({
    queries: compExercises.map((ex) => ({
      queryKey: ['analytics', 'e1rm', ex.id],
      queryFn: () => analytics.e1rm(ex.id) as Promise<{ data: Array<{ date: string; e1rm: number | null; best_weight: number }> }>,
      enabled: showCharts && compExercises.length > 0,
    })),
  })

  const exerciseMap = useMemo(() => {
    const m = new Map<number, Exercise>()
    for (const ex of exQuery.data ?? []) m.set(ex.id, ex)
    return m
  }, [exQuery.data])

  const rows = useMemo(() => {
    const allPRs = prQuery.data ?? []
    // Group by exercise
    const byExercise = new Map<number, PR[]>()
    for (const pr of allPRs) {
      const list = byExercise.get(pr.exercise_id) ?? []
      list.push(pr)
      byExercise.set(pr.exercise_id, list)
    }

    const result: ExercisePRRow[] = []
    for (const [exId, prList] of byExercise) {
      const ex = exerciseMap.get(exId)
      const repMap: Record<number, PR | undefined> = {}
      for (const rep of REP_BUCKETS) {
        const matching = prList.filter((p) => p.rep_count === rep)
        if (matching.length > 0) {
          repMap[rep] = matching.sort((a, b) => b.weight_lbs - a.weight_lbs)[0]
        }
      }
      const bestE1RM = prList.reduce<number | null>(
        (best, p) => ((p.e1rm_lbs ?? 0) > (best ?? 0) ? (p.e1rm_lbs ?? 0) : best),
        null,
      )
      result.push({
        exerciseId: exId,
        exerciseName: prList[0]?.exercise_name ?? ex?.name ?? `Exercise #${exId}`,
        isCompetition: ex?.is_competition ?? false,
        repMap,
        bestE1RM,
      })
    }

    // Sort: competition first, then alphabetical
    result.sort((a, b) => {
      if (a.isCompetition !== b.isCompetition) return a.isCompetition ? -1 : 1
      return a.exerciseName.localeCompare(b.exerciseName)
    })

    return result
  }, [prQuery.data, exerciseMap])

  const filteredRows = compOnly ? rows.filter((r) => r.isCompetition) : rows

  const isLoading = prQuery.isLoading || exQuery.isLoading

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-text flex items-center gap-3">
          <Trophy size={28} className="text-accent" /> PR Board
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => recalcMutation.mutate()}
            disabled={recalcMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border bg-surface border-surface-light text-text-muted hover:text-text disabled:opacity-50"
            title="Rebuild all PRs from workout data"
          >
            <RefreshCw size={16} className={recalcMutation.isPending ? 'animate-spin' : ''} />
            {recalcMutation.isPending ? 'Recalculating...' : 'Recalculate'}
          </button>
          <button
            onClick={() => setShowCharts((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border ${
              showCharts
                ? 'bg-primary/20 border-primary/30 text-primary'
                : 'bg-surface border-surface-light text-text-muted hover:text-text'
            }`}
          >
            <TrendingUp size={16} />
            {showCharts ? 'Charts On' : 'Charts Off'}
          </button>
          <button
            onClick={() => setCompOnly((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border ${
              compOnly
                ? 'bg-accent/20 border-accent/30 text-accent'
                : 'bg-surface border-surface-light text-text-muted hover:text-text'
            }`}
          >
            <Filter size={16} />
            {compOnly ? 'Competition Only' : 'All Exercises'}
          </button>
        </div>
      </div>

      {(prQuery.isError || exQuery.isError) && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger">
          Failed to load PR data.
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* e1RM Progression Charts for competition lifts */}
          {showCharts && compExercises.length > 0 && (
            <div className="bg-surface rounded-xl border border-surface-light p-5">
              <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" /> e1RM Progression
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {compExercises.map((ex, idx) => {
                  const query = e1rmQueries[idx]
                  const data = (query?.data?.data ?? [])
                    .filter((d) => d.e1rm != null)
                    .map((d) => ({
                      date: d.date.slice(5),
                      e1rm: d.e1rm,
                      weight: d.best_weight,
                    }))
                  const color = CHART_COLORS[idx % CHART_COLORS.length]

                  return (
                    <div key={ex.id}>
                      <h3 className="text-text font-medium text-sm mb-2">
                        {ex.name.replace('Competition ', '')}
                      </h3>
                      {query?.isLoading ? (
                        <div className="h-[150px] flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : data.length < 2 ? (
                        <p className="text-text-muted text-xs h-[150px] flex items-center justify-center">
                          Not enough data yet
                        </p>
                      ) : (
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: '#94a3b8', fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              domain={['dataMin - 10', 'dataMax + 10']}
                              tick={{ fill: '#94a3b8', fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              width={40}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: 8,
                                color: '#f8fafc',
                                fontSize: 12,
                              }}
                              formatter={(value: number | undefined) => [value != null ? `${Math.round(value)} lbs` : '', 'e1RM']}
                            />
                            <Line
                              type="monotone"
                              dataKey="e1rm"
                              stroke={color}
                              strokeWidth={2}
                              dot={{ r: 3, fill: color }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* PR Grid */}
          {filteredRows.length === 0 ? (
            <div className="text-center py-16">
              <Trophy size={48} className="mx-auto text-text-muted mb-4" />
              <p className="text-text-muted text-lg">No PRs recorded yet. Start lifting!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredRows.map((row) => (
                <div
                  key={row.exerciseId}
                  className={`bg-surface rounded-xl border overflow-hidden ${
                    row.isCompetition
                      ? 'border-accent/30'
                      : 'border-surface-light'
                  }`}
                >
                  <div className="flex items-center gap-3 p-4 border-b border-surface-light">
                    <h2 className="text-text font-semibold text-lg">{row.exerciseName}</h2>
                    {row.isCompetition && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-accent/20 text-accent rounded text-xs font-medium">
                        <Award size={12} /> Competition
                      </span>
                    )}
                    {row.bestE1RM != null && (
                      <span className="ml-auto text-text-muted text-sm">
                        Best e1RM: <span className="text-text font-semibold">{Math.round(row.bestE1RM)} lbs</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-6 gap-px bg-surface-light/30">
                    {REP_BUCKETS.map((rep) => {
                      const pr = row.repMap[rep]
                      const recent = pr && isRecent(pr.date)
                      return (
                        <div
                          key={rep}
                          className={`p-4 text-center ${
                            recent ? 'bg-accent/5' : 'bg-surface'
                          }`}
                        >
                          <p className="text-text-muted text-xs font-medium mb-1">
                            {rep}RM
                          </p>
                          {pr ? (
                            <>
                              <p
                                className={`text-xl font-bold ${
                                  recent ? 'text-accent' : 'text-text'
                                }`}
                              >
                                {pr.weight_lbs}
                              </p>
                              <p className="text-text-muted text-xs mt-1">
                                {formatDate(pr.date)}
                              </p>
                              {recent && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 bg-accent/20 text-accent rounded text-[10px] font-medium">
                                  NEW
                                </span>
                              )}
                            </>
                          ) : (
                            <p className="text-text-muted text-xl">--</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
