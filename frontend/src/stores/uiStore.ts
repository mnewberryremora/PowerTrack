import { create } from 'zustand'

interface UIState {
  displayUnit: 'lbs' | 'kg'
  sidebarOpen: boolean
  toggleUnit: () => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>((set) => ({
  displayUnit: 'lbs',
  sidebarOpen: true,
  toggleUnit: () =>
    set((s) => ({ displayUnit: s.displayUnit === 'lbs' ? 'kg' : 'lbs' })),
  toggleSidebar: () =>
    set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
