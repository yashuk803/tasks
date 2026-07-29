import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login: async (login, password) => {
        const { data } = await api.post('/auth/login', { login, password });
        set({ user: data.user, token: data.token });
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        return data.user;
      },

      logout: async () => {
        try { await api.post('/auth/logout'); } catch {}
        set({ user: null, token: null });
        delete api.defaults.headers.common['Authorization'];
      },

      setUser: (user) => set({ user }),

      isAdmin:   () => get().user?.role === 'ADMIN',
      isManager: () => get().user?.role === 'MANAGER' || get().user?.role === 'ADMIN',
    }),
    {
      name: 'wow-tasks-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        }
      },
    }
  )
);

export default useAuthStore;
