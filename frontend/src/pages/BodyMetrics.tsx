import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react'
import { bodyMetrics } from '../api/client'
import type { BodyMetric, BodyMetricCreate } from '../types'
import { formatDate } from '../utils/date'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function BodyMetrics() {
  const queryClient = useQueryClient()

  // Form state
  const [date, setDate] = useState(todayStr())
  const [weight, setWeight] = useState<number | ''>('')
  const [bf, setBf] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  const { data: metrics, isLoading, isError } = useQuery<BodyMetric[]>({
    queryKey: ['bodyMetrics'],
    queryFn: () => bodyMetrics.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data: BodyMetricCreate) => bodyMetrics.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodyMetrics'] })
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BodyMetricCreate> }) =>
      bodyMetrics.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodyMetrics'] })
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bodyMetrics.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodyMetrics'] })
    },
  })

  const resetForm = () => {
    setDate(todayStr())
    setWeight('')
    setBf('')
    setNotes('')
    setEditingId(null)
  }

  const handleSubmit = () => {
    if (!weight) return
    const payload: BodyMetricCreate = {
      date,
      bodyweight_lbs: Number(weight),
      body_fat_pct: bf ? Number(bf) : undefined,
      notes: notes || undefined,
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const startEdit = (m: BodyMetric) => {
    setEditingId(m.id)
    setDate(m.date.slice(0, 10))
    setWeight(m.bodyweight_lbs ?? '')
    setBf(m.body_fat_pct ?? '')
    setNotes(m.notes ?? '')
  }

  const sorted = (metrics ?? []).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  const chartData = sorted.map((m) => ({
    date: m.date.slice(5),
    weight: m.bodyweight_lbs,
    bf: m.body_fat_pct ?? null,
  }))

  const hasBf = chartData.some((d) => d.bf !== null)

  const recentEntries = [...sorted].reverse().slice(0, 20)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-text">Body Metrics</h1>

      {/* Log form */}
      <div className="bg-surface rounded-xl p-5 border border-surface-light space-y-4">
        <h2 className="text-lg font-semibold text-text">
          {editingId ? 'Edit Entry' : 'Log Entry'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="text-text-muted text-sm font-medium block mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-text-muted text-sm font-medium block mb-1">
              Weight (lbs)
            </label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="185.0"
              className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-text-muted text-sm font-medium block mb-1">
              Body Fat %
            </label>
            <input
              type="number"
              step="0.1"
              value={bf}
              onChange={(e) => setBf(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Optional"
              className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-text-muted text-sm font-medium block mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!weight || createMutation.isPending || updateMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {editingId ? <Check size={16} /> : <Plus size={16} />}
              {editingId ? 'Update' : 'Log'}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="p-2 text-text-muted hover:text-text border border-surface-light rounded-lg"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        {(createMutation.isError || updateMutation.isError) && (
          <p className="text-danger text-sm">Failed to save entry.</p>
        )}
      </div>

      {isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger">
          Failed to load body metrics.
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Chart */}
          {chartData.length >= 2 && (
            <div className="bg-surface rounded-xl p-5 border border-surface-light">
              <h2 className="text-lg font-semibold text-text mb-4">Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="weight"
                    domain={['dataMin - 3', 'dataMax + 3']}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                    label={{
                      value: 'lbs',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#94a3b8',
                      fontSize: 11,
                    }}
                  />
                  {hasBf && (
                    <YAxis
                      yAxisId="bf"
                      orientation="right"
                      domain={[0, 40]}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={35}
                      label={{
                        value: 'BF%',
                        angle: 90,
                        position: 'insideRight',
                        fill: '#94a3b8',
                        fontSize: 11,
                      }}
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      color: '#f8fafc',
                    }}
                  />
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weight"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#3b82f6' }}
                    name="Weight (lbs)"
                  />
                  {hasBf && (
                    <Line
                      yAxisId="bf"
                      type="monotone"
                      dataKey="bf"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#f59e0b' }}
                      connectNulls
                      name="Body Fat %"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div className="bg-surface rounded-xl border border-surface-light overflow-hidden">
            <h2 className="text-lg font-semibold text-text p-4 border-b border-surface-light">
              Recent Entries
            </h2>
            {recentEntries.length === 0 ? (
              <p className="p-4 text-text-muted">No entries yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-muted text-left border-b border-surface-light/50">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Weight (lbs)</th>
                    <th className="px-4 py-2 font-medium">Body Fat %</th>
                    <th className="px-4 py-2 font-medium">Notes</th>
                    <th className="px-4 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentEntries.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-surface-light/30 last:border-0"
                    >
                      <td className="px-4 py-3 text-text">{formatDate(m.date)}</td>
                      <td className="px-4 py-3 text-text font-medium">{m.bodyweight_lbs}</td>
                      <td className="px-4 py-3 text-text-muted">
                        {m.body_fat_pct != null ? `${m.body_fat_pct}%` : '--'}
                      </td>
                      <td className="px-4 py-3 text-text-muted">{m.notes || '--'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(m)}
                            className="p-1 text-text-muted hover:text-primary transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(m.id)}
                            className="p-1 text-text-muted hover:text-danger transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
