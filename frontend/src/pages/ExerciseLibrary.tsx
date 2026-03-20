import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Plus, Trash2, ChevronDown, ChevronRight, Award, Dumbbell,
} from 'lucide-react'
import { exercises as exercisesApi } from '../api/client'
import type { Exercise, ExerciseCreate } from '../types'

const CATEGORIES = [
  'competition_squat', 'squat_variant',
  'competition_bench', 'bench_variant',
  'competition_deadlift', 'deadlift_variant',
  'upper_push', 'upper_pull', 'lower',
  'accessory', 'cardio',
] as const

const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Band', 'Kettlebell', 'Other',
]

const CATEGORY_LABELS: Record<string, string> = {
  competition_squat: 'Competition Squat',
  squat_variant: 'Squat Variations',
  competition_bench: 'Competition Bench',
  bench_variant: 'Bench Variations',
  competition_deadlift: 'Competition Deadlift',
  deadlift_variant: 'Deadlift Variations',
  upper_push: 'Upper Push',
  upper_pull: 'Upper Pull',
  lower: 'Lower Body',
  accessory: 'Accessories',
  cardio: 'Cardio',
}

export default function ExerciseLibrary() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('accessory')
  const [newEquipment, setNewEquipment] = useState('Barbell')
  const [newIsComp, setNewIsComp] = useState(false)

  const { data: exercises, isLoading, isError } = useQuery<Exercise[]>({
    queryKey: ['exercises'],
    queryFn: exercisesApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: ExerciseCreate) => exercisesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] })
      setNewName('')
      setNewCategory('accessory')
      setNewEquipment('Barbell')
      setNewIsComp(false)
      setShowForm(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => exercisesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] })
    },
  })

  const filtered = (exercises ?? []).filter((ex) =>
    ex.name.toLowerCase().includes(search.toLowerCase()),
  )

  const grouped = CATEGORIES.reduce<Record<string, Exercise[]>>((acc, cat) => {
    const items = filtered.filter((e) => e.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  const toggleCollapse = (cat: string) => {
    setCollapsed((c) => ({ ...c, [cat]: !c[cat] }))
  }

  const handleCreate = () => {
    if (!newName.trim()) return
    createMutation.mutate({
      name: newName.trim(),
      category: newCategory,
      equipment: newEquipment,
      is_competition: newIsComp,
    })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-text">Exercise Library</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} /> Add Exercise
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-surface rounded-xl p-5 border border-surface-light space-y-4">
          <h2 className="text-lg font-semibold text-text">New Exercise</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Pause Squat"
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c] || c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">Equipment</label>
              <select
                value={newEquipment}
                onChange={(e) => setNewEquipment(e.target.value)}
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
              >
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <option key={eq} value={eq}>
                    {eq}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsComp}
                  onChange={(e) => setNewIsComp(e.target.checked)}
                  className="w-4 h-4 rounded border-surface-light bg-bg accent-primary"
                />
                <span className="text-text text-sm">Competition Lift</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newName.trim()}
              className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-text-muted hover:text-text px-4 py-2"
            >
              Cancel
            </button>
          </div>
          {createMutation.isError && (
            <p className="text-danger text-sm">Failed to create exercise.</p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises..."
          className="w-full bg-surface border border-surface-light rounded-lg pl-10 pr-4 py-2.5 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
        />
      </div>

      {/* Error */}
      {isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger">
          Failed to load exercises.
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Grouped exercise table */}
      {!isLoading && !isError && (
        <div className="space-y-3">
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-12">
              <Dumbbell size={48} className="mx-auto text-text-muted mb-4" />
              <p className="text-text-muted text-lg">No exercises found.</p>
            </div>
          )}

          {Object.entries(grouped).map(([cat, items]) => (
            <div
              key={cat}
              className="bg-surface rounded-xl border border-surface-light overflow-hidden"
            >
              <button
                onClick={() => toggleCollapse(cat)}
                className="w-full flex items-center justify-between p-4 hover:bg-surface-light/50 transition-colors"
              >
                <h2 className="text-text font-semibold flex items-center gap-2">
                  {collapsed[cat] ? (
                    <ChevronRight size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                  {CATEGORY_LABELS[cat] || cat}
                  <span className="text-text-muted text-sm font-normal ml-2">
                    ({items.length})
                  </span>
                </h2>
              </button>

              {!collapsed[cat] && (
                <div className="border-t border-surface-light">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-muted text-left border-b border-surface-light/50">
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-4 py-2 font-medium">Equipment</th>
                        <th className="px-4 py-2 font-medium w-20 text-center">Comp</th>
                        <th className="px-4 py-2 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((ex) => (
                        <tr
                          key={ex.id}
                          className="border-b border-surface-light/30 last:border-0"
                        >
                          <td className="px-4 py-3 text-text font-medium">{ex.name}</td>
                          <td className="px-4 py-3 text-text-muted">
                            {ex.equipment || '--'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {ex.is_competition && (
                              <Award size={16} className="text-accent mx-auto" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {!ex.is_competition && (
                              <button
                                onClick={() => deleteMutation.mutate(ex.id)}
                                className="p-1 text-text-muted hover:text-danger transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
