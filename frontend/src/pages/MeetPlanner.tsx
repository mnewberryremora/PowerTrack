import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Calendar, MapPin, Trophy, Timer, ChevronDown, ChevronUp, X,
  Trash2, Pencil, Check,
} from 'lucide-react'
import { meets } from '../api/client'
import type { Meet, MeetCreate } from '../types'
import { formatDate as _formatDate, daysUntil as _daysUntil } from '../utils/date'

const USPA_WEIGHT_CLASSES = [
  { value: '44', label: '44kg' },
  { value: '48', label: '48kg' },
  { value: '52', label: '52kg' },
  { value: '56', label: '56kg' },
  { value: '60', label: '60kg' },
  { value: '67.5', label: '67.5kg' },
  { value: '75', label: '75kg' },
  { value: '82.5', label: '82.5kg' },
  { value: '90', label: '90kg' },
  { value: '100', label: '100kg' },
  { value: '110', label: '110kg' },
  { value: '125', label: '125kg' },
  { value: '140', label: '140kg' },
  { value: '140', label: '140kg+' },
]

const FEDERATIONS = ['USPA', 'USAPL', 'IPF', 'WRPF', 'RPS', 'SPF', 'Other']

function formatDate(iso: string) {
  return _formatDate(iso, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

function daysUntil(dateStr: string) {
  const totalDays = _daysUntil(dateStr)
  const weeks = Math.floor(totalDays / 7)
  const days = totalDays % 7
  return { totalDays, weeks, days }
}

export default function MeetPlanner() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [expandedMeet, setExpandedMeet] = useState<number | null>(null)
  const [editingMeet, setEditingMeet] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  // Form state (create)
  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formFederation, setFormFederation] = useState('USPA')
  const [formWeightClass, setFormWeightClass] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editFederation, setEditFederation] = useState('')
  const [editWeightClass, setEditWeightClass] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState('')

  // Opener edit state per meet
  const [openers, setOpeners] = useState<Record<number, { squat: string; bench: string; deadlift: string }>>({})

  const { data: meetList, isLoading, isError } = useQuery<Meet[]>({
    queryKey: ['meets'],
    queryFn: meets.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: MeetCreate) => meets.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meets'] })
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MeetCreate> }) =>
      meets.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meets'] })
      setEditingMeet(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => meets.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meets'] })
      setConfirmDelete(null)
      setExpandedMeet(null)
    },
  })

  const resetForm = () => {
    setFormName('')
    setFormDate('')
    setFormLocation('')
    setFormFederation('USPA')
    setFormWeightClass('')
    setFormNotes('')
    setShowForm(false)
  }

  const handleCreate = () => {
    if (!formName.trim() || !formDate) return
    createMutation.mutate({
      name: formName.trim(),
      date: formDate,
      location: formLocation || undefined,
      federation: formFederation,
      weight_class_kg: formWeightClass ? parseFloat(formWeightClass) : undefined,
      notes: formNotes || undefined,
    })
  }

  const startEditing = (meet: Meet) => {
    setEditingMeet(meet.id)
    setEditName(meet.name)
    setEditDate(meet.date)
    setEditLocation(meet.location ?? '')
    setEditFederation(meet.federation)
    setEditWeightClass(meet.weight_class_kg?.toString() ?? '')
    setEditNotes(meet.notes ?? '')
    setEditStatus(meet.status)
  }

  const handleSaveEdit = (meetId: number) => {
    if (!editName.trim() || !editDate) return
    updateMutation.mutate({
      id: meetId,
      data: {
        name: editName.trim(),
        date: editDate,
        location: editLocation || undefined,
        federation: editFederation,
        weight_class_kg: editWeightClass ? parseFloat(editWeightClass) : undefined,
        notes: editNotes || undefined,
        status: editStatus,
      },
    })
  }

  const saveOpeners = (meetId: number) => {
    const o = openers[meetId]
    if (!o) return
    updateMutation.mutate({
      id: meetId,
      data: {
        squat_opener_lbs: o.squat ? Number(o.squat) : undefined,
        bench_opener_lbs: o.bench ? Number(o.bench) : undefined,
        deadlift_opener_lbs: o.deadlift ? Number(o.deadlift) : undefined,
      },
    })
  }


  const allMeets = meetList ?? []
  const upcomingMeets = allMeets
    .filter((m) => m.status === 'planned')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const pastMeets = allMeets
    .filter((m) => m.status !== 'planned')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const renderMeetCard = (meet: Meet, isUpcoming: boolean) => {
    const expanded = expandedMeet === meet.id
    const isEditing = editingMeet === meet.id
    const isConfirmingDelete = confirmDelete === meet.id
    const countdown = isUpcoming ? daysUntil(meet.date) : null
    const meetOpeners = openers[meet.id] ?? {
      squat: meet.squat_opener_lbs?.toString() ?? '',
      bench: meet.bench_opener_lbs?.toString() ?? '',
      deadlift: meet.deadlift_opener_lbs?.toString() ?? '',
    }

    return (
      <div
        key={meet.id}
        className={`bg-surface rounded-xl overflow-hidden ${
          isUpcoming ? 'border border-accent/20' : 'border border-surface-light'
        }`}
      >
        {/* Header */}
        <div className="p-5 flex items-center justify-between">
          <button
            onClick={() => setExpandedMeet(expanded ? null : meet.id)}
            className="flex-1 text-left flex items-center justify-between"
          >
            <div>
              <h3 className="text-text font-semibold text-lg">{meet.name}</h3>
              <div className="flex items-center gap-4 mt-1 text-text-muted text-sm flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar size={14} /> {formatDate(meet.date)}
                </span>
                {meet.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} /> {meet.location}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-surface-light rounded text-xs">
                  {meet.federation}
                </span>
                {meet.weight_class_kg && (
                  <span className="px-2 py-0.5 bg-surface-light rounded text-xs">
                    {meet.weight_class_kg}kg
                  </span>
                )}
                {!isUpcoming && (
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      meet.status === 'completed'
                        ? 'bg-success/20 text-success'
                        : 'bg-danger/20 text-danger'
                    }`}
                  >
                    {meet.status}
                  </span>
                )}
              </div>
            </div>
            {countdown && (
              <div className="text-right ml-4">
                <p className="text-3xl font-bold text-accent">{countdown.totalDays}</p>
                <p className="text-text-muted text-xs">
                  {countdown.weeks}w {countdown.days}d
                </p>
              </div>
            )}
          </button>
          <div className="flex items-center gap-2 ml-4">
            {expanded ? (
              <ChevronUp size={18} className="text-text-muted" />
            ) : (
              <ChevronDown size={18} className="text-text-muted" />
            )}
          </div>
        </div>

        {/* Openers display (collapsed) */}
        {!expanded && (meet.squat_opener_lbs || meet.bench_opener_lbs || meet.deadlift_opener_lbs) && (
          <div className="px-5 pb-4 flex gap-6 text-sm">
            {meet.squat_opener_lbs != null && (
              <span className="text-text-muted">
                SQ: <span className="text-text font-medium">{meet.squat_opener_lbs}</span>
              </span>
            )}
            {meet.bench_opener_lbs != null && (
              <span className="text-text-muted">
                BP: <span className="text-text font-medium">{meet.bench_opener_lbs}</span>
              </span>
            )}
            {meet.deadlift_opener_lbs != null && (
              <span className="text-text-muted">
                DL: <span className="text-text font-medium">{meet.deadlift_opener_lbs}</span>
              </span>
            )}
          </div>
        )}

        {/* Expanded section */}
        {expanded && (
          <div className="border-t border-surface-light p-5 space-y-5">
            {/* Edit meet details */}
            {isEditing ? (
              <div className="space-y-4">
                <h4 className="text-text font-medium">Edit Meet</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-text-muted text-sm font-medium block mb-1">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-text-muted text-sm font-medium block mb-1">Date</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-text-muted text-sm font-medium block mb-1">Location</label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="City, State"
                      className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-text-muted text-sm font-medium block mb-1">Federation</label>
                    <select
                      value={editFederation}
                      onChange={(e) => setEditFederation(e.target.value)}
                      className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
                    >
                      {FEDERATIONS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-text-muted text-sm font-medium block mb-1">Weight Class</label>
                    <select
                      value={editWeightClass}
                      onChange={(e) => setEditWeightClass(e.target.value)}
                      className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
                    >
                      <option value="">Select...</option>
                      {USPA_WEIGHT_CLASSES.map((wc) => (
                        <option key={wc.label} value={wc.value}>{wc.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-text-muted text-sm font-medium block mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
                    >
                      <option value="planned">Planned</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-text-muted text-sm font-medium block mb-1">Notes</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(meet.id)}
                    disabled={updateMutation.isPending || !editName.trim() || !editDate}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
                  >
                    <Check size={16} /> Save Changes
                  </button>
                  <button
                    onClick={() => setEditingMeet(null)}
                    className="px-4 py-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-light transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEditing(meet)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-text-muted hover:text-text hover:bg-surface-light transition-colors"
                  >
                    <Pencil size={14} /> Edit Details
                  </button>
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-danger text-sm">Delete this meet?</span>
                      <button
                        onClick={() => deleteMutation.mutate(meet.id)}
                        disabled={deleteMutation.isPending}
                        className="px-3 py-1.5 rounded-lg text-sm bg-danger/20 text-danger hover:bg-danger/30 transition-colors disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:text-text hover:bg-surface-light transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(meet.id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </div>

                {/* Notes */}
                {meet.notes && (
                  <p className="text-text-muted text-sm italic">{meet.notes}</p>
                )}

                {/* Openers */}
                <div>
                  <h4 className="text-text font-medium mb-3">Planned Openers (lbs)</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {(['squat', 'bench', 'deadlift'] as const).map((lift) => (
                      <div key={lift}>
                        <label className="text-text-muted text-sm font-medium block mb-1 capitalize">
                          {lift}
                        </label>
                        <input
                          type="number"
                          value={meetOpeners[lift]}
                          onChange={(e) =>
                            setOpeners((o) => ({
                              ...o,
                              [meet.id]: { ...meetOpeners, [lift]: e.target.value },
                            }))
                          }
                          placeholder="0"
                          className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => saveOpeners(meet.id)}
                    disabled={updateMutation.isPending}
                    className="mt-3 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
                  >
                    Save Openers
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-text flex items-center gap-3">
          <Trophy size={28} className="text-accent" /> Meet Planner
        </h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} /> Add Meet
        </button>
      </div>

      {/* Add meet form */}
      {showForm && (
        <div className="bg-surface rounded-xl p-5 border border-surface-light space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">New Meet</h2>
            <button onClick={resetForm} className="text-text-muted hover:text-text">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. USPA State Championships"
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">Location</label>
              <input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="City, State"
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">Federation</label>
              <select
                value={formFederation}
                onChange={(e) => setFormFederation(e.target.value)}
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
              >
                {FEDERATIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">
                Weight Class
              </label>
              <select
                value={formWeightClass}
                onChange={(e) => setFormWeightClass(e.target.value)}
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary"
              >
                <option value="">Select...</option>
                {USPA_WEIGHT_CLASSES.map((wc) => (
                  <option key={wc.label} value={wc.value}>{wc.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-text-muted text-sm font-medium block mb-1">Notes</label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Optional"
                className="w-full bg-bg border border-surface-light rounded-lg px-3 py-2 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={createMutation.isPending || !formName.trim() || !formDate}
            className="bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Meet'}
          </button>
          {createMutation.isError && (
            <p className="text-danger text-sm">Failed to create meet.</p>
          )}
        </div>
      )}

      {isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger">
          Failed to load meets.
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Upcoming */}
          <div>
            <h2 className="text-xl font-semibold text-text mb-4 flex items-center gap-2">
              <Timer size={20} className="text-accent" /> Upcoming Meets
            </h2>
            {upcomingMeets.length === 0 ? (
              <p className="text-text-muted bg-surface rounded-xl p-6 border border-surface-light text-center">
                No upcoming meets. Plan your next competition!
              </p>
            ) : (
              <div className="space-y-4">
                {upcomingMeets.map((meet) => renderMeetCard(meet, true))}
              </div>
            )}
          </div>

          {/* Past Meets */}
          {pastMeets.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-text mb-4">Past Meets</h2>
              <div className="space-y-3">
                {pastMeets.map((meet) => renderMeetCard(meet, false))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
