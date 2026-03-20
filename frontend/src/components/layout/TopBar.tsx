import { LogOut, Menu } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useAuth } from '../../context/AuthContext'

export default function TopBar() {
  const { displayUnit, toggleUnit, toggleSidebar } = useUIStore()
  const { user, logout } = useAuth()

  return (
    <header className="h-14 bg-surface border-b border-surface-light flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded hover:bg-surface-light text-text-muted hover:text-text transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-bold text-text tracking-tight">PowerTrack</h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleUnit}
          className="px-3 py-1 text-sm font-medium rounded bg-surface-light hover:bg-primary/20 text-text-muted hover:text-text transition-colors border border-surface-light"
        >
          {displayUnit.toUpperCase()}
        </button>
        {user && (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span className="hidden sm:inline">{user.display_name ?? user.email}</span>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded hover:bg-surface-light hover:text-danger text-text-muted transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
