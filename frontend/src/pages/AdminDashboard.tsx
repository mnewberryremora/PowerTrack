import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, Users, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { adminApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { AdminUser } from '../types'

type AdminTab = 'pending' | 'all'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    approved: 'bg-green-500/20 text-green-400',
    denied: 'bg-red-500/20 text-red-400',
  }
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
        styles[status] ?? 'bg-surface-light text-text-muted'
      }`}
    >
      {status}
    </span>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<AdminTab>('pending')

  // Redirect non-admins
  useEffect(() => {
    if (user && !user.is_admin) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const { data: users, isLoading, isError } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.users(),
    enabled: Boolean(user?.is_admin),
  })

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: string }) =>
      adminApi.updateStatus(userId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const adminToggleMutation = useMutation({
    mutationFn: (userId: number) => adminApi.toggleAdmin(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => adminApi.deleteUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  function handleDelete(u: AdminUser) {
    if (window.confirm(`Permanently delete ${u.email}? This cannot be undone.`)) {
      deleteMutation.mutate(u.id)
    }
  }

  const pendingUsers = (users ?? []).filter((u) => u.status === 'pending')
  const allUsers = users ?? []

  function handleToggleAdmin(u: AdminUser) {
    const action = u.is_admin ? 'remove admin from' : 'grant admin to'
    if (window.confirm(`Are you sure you want to ${action} ${u.email}?`)) {
      adminToggleMutation.mutate(u.id)
    }
  }

  const tabs: { key: AdminTab; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending Approval', count: pendingUsers.length },
    { key: 'all', label: 'All Users', count: allUsers.length },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <ShieldCheck size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-text">Admin Dashboard</h1>
          <p className="text-text-muted text-sm">Manage user registrations and permissions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface border border-surface-light rounded-lg p-1 gap-1 w-fit">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {label}
            {count != null && count > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === key ? 'bg-white/20' : 'bg-surface-light'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {isError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger">
          Failed to load users.
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Pending Approval Tab */}
      {!isLoading && !isError && activeTab === 'pending' && (
        <>
          {pendingUsers.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
              <p className="text-text-muted text-lg">No pending registrations.</p>
              <p className="text-text-muted text-sm mt-1">All users have been reviewed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((u) => (
                <div
                  key={u.id}
                  className="bg-surface rounded-xl border border-surface-light p-4 flex items-center justify-between flex-wrap gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center">
                      <Clock size={18} className="text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-text font-medium">{u.email}</p>
                      {u.display_name && (
                        <p className="text-text-muted text-sm">{u.display_name}</p>
                      )}
                      <p className="text-text-muted text-xs mt-0.5">
                        Registered{' '}
                        {new Date(u.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => statusMutation.mutate({ userId: u.id, status: 'approved' })}
                      disabled={statusMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      onClick={() => statusMutation.mutate({ userId: u.id, status: 'denied' })}
                      disabled={statusMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={14} /> Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* All Users Tab */}
      {!isLoading && !isError && activeTab === 'all' && (
        <>
          {allUsers.length === 0 ? (
            <div className="text-center py-16">
              <Users size={48} className="mx-auto text-text-muted mb-4" />
              <p className="text-text-muted text-lg">No users found.</p>
            </div>
          ) : (
            <div className="bg-surface rounded-xl border border-surface-light overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-light">
                    <th className="text-left px-4 py-3 text-text-muted font-medium">Email</th>
                    <th className="text-left px-4 py-3 text-text-muted font-medium hidden sm:table-cell">Name</th>
                    <th className="text-left px-4 py-3 text-text-muted font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-text-muted font-medium hidden md:table-cell">Admin</th>
                    <th className="text-left px-4 py-3 text-text-muted font-medium hidden lg:table-cell">Registered</th>
                    <th className="text-right px-4 py-3 text-text-muted font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-light">
                  {allUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-light/40 transition-colors">
                      <td className="px-4 py-3 text-text">{u.email}</td>
                      <td className="px-4 py-3 text-text-muted hidden sm:table-cell">
                        {u.display_name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {u.is_admin ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary">
                            Admin
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">User</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted hidden lg:table-cell">
                        {new Date(u.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end flex-wrap">
                          {u.status === 'pending' && (
                            <>
                              <button
                                onClick={() => statusMutation.mutate({ userId: u.id, status: 'approved' })}
                                disabled={statusMutation.isPending}
                                className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => statusMutation.mutate({ userId: u.id, status: 'denied' })}
                                disabled={statusMutation.isPending}
                                className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                              >
                                Deny
                              </button>
                            </>
                          )}
                          {u.status === 'approved' && (
                            <button
                              onClick={() => statusMutation.mutate({ userId: u.id, status: 'denied' })}
                              disabled={statusMutation.isPending}
                              className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                            >
                              Deny
                            </button>
                          )}
                          {u.status === 'denied' && (
                            <button
                              onClick={() => statusMutation.mutate({ userId: u.id, status: 'approved' })}
                              disabled={statusMutation.isPending}
                              className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleAdmin(u)}
                            disabled={adminToggleMutation.isPending}
                            className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                          >
                            {u.is_admin ? 'Remove Admin' : 'Make Admin'}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={deleteMutation.isPending}
                            className="px-2 py-1 rounded text-xs font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-colors disabled:opacity-50"
                            title="Delete user"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
