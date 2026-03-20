import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { endurance } from '../api/client'
import type { EnduranceCreate } from '../types'

const RUN_SUB_TYPES = ['Treadmill', 'Road', 'Obstacle Course', 'Custom']
const ERG_SUB_TYPES = ['Machine', 'Water', 'Custom']

function secondsToHMS(totalSeconds: number): { hh: string; mm: string; ss: string } {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return {
    hh: String(h),
    mm: String(m).padStart(2, '0'),
    ss: String(s).padStart(2, '0'),
  }
}

function hmsToSeconds(hh: string, mm: string, ss: string): number {
  return (parseInt(hh || '0') * 3600) + (parseInt(mm || '0') * 60) + parseInt(ss || '0')
}

function computePace(distanceM?: number, durationS?: number): string {
  if (!distanceM || !durationS || distanceM === 0) return '—'
  const pacePerKm = durationS / (distanceM / 1000)
  const m = Math.floor(pacePerKm / 60)
  const s = Math.round(pacePerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

export default function EnduranceDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const queryClient = useQueryClient()
  const isEdit = Boolean(id)

  // Form state
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10))
  const [activityType, setActivityType] = useState<'run' | 'erg'>('run')
  const [subType, setSubType] = useState('Road')
  const [customSubType, setCustomSubType] = useState('')
  const [name, setName] = useState('')
  const [distanceValue, setDistanceValue] = useState('')
  const [distanceUnit, setDistanceUnit] = useState<'m' | 'km'>('km')
  const [durationHH, setDurationHH] = useState('0')
  const [durationMM, setDurationMM] = useState('00')
  const [durationSS, setDurationSS] = useState('00')
  const [avgHeartRate, setAvgHeartRate] = useState('')
  const [avgSplit500mMM, setAvgSplit500mMM] = useState('2')
  const [avgSplit500mSS, setAvgSplit500mSS] = useState('00')
  const [strokeRate, setStrokeRate] = useState('')
  const [calories, setCalories] = useState('')
  const [isCompetition, setIsCompetition] = useState(false)
  const [competitionName, setCompetitionName] = useState('')
  const [competitionType, setCompetitionType] = useState('')
  const [place, setPlace] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState('')

  // Sub type options based on activity type
  const subTypeOptions = activityType === 'run' ? RUN_SUB_TYPES : ERG_SUB_TYPES
  const isCustomSubType = subType === 'Custom'

  // Competition types datalist
  const { data: competitionTypes } = useQuery<string[]>({
    queryKey: ['endurance-competition-types'],
    queryFn: () => endurance.competitionTypes(),
  })

  // Load existing activity for edit
  const { data: existingActivity } = useQuery({
    queryKey: ['endurance', id],
    queryFn: () => endurance.getById(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (!existingActivity) return
    setActivityDate(existingActivity.activity_date)
    setActivityType(existingActivity.activity_type)

    const options = existingActivity.activity_type === 'run' ? RUN_SUB_TYPES : ERG_SUB_TYPES
    if (options.includes(existingActivity.sub_type)) {
      setSubType(existingActivity.sub_type)
      setCustomSubType('')
    } else {
      setSubType('Custom')
      setCustomSubType(existingActivity.sub_type)
    }

    setName(existingActivity.name ?? '')

    if (existingActivity.distance_m != null) {
      if (existingActivity.distance_m >= 1000) {
        setDistanceValue((existingActivity.distance_m / 1000).toString())
        setDistanceUnit('km')
      } else {
        setDistanceValue(existingActivity.distance_m.toString())
        setDistanceUnit('m')
      }
    }

    if (existingActivity.duration_s != null) {
      const { hh, mm, ss } = secondsToHMS(existingActivity.duration_s)
      setDurationHH(hh)
      setDurationMM(mm)
      setDurationSS(ss)
    }

    setAvgHeartRate(existingActivity.avg_heart_rate?.toString() ?? '')

    if (existingActivity.avg_split_500m_s != null) {
      const m = Math.floor(existingActivity.avg_split_500m_s / 60)
      const s = existingActivity.avg_split_500m_s % 60
      setAvgSplit500mMM(String(m))
      setAvgSplit500mSS(String(s).padStart(2, '0'))
    }

    setStrokeRate(existingActivity.stroke_rate?.toString() ?? '')
    setCalories(existingActivity.calories?.toString() ?? '')
    setIsCompetition(existingActivity.is_competition)
    setCompetitionName(existingActivity.competition_name ?? '')
    setCompetitionType(existingActivity.competition_type ?? '')
    setPlace(existingActivity.place?.toString() ?? '')
    setNotes(existingActivity.notes ?? '')
  }, [existingActivity])

  // Handle activity type change — reset sub type to default
  const handleActivityTypeChange = (type: 'run' | 'erg') => {
    setActivityType(type)
    setSubType(type === 'run' ? 'Road' : 'Machine')
    setCustomSubType('')
  }

  // Computed pace display
  const distanceM = distanceValue
    ? distanceUnit === 'km'
      ? parseFloat(distanceValue) * 1000
      : parseFloat(distanceValue)
    : undefined
  const durationS = hmsToSeconds(durationHH, durationMM, durationSS) || undefined
  const paceDisplay = activityType === 'run' ? computePace(distanceM, durationS) : null

  const saveMutation = useMutation({
    mutationFn: (data: EnduranceCreate) =>
      isEdit ? endurance.update(Number(id), data) : endurance.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endurance'] })
      navigate('/endurance')
    },
    onError: () => {
      setFormError('Failed to save activity. Please try again.')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    const resolvedSubType = isCustomSubType ? customSubType.trim() : subType
    if (!resolvedSubType) {
      setFormError('Sub type is required.')
      return
    }

    const payload: EnduranceCreate = {
      activity_date: activityDate,
      activity_type: activityType,
      sub_type: resolvedSubType,
      name: name.trim() || undefined,
      distance_m: distanceM != null && !isNaN(distanceM) ? Math.round(distanceM) : undefined,
      duration_s: durationS && durationS > 0 ? durationS : undefined,
      avg_heart_rate: avgHeartRate ? parseInt(avgHeartRate) : undefined,
      avg_split_500m_s:
        activityType === 'erg' && (avgSplit500mMM || avgSplit500mSS)
          ? parseInt(avgSplit500mMM || '0') * 60 + parseInt(avgSplit500mSS || '0')
          : undefined,
      stroke_rate: strokeRate ? parseInt(strokeRate) : undefined,
      calories: calories ? parseInt(calories) : undefined,
      is_competition: isCompetition,
      competition_name: isCompetition && competitionName.trim() ? competitionName.trim() : undefined,
      competition_type: isCompetition && competitionType.trim() ? competitionType.trim() : undefined,
      place: isCompetition && place ? parseInt(place) : undefined,
      notes: notes.trim() || undefined,
    }

    saveMutation.mutate(payload)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/endurance')}
          className="p-2 text-text-muted hover:text-text hover:bg-surface-light rounded-lg transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-3xl font-bold text-text">
          {isEdit ? 'Edit Activity' : 'Log Activity'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Date */}
        <div className="bg-surface rounded-xl border border-surface-light p-5 space-y-4">
          <h2 className="text-text font-semibold text-lg">Basic Info</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Date *</label>
              <input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                required
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-1">Name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Morning Run"
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Activity Type */}
          <div>
            <label className="block text-sm text-text-muted mb-2">Activity Type *</label>
            <div className="flex gap-3">
              {(['run', 'erg'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleActivityTypeChange(type)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    activityType === type
                      ? type === 'run'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                        : 'bg-green-500/20 text-green-400 border-green-500/40'
                      : 'bg-bg text-text-muted border-surface-light hover:bg-surface-light'
                  }`}
                >
                  {type === 'run' ? 'Run' : 'Rowing / ERG'}
                </button>
              ))}
            </div>
          </div>

          {/* Sub Type */}
          <div>
            <label className="block text-sm text-text-muted mb-1">Sub Type *</label>
            <select
              value={subType}
              onChange={(e) => setSubType(e.target.value)}
              className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
            >
              {subTypeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {isCustomSubType && (
              <input
                type="text"
                value={customSubType}
                onChange={(e) => setCustomSubType(e.target.value)}
                placeholder="Enter custom sub type"
                className="mt-2 w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
              />
            )}
          </div>
        </div>

        {/* Performance */}
        <div className="bg-surface rounded-xl border border-surface-light p-5 space-y-4">
          <h2 className="text-text font-semibold text-lg">Performance</h2>

          {/* Distance */}
          <div>
            <label className="block text-sm text-text-muted mb-1">Distance</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={distanceValue}
                onChange={(e) => setDistanceValue(e.target.value)}
                min="0"
                step="any"
                placeholder="0"
                className="flex-1 bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
              />
              <div className="flex bg-bg border border-surface-light rounded-lg overflow-hidden">
                {(['m', 'km'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setDistanceUnit(unit)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      distanceUnit === unit
                        ? 'bg-primary text-white'
                        : 'text-text-muted hover:bg-surface-light'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm text-text-muted mb-1">Duration</label>
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  value={durationHH}
                  onChange={(e) => setDurationHH(e.target.value)}
                  min="0"
                  placeholder="0"
                  className="w-16 bg-bg border border-surface-light rounded-lg px-2 py-2 text-text text-sm text-center focus:outline-none focus:border-primary"
                />
                <span className="text-text-muted text-xs mt-1">h</span>
              </div>
              <span className="text-text-muted text-lg mb-3">:</span>
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  value={durationMM}
                  onChange={(e) => setDurationMM(e.target.value.padStart(2, '0'))}
                  min="0"
                  max="59"
                  placeholder="00"
                  className="w-16 bg-bg border border-surface-light rounded-lg px-2 py-2 text-text text-sm text-center focus:outline-none focus:border-primary"
                />
                <span className="text-text-muted text-xs mt-1">min</span>
              </div>
              <span className="text-text-muted text-lg mb-3">:</span>
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  value={durationSS}
                  onChange={(e) => setDurationSS(e.target.value.padStart(2, '0'))}
                  min="0"
                  max="59"
                  placeholder="00"
                  className="w-16 bg-bg border border-surface-light rounded-lg px-2 py-2 text-text text-sm text-center focus:outline-none focus:border-primary"
                />
                <span className="text-text-muted text-xs mt-1">sec</span>
              </div>
            </div>
          </div>

          {/* Run-specific: computed pace */}
          {activityType === 'run' && (
            <>
              <div className="flex items-center gap-3 bg-bg border border-surface-light rounded-lg px-4 py-2.5">
                <span className="text-text-muted text-sm">Computed Pace:</span>
                <span className="text-primary font-semibold">{paceDisplay}</span>
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Avg Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={avgHeartRate}
                  onChange={(e) => setAvgHeartRate(e.target.value)}
                  min="0"
                  placeholder="—"
                  className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </>
          )}

          {/* ERG-specific fields */}
          {activityType === 'erg' && (
            <>
              <div>
                <label className="block text-sm text-text-muted mb-1">Avg Split / 500m (MM:SS)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={avgSplit500mMM}
                    onChange={(e) => setAvgSplit500mMM(e.target.value)}
                    min="0"
                    placeholder="2"
                    className="w-20 bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm text-center focus:outline-none focus:border-primary"
                  />
                  <span className="text-text-muted">:</span>
                  <input
                    type="number"
                    value={avgSplit500mSS}
                    onChange={(e) => setAvgSplit500mSS(e.target.value)}
                    min="0"
                    max="59"
                    placeholder="00"
                    className="w-20 bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm text-center focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-text-muted mb-1">Avg Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={avgHeartRate}
                    onChange={(e) => setAvgHeartRate(e.target.value)}
                    min="0"
                    placeholder="—"
                    className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">Stroke Rate (spm)</label>
                  <input
                    type="number"
                    value={strokeRate}
                    onChange={(e) => setStrokeRate(e.target.value)}
                    min="0"
                    placeholder="—"
                    className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">Calories</label>
                  <input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    min="0"
                    placeholder="—"
                    className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Competition */}
        <div className="bg-surface rounded-xl border border-surface-light p-5 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_competition"
              checked={isCompetition}
              onChange={(e) => setIsCompetition(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="is_competition" className="text-text font-semibold text-lg cursor-pointer">
              Competition
            </label>
          </div>

          {isCompetition && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">Competition Name</label>
                <input
                  type="text"
                  value={competitionName}
                  onChange={(e) => setCompetitionName(e.target.value)}
                  placeholder="e.g. Boston Marathon"
                  className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Competition Type</label>
                <input
                  type="text"
                  value={competitionType}
                  onChange={(e) => setCompetitionType(e.target.value)}
                  list="competition-types-list"
                  placeholder="e.g. 5K, Marathon"
                  className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
                />
                <datalist id="competition-types-list">
                  {(competitionTypes ?? []).map((ct) => (
                    <option key={ct} value={ct} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Place</label>
                <input
                  type="number"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  min="1"
                  placeholder="—"
                  className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-surface rounded-xl border border-surface-light p-5">
          <label className="block text-sm text-text-muted mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any notes about the activity..."
            className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary resize-none"
          />
        </div>

        {/* Error */}
        {formError && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-danger text-sm">
            {formError}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate('/endurance')}
            className="px-5 py-2.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-light border border-surface-light transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-medium transition-colors disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Log Activity'}
          </button>
        </div>
      </form>
    </div>
  )
}
