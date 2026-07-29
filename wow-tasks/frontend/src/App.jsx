import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import TasksPage from './pages/TasksPage';
import TaskDetailPage from './pages/TaskDetailPage';
import TaskFormPage from './pages/TaskFormPage';
import DepartmentsPage from './pages/DepartmentsPage';
import UsersPage from './pages/UsersPage';

function RequireAuth({ children }) {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

function RequireManager({ children }) {
  const isManager = useAuthStore((s) => s.isManager);
  return isManager() ? children : <Navigate to="/tasks" replace />;
}

function RequireAdmin({ children }) {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  return isAdmin() ? children : <Navigate to="/tasks" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          {/* Default redirect */}
          <Route index element={<Navigate to="/tasks" replace />} />

          {/* My tasks */}
          <Route path="/tasks" element={<TasksPage deptMode={false} />} />

          {/* Department tasks (manager+) */}
          <Route
            path="/dept-tasks"
            element={
              <RequireManager>
                <TasksPage deptMode={true} />
              </RequireManager>
            }
          />

          {/* Task detail */}
          <Route path="/tasks/:id" element={<TaskDetailPage />} />

          {/* Create task - must be BEFORE /tasks/:id */}
          <Route
            path="/tasks/new"
            element={<TaskFormPage />}
          />

          {/* Edit task */}
          <Route
            path="/tasks/:id/edit"
            element={
              <RequireManager>
                <TaskFormPage />
              </RequireManager>
            }
          />

          {/* Users */}
          <Route
            path="/users"
            element={
              <RequireManager>
                <UsersPage />
              </RequireManager>
            }
          />

          {/* Departments (admin only) */}
          <Route
            path="/departments"
            element={
              <RequireAdmin>
                <DepartmentsPage />
              </RequireAdmin>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
