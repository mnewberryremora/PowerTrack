import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Activity, Trophy, Timer, TrendingUp, Plus, Zap } from 'lucide-react'
import { endurance } from '../api/client'
import type { EnduranceActivity } from '../types'

// ── Formatters ──────────────────────────────────────────────────────────────

function formatDuration(seconds?: number): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDistance(meters?: number): string {
  if (!meters) return '—'
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${meters} m`
}

function formatPace(pacePerKm?: number | null): string {
  if (!pacePerKm) return '—'
  const m = Math.floor(pacePerKm / 60)
  const s = Math.round(pacePerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

function formatSplit(splitS?: number | null): string {
  if (!splitS) return '—'
  const m = Math.floor(splitS / 60)
  const s = Math.round(splitS % 60)
  return `${m}:${String(s).padStart(2, '0')}/500m`
}

// ── Types ────────────────────────────────────────────────────────────────────

type ViewFilter = 'run' | 'both' | 'erg'

// ── Best performance helpers ─────────────────────────────────────────────────

function getBestBySubType(
  activities: EnduranceActivity[],
  type: 'run' | 'erg',
): { subType: string; best: EnduranceActivity }[] {
  const filtered = activities.filter((a) => a.activity_type === type)
  const bySubType: Record<string, EnduranceActivity[]> = {}
  for (const a of filtered) {
    if (!bySubType[a.sub_type]) bySubType[a.sub_type] = []
    bySubType[a.sub_type].push(a)
  }
  return Object.entries(bySubType).map(([subType, acts]) => {
    const best = type === 'run'
      ? acts
          .filter((a) => a.pace_per_km != null)
          .sort((a, b) => (a.pace_per_km ?? Infinity) - (b.pace_per_km ?? Infinity))[0]
          ?? acts.sort((a, b) => (a.duration_s ?? Infinity) - (b.duration_s ?? Infinity))[0]
      : acts
          .filter((a) => a.avg_split_500m_s != null)
          .sort((a, b) => (a.avg_split_500m_s ?? Infinity) - (b.avg_split_500m_s ?? Infinity))[0]
          ?? acts.sort((a, b) => (a.duration_s ?? Infinity) - (b.duration_s ?? Infinity))[0]
    return { subType, best }
  }).filter((x) => x.best != null)
}

function totalDistance(activities: EnduranceActivity[]): number {
  return activities.reduce((sum, a) => sum + (a.distance_m ?? 0), 0)
}

function totalDuration(activities: EnduranceActivity[]): number {
  return activities.reduce((sum, a) => sum + (a.duration_s ?? 0), 0)
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EnduranceDashboard() {
  const [view, setView] = useState<ViewFilter>('both')

  const { data: all = [], isLoading, isError } = useQuery<EnduranceActivity[]>({
    queryKey: ['endurance', 'all'],
    queryFn: () => endurance.list(),
  })

  const filtered = all.filter((a) =>
    view === 'both' ? true : a.activity_type === view,
  )

  const runs = all.filter((a) => a.activity_type === 'run')
  const ergs = all.filter((a) => a.activity_type === 'erg')

  const showRun = view === 'run' || view === 'both'
  const showErg = view === 'erg' || view === 'both'

  const bestRuns = getBestBySubType(all, 'run')
  const bestErgs = getBestBySubType(all, 'erg')

  const recent = [...filtered]
    .sort((a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime())
    .slice(0, 6)

  // Trend chart data — pace for runs, split for ergs, sorted by date
  const runTrend = [...runs]
    .filter((a) => a.pace_per_km != null)
    .sort((a, b) => new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime())
    .map((a) => ({
      date: a.activity_date.slice(5),
      pace: a.pace_per_km ? Math.round(a.pace_per_km) : null,
      label: a.sub_type,
    }))

  const ergTrend = [...ergs]
    .filter((a) => a.avg_split_500m_s != null)
    .sort((a, b) => new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime())
    .map((a) => ({
      date: a.activity_date.slice(5),
      split: a.avg_split_500m_s,
      label: a.sub_type,
    }))

  const competitions = filtered.filter((a) => a.is_competition)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text">Endurance Dashboard</h1>
          <p className="text-text-muted mt-1">Performance trends and best efforts</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/endurance"
            className="flex items-center gap-2 text-primary hover:text-primary-dark text-sm font-medium transition-colors"
          >
            View Log
          </Link>
          <Link
            to="/endurance/new"
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Plus size={18} /> Log Activity
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex bg-surface border border-surface-light rounded-lg p-1 gap-1 w-fit">
        {([
          { key: 'run', label: 'Running' },
          { key: 'both', label: 'All' },
          { key: 'erg', label: 'Rowing / ERG' },
        ] as { key: ViewFilter; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === key ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger">
          Failed to load endurance data.
        </div>
      )}

      {filtered.length === 0 && !isLoading && !isError ? (
        <div className="text-center py-20">
          <Activity size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-muted text-lg">No activities logged yet.</p>
          <Link
            to="/endurance/new"
            className="inline-block mt-4 text-primary hover:text-primary-dark font-medium"
          >
            Log your first activity
          </Link>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              icon={<Activity size={18} className="text-primary" />}
              label="Activities"
              value={filtered.length.toString()}
            />
            <StatCard
              icon={<TrendingUp size={18} className="text-success" />}
              label="Total Distance"
              value={formatDistance(totalDistance(filtered))}
            />
            <StatCard
              icon={<Timer size={18} className="text-accent" />}
              label="Total Time"
              value={formatDuration(totalDuration(filtered))}
            />
            <StatCard
              icon={<Trophy size={18} className="text-yellow-400" />}
              label="Competitions"
              value={competitions.length.toString()}
            />
          </div>

          {/* Best efforts */}
          {showRun && bestRuns.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-text mb-3 flex items-center gap-2">
                <Zap size={18} className="text-blue-400" /> Best Running Efforts
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {bestRuns.map(({ subType, best }) => (
                  <div
                    key={subType}
                    className="bg-surface rounded-xl border border-surface-light p-4"
                  >
                    <p className="text-text-muted text-xs font-medium uppercase tracking-wide mb-1">
                      {subType}
                    </p>
                    <p className="text-2xl font-bold text-text">
                      {best.pace_per_km ? formatPace(best.pace_per_km) : formatDuration(best.duration_s)}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                      {best.distance_m && <span>{formatDistance(best.distance_m)}</span>}
                      <span>{new Date(best.activity_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      {best.is_competition && (
                        <span className="text-yellow-400 font-semibold">Competition</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {showErg && bestErgs.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-text mb-3 flex items-center gap-2">
                <Zap size={18} className="text-green-400" /> Best Erg Efforts
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {bestErgs.map(({ subType, best }) => (
                  <div
                    key={subType}
                    className="bg-surface rounded-xl border border-surface-light p-4"
                  >
                    <p className="text-text-muted text-xs font-medium uppercase tracking-wide mb-1">
                      {subType}
                    </p>
                    <p className="text-2xl font-bold text-text">
                      {best.avg_split_500m_s ? formatSplit(best.avg_split_500m_s) : formatDuration(best.duration_s)}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                      {best.distance_m && <span>{formatDistance(best.distance_m)}</span>}
                      <span>{new Date(best.activity_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      {best.is_competition && (
                        <span className="text-yellow-400 font-semibold">Competition</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Trend charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {showRun && runTrend.length >= 2 && (
              <div className="bg-surface rounded-xl border border-surface-light p-5">
                <h3 className="text-text font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-400" /> Running Pace Trend
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={runTrend}>
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={45}
                      tickFormatter={(v) => {
                        const m = Math.floor(v / 60)
                        const s = Math.round(v % 60)
                        return `${m}:${String(s).padStart(2, '0')}`
                      }}
                      reversed
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', fontSize: 12 }}
                      formatter={(value) => [typeof value === 'number' ? formatPace(value) : value, 'Pace']}
                    />
                    <Line type="monotone" dataKey="pace" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: '#60a5fa' }} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-text-muted text-xs mt-1">Lower is faster</p>
              </div>
            )}

            {showErg && ergTrend.length >= 2 && (
              <div className="bg-surface rounded-xl border border-surface-light p-5">
                <h3 className="text-text font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-green-400" /> Erg Split Trend
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={ergTrend}>
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={45}
                      tickFormatter={(v) => {
                        const m = Math.floor(v / 60)
                        const s = Math.round(v % 60)
                        return `${m}:${String(s).padStart(2, '0')}`
                      }}
                      reversed
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f8fafc', fontSize: 12 }}
                      formatter={(value) => [typeof value === 'number' ? formatSplit(value) : value, 'Split']}
                    />
                    <Line type="monotone" dataKey="split" stroke="#34d399" strokeWidth={2} dot={{ r: 3, fill: '#34d399' }} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-text-muted text-xs mt-1">Lower is faster</p>
              </div>
            )}
          </div>

          {/* Recent activities */}
          {recent.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-text">Recent Activities</h2>
                <Link to="/endurance" className="text-primary hover:text-primary-dark text-sm font-medium">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {recent.map((a) => (
                  <div
                    key={a.id}
                    className="bg-surface rounded-xl border border-surface-light p-4 flex items-center gap-4"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        a.activity_type === 'run' ? 'bg-blue-500/10' : 'bg-green-500/10'
                      }`}
                    >
                      <Activity
                        size={18}
                        className={a.activity_type === 'run' ? 'text-blue-400' : 'text-green-400'}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            a.activity_type === 'run'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}
                        >
                          {a.activity_type === 'run' ? 'Run' : 'ERG'}
                        </span>
                        {a.is_competition && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400">
                            <Trophy size={10} /> Competition
                          </span>
                        )}
                        <span className="text-text font-medium truncate">
                          {a.competition_name || a.name || a.sub_type}
                        </span>
                      </div>
                      <p className="text-text-muted text-xs mt-0.5">
                        {new Date(a.activity_date).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                        })}
                        {a.sub_type && ` · ${a.sub_type}`}
                      </p>
                    </div>
                    <div className="text-right text-sm shrink-0">
                      {a.distance_m != null && (
                        <p className="text-text font-medium">{formatDistance(a.distance_m)}</p>
                      )}
                      {a.duration_s != null && (
                        <p className="text-text-muted">{formatDuration(a.duration_s)}</p>
                      )}
                      {a.activity_type === 'run' && a.pace_per_km != null && (
                        <p className="text-blue-400 text-xs">{formatPace(a.pace_per_km)}</p>
                      )}
                      {a.activity_type === 'erg' && a.avg_split_500m_s != null && (
                        <p className="text-green-400 text-xs">{formatSplit(a.avg_split_500m_s)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-surface rounded-xl border border-surface-light p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-text-muted text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-text">{value}</p>
    </div>
  )
}
