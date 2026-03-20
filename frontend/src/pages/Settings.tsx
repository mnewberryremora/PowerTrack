import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Check, Settings2 } from 'lucide-react'
import { preferences } from '../api/client'
import { useUIStore } from '../stores/uiStore'
import type { UserPreferences, UserPreferencesUpdate } from '../types'

const USPA_WEIGHT_CLASSES = [
  '52kg', '56kg', '60kg', '67.5kg', '75kg', '82.5kg', '90kg',
  '100kg', '110kg', '125kg', '140kg', '140kg+',
  '44kg', '48kg',
]

export default function Settings() {
  const queryClient = useQueryClient()
  const { displayUnit, toggleUnit } = useUIStore()

  const [unit, setUnit] = useState(displayUnit)
  const [trainingDays, setTrainingDays] = useState(4)
  const [weightClass, setWeightClass] = useState('')
  const [repSchemes, setRepSchemes] = useState('')
  const [aiNotes, setAiNotes] = useState('')
  const [saved, setSaved] = useState(false)

  const prefsQuery = useQuery<UserPreferences>({
    queryKey: ['preferences'],
    queryFn: preferences.get,
  })

  // Populate from server data
  useEffect(() => {
    if (prefsQuery.data) {
      setUnit(prefsQuery.data.display_unit as 'lbs' | 'kg')
    }
  }, [prefsQuery.data])

  const updateMutation = useMutation({
    mutationFn: (data: UserPreferencesUpdate) => preferences.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      // Sync Zustand store
      if (unit !== displayUnit) {
        toggleUnit()
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const handleSave = () => {
    updateMutation.mutate({
      display_unit: unit,
    })
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-text flex items-center gap-3">
        <Settings2 size={28} className="text-text-muted" /> Settings
      </h1>

      {prefsQuery.isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {prefsQuery.isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger text-sm">
          Failed to load preferences. You can still configure settings below.
        </div>
      )}

      <div className="space-y-6">
        {/* Display Unit */}
        <div className="bg-surface rounded-xl p-5 border border-surface-light">
          <h2 className="text-lg font-semibold text-text mb-4">Display Unit</h2>
          <div className="flex gap-3">
            {(['lbs', 'kg'] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
                  unit === u
                    ? 'bg-primary text-white'
                    : 'bg-bg border border-surface-light text-text-muted hover:text-text'
                }`}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Training Days */}
        <div className="bg-surface rounded-xl p-5 border border-surface-light">
          <h2 className="text-lg font-semibold text-text mb-4">Training Days Per Week</h2>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={7}
              value={trainingDays}
              onChange={(e) => setTrainingDays(Number(e.target.value))}
              className="flex-1 accent-primary h-2 bg-bg rounded-full appearance-none cursor-pointer"
            />
            <span className="text-2xl font-bold text-text w-8 text-center">{trainingDays}</span>
          </div>
          <div className="flex justify-between text-text-muted text-xs mt-1 px-1">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </div>

        {/* Weight Class */}
        <div className="bg-surface rounded-xl p-5 border border-surface-light">
          <h2 className="text-lg font-semibold text-text mb-4">Weight Class (USPA)</h2>
          <select
            value={weightClass}
            onChange={(e) => setWeightClass(e.target.value)}
            className="w-full max-w-xs bg-bg border border-surface-light rounded-lg px-3 py-2.5 text-text focus:outline-none focus:border-primary"
          >
            <option value="">Select weight class...</option>
            {USPA_WEIGHT_CLASSES.map((wc) => (
              <option key={wc} value={wc}>{wc}</option>
            ))}
          </select>
        </div>

        {/* Preferred Rep Schemes */}
        <div className="bg-surface rounded-xl p-5 border border-surface-light">
          <h2 className="text-lg font-semibold text-text mb-2">Preferred Rep Schemes</h2>
          <p className="text-text-muted text-sm mb-3">
            Enter your preferred rep ranges, comma-separated (e.g. "5x5, 3x3, 5/3/1").
          </p>
          <input
            type="text"
            value={repSchemes}
            onChange={(e) => setRepSchemes(e.target.value)}
            placeholder="5x5, 3x3, 5/3/1, 4x8"
            className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2.5 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
          />
        </div>

        {/* AI Context Notes */}
        <div className="bg-surface rounded-xl p-5 border border-surface-light">
          <h2 className="text-lg font-semibold text-text mb-2">AI Coach Context</h2>
          <p className="text-text-muted text-sm mb-3">
            Add any notes the AI coach should know about (injuries, goals, preferences, etc.).
          </p>
          <textarea
            value={aiNotes}
            onChange={(e) => setAiNotes(e.target.value)}
            placeholder="e.g. Recovering from shoulder injury. Focus on hip drive for squats. Goal: 1400 total at next meet."
            rows={4}
            className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2.5 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary resize-none"
          />
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saved ? <Check size={16} /> : <Save size={16} />}
            {updateMutation.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </button>
          {updateMutation.isError && (
            <p className="text-danger text-sm">Failed to save. Please try again.</p>
          )}
        </div>
      </div>
    </div>
  )
}
