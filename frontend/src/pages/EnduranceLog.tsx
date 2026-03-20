import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Activity, Trash2, Pencil, Trophy } from 'lucide-react'
import { endurance } from '../api/client'
import type { EnduranceActivity } from '../types'

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

function formatPace(pacePerKm?: number): string {
  if (!pacePerKm) return '—'
  const m = Math.floor(pacePerKm / 60)
  const s = Math.round(pacePerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

type FilterTab = 'all' | 'run' | 'erg'

export default function EnduranceLog() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [compOnly, setCompOnly] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const queryParams = {
    activity_type: activeTab !== 'all' ? activeTab : undefined,
    is_competition: compOnly ? true : undefined,
  }

  const { data, isLoading, isError } = useQuery<EnduranceActivity[]>({
    queryKey: ['endurance', activeTab, compOnly],
    queryFn: () => endurance.list(queryParams),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => endurance.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endurance'] })
      setConfirmDeleteId(null)
    },
  })

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'run', label: 'Running' },
    { key: 'erg', label: 'Rowing / ERG' },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-text">Endurance Log</h1>
        <button
          onClick={() => navigate('/endurance/new')}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} /> Log Activity
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-surface border border-surface-light rounded-lg p-1 gap-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCompOnly((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            compOnly
              ? 'bg-primary/20 text-primary border-primary/40'
              : 'bg-surface text-text-muted border-surface-light hover:bg-surface-light hover:text-text'
          }`}
        >
          <Trophy size={14} />
          Competitions Only
        </button>
      </div>

      {/* Error */}
      {isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger">
          Failed to load endurance activities.
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Activity List */}
      {!isLoading && !isError && (
        <>
          {(data ?? []).length === 0 ? (
            <div className="text-center py-16">
              <Activity size={48} className="mx-auto text-text-muted mb-4" />
              <p className="text-text-muted text-lg">No activities logged yet.</p>
              <button
                onClick={() => navigate('/endurance/new')}
                className="inline-block mt-4 text-primary hover:text-primary-dark font-medium"
              >
                Log your first activity
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {(data ?? []).map((activity) => (
                <div
                  key={activity.id}
                  className="bg-surface rounded-xl border border-surface-light hover:border-primary/30 transition-colors"
                >
                  {confirmDeleteId === activity.id ? (
                    <div className="flex items-center justify-between p-4">
                      <span className="text-danger text-sm">
                        Delete &quot;{activity.competition_name || activity.name || activity.sub_type}&quot; on{' '}
                        {new Date(activity.activity_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        ?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => deleteMutation.mutate(activity.id)}
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
                      <div className="flex-1 p-4">
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                            <Activity size={18} className="text-primary" />
                          </div>

                          {/* Main info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {/* Activity type badge */}
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  activity.activity_type === 'run'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-green-500/20 text-green-400'
                                }`}
                              >
                                {activity.activity_type === 'run' ? 'Run' : 'ERG'}
                              </span>

                              {/* Competition badge */}
                              {activity.is_competition && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400">
                                  <Trophy size={10} />
                                  Competition
                                </span>
                              )}

                              <span className="text-text font-medium truncate">
                                {activity.competition_name || activity.name || activity.sub_type}
                              </span>

                              {activity.competition_name && activity.name && (
                                <span className="text-text-muted text-sm">({activity.name})</span>
                              )}
                            </div>

                            <p className="text-text-muted text-sm mb-2">
                              {new Date(activity.activity_date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}{' '}
                              &middot; {activity.sub_type}
                            </p>

                            {/* Stats row */}
                            <div className="flex items-center gap-4 flex-wrap text-sm">
                              {activity.distance_m != null && (
                                <span className="text-text-muted">
                                  <span className="text-text font-medium">{formatDistance(activity.distance_m)}</span>
                                </span>
                              )}
                              {activity.duration_s != null && (
                                <span className="text-text-muted">
                                  <span className="text-text font-medium">{formatDuration(activity.duration_s)}</span>
                                </span>
                              )}
                              {activity.activity_type === 'run' && activity.pace_per_km != null && (
                                <span className="text-text-muted">
                                  Pace: <span className="text-text font-medium">{formatPace(activity.pace_per_km)}</span>
                                </span>
                              )}
                              {activity.activity_type === 'erg' && activity.split_500m_display && (
                                <span className="text-text-muted">
                                  Split: <span className="text-text font-medium">{activity.split_500m_display}/500m</span>
                                </span>
                              )}
                              {activity.avg_heart_rate != null && (
                                <span className="text-text-muted">
                                  HR: <span className="text-text font-medium">{activity.avg_heart_rate} bpm</span>
                                </span>
                              )}
                              {activity.is_competition && activity.place != null && (
                                <span className="text-yellow-400 font-semibold">
                                  #{activity.place} Place
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 pr-3">
                        <button
                          onClick={() => navigate(`/endurance/${activity.id}`)}
                          className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Edit activity"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(activity.id)}
                          className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                          title="Delete activity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
