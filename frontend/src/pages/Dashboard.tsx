import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  Dumbbell, Trophy, Calendar, TrendingUp, Plus, Timer,
} from 'lucide-react'
import { prs, workouts, bodyMetrics, meets, analytics } from '../api/client'
import type { PR, WorkoutSummary, BodyMetric, Meet } from '../types'
import { formatDate, daysUntil } from '../utils/date'

export default function Dashboard() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const prQuery = useQuery<PR[]>({ queryKey: ['prs'], queryFn: prs.list })
  const workoutQuery = useQuery<WorkoutSummary[]>({
    queryKey: ['workouts', 'recent'],
    queryFn: () => workouts.list(),
  })
  const bwQuery = useQuery<BodyMetric[]>({
    queryKey: ['bodyMetrics'],
    queryFn: () => bodyMetrics.list(),
  })
  const meetQuery = useQuery<Meet>({
    queryKey: ['meets', 'next'],
    queryFn: meets.next,
  })
  const dotsQuery = useQuery<{ data: Array<{ date: string; dots: number; bodyweight_lbs: number; total_lbs: number }> }>({
    queryKey: ['analytics', 'dots'],
    queryFn: analytics.dots,
  })

  // Best competition PRs for SBD — prefer actual 1RM, fall back to best e1RM
  const allPRs = prQuery.data ?? []
  const getBestLift = (keyword: string) => {
    const liftPRs = allPRs.filter((p) =>
      (p.exercise_name ?? '').toLowerCase().includes(keyword),
    )
    // Prefer actual 1RM
    const oneRMs = liftPRs
      .filter((p) => p.rep_count === 1)
      .sort((a, b) => b.weight_lbs - a.weight_lbs)
    if (oneRMs.length > 0) return oneRMs[0]
    // Fall back to highest e1RM
    const byE1RM = liftPRs
      .filter((p) => p.e1rm_lbs != null)
      .sort((a, b) => (b.e1rm_lbs ?? 0) - (a.e1rm_lbs ?? 0))
    return byE1RM[0] ?? null
  }
  const bestSquat = getBestLift('squat')
  const bestBench = getBestLift('bench')
  const bestDeadlift = getBestLift('deadlift')

  const recentWorkouts = (workoutQuery.data ?? [])
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  const bwChartData = (bwQuery.data ?? [])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-30)
    .map((m) => ({ date: m.date.slice(5), weight: m.bodyweight_lbs }))

  const nextMeet = meetQuery.data
  const dotsEntries = dotsQuery.data?.data ?? []
  const dots = dotsEntries.length > 0 ? dotsEntries[dotsEntries.length - 1].dots : null

  const isLoading =
    prQuery.isLoading || workoutQuery.isLoading || bwQuery.isLoading
  const isError =
    prQuery.isError && workoutQuery.isError && bwQuery.isError

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text">Dashboard</h1>
          <p className="text-text-muted mt-1">{today}</p>
        </div>
        <Link
          to="/workouts/new"
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} /> Log Workout
        </Link>
      </div>

      {isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger">
          Failed to load dashboard data. Please try again.
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* Top cards row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* DOTS Score */}
            <div className="bg-surface rounded-xl p-5 border border-surface-light">
              <div className="flex items-center gap-3 mb-2">
                <Trophy size={20} className="text-accent" />
                <span className="text-text-muted text-sm font-medium">DOTS Score</span>
              </div>
              <p className="text-3xl font-bold text-text">
                {dots != null ? Math.round(dots) : '--'}
              </p>
            </div>

            {/* SBD PRs */}
            {[
              { label: 'Best Squat', pr: bestSquat, color: 'text-primary' },
              { label: 'Best Bench', pr: bestBench, color: 'text-accent' },
              { label: 'Best Deadlift', pr: bestDeadlift, color: 'text-success' },
            ].map(({ label, pr, color }) => (
              <div key={label} className="bg-surface rounded-xl p-5 border border-surface-light">
                <div className="flex items-center gap-3 mb-2">
                  <Dumbbell size={20} className={color} />
                  <span className="text-text-muted text-sm font-medium">{label}</span>
                </div>
                <p className="text-3xl font-bold text-text">
                  {pr
                    ? pr.rep_count === 1
                      ? `${pr.weight_lbs} lbs`
                      : `${pr.e1rm_lbs ?? pr.weight_lbs} lbs`
                    : '--'}
                </p>
                {pr && (
                  <p className="text-text-muted text-xs mt-1">
                    {pr.rep_count === 1
                      ? formatDate(pr.date)
                      : `e1RM (${pr.weight_lbs}x${pr.rep_count}) ${formatDate(pr.date)}`}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Workouts */}
            <div className="lg:col-span-2 bg-surface rounded-xl p-5 border border-surface-light">
              <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                <Calendar size={18} className="text-primary" /> Recent Workouts
              </h2>
              {recentWorkouts.length === 0 ? (
                <p className="text-text-muted py-4">No workouts logged yet. Get started!</p>
              ) : (
                <div className="space-y-2">
                  {recentWorkouts.map((w) => (
                    <Link
                      key={w.id}
                      to={`/workouts/${w.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-bg hover:bg-surface-light transition-colors"
                    >
                      <div>
                        <p className="text-text font-medium">{w.name || 'Workout'}</p>
                        <p className="text-text-muted text-sm">{formatDate(w.date)}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-text-muted">
                        <span>{w.exercise_count} exercises</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
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
                  ))}
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Meet Countdown */}
              <div className="bg-surface rounded-xl p-5 border border-surface-light">
                <h2 className="text-lg font-semibold text-text mb-3 flex items-center gap-2">
                  <Timer size={18} className="text-accent" /> Next Meet
                </h2>
                {meetQuery.isError || !nextMeet ? (
                  <p className="text-text-muted text-sm">No upcoming meets scheduled.</p>
                ) : (
                  <div>
                    <p className="text-text font-medium">{nextMeet.name}</p>
                    <p className="text-text-muted text-sm">{formatDate(nextMeet.date)}</p>
                    <p className="text-4xl font-bold text-accent mt-2">
                      {daysUntil(nextMeet.date)}
                      <span className="text-lg font-normal text-text-muted ml-2">days</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Bodyweight Chart */}
              <div className="bg-surface rounded-xl p-5 border border-surface-light">
                <h2 className="text-lg font-semibold text-text mb-3 flex items-center gap-2">
                  <TrendingUp size={18} className="text-success" /> Bodyweight Trend
                </h2>
                {bwChartData.length < 2 ? (
                  <p className="text-text-muted text-sm">
                    Log bodyweight entries to see trends.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={bwChartData}>
                      <XAxis
                        dataKey="date"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={['dataMin - 2', 'dataMax + 2']}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
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
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
