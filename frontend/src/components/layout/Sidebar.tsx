import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Dumbbell,
  ListChecks,
  Trophy,
  Scale,
  Calendar,
  ClipboardList,
  Brain,
  Settings2,
  FileSpreadsheet,
} from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/import', label: 'Import', icon: FileSpreadsheet },
  { to: '/exercises', label: 'Exercises', icon: ListChecks },
  { to: '/prs', label: 'PRs', icon: Trophy },
  { to: '/body-metrics', label: 'Body Metrics', icon: Scale },
  { to: '/meets', label: 'Meets', icon: Calendar },
  { to: '/programs', label: 'Programs', icon: ClipboardList },
  { to: '/ai-coach', label: 'AI Coach', icon: Brain },
  { to: '/settings', label: 'Settings', icon: Settings2 },
]

export default function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  return (
    <aside
      className={`${
        sidebarOpen ? 'w-56' : 'w-16'
      } bg-surface border-r border-surface-light flex flex-col shrink-0 transition-all duration-200 overflow-hidden`}
    >
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-muted hover:bg-surface-light hover:text-text'
              }`
            }
          >
            <Icon size={20} className="shrink-0" />
            {sidebarOpen && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
