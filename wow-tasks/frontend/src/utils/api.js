import axios from 'axios';
import useAuthStore from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
  timeout: 15000,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginRequest = err.config?.url?.includes('/auth/login');
    // A 401 from the login form itself is just "wrong credentials" — let
    // LoginPage's own catch block show that error, don't touch the session.
    if (err.response?.status === 401 && !isLoginRequest) {
      // Clear the token in the store (not just localStorage) so RequireAuth
      // reacts immediately and navigates to /login via React Router —
      // instant, in-app, no dependency on a hard page reload finishing.
      useAuthStore.setState({ user: null, token: null });
      delete api.defaults.headers.common['Authorization'];
    }
    return Promise.reject(err);
  }
);

export default api;
