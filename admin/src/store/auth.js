import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      role: null,
      permissions: [],
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setRole: (role) => set({ role }),
      setPermissions: (permissions) => set({ permissions }),
      logout: () => set({ user: null, token: null, role: null, permissions: [] }),
      hasPermission: (permission) => {
        const state = useAuthStore.getState()
        if (state.role === 'MASTER_ADMIN') return true
        return state.permissions.includes(permission)
      },
    }),
    {
      name: 'admin-auth-storage',
    }
  )
)
