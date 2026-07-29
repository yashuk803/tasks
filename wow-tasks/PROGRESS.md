# WOW Tasks — Прогресс разработки

Обновлено: 2026-07-29

---

## Agent B — Backend ✅ ЗАВЕРШЁН

### Выполнено:

1. **`src/utils/prisma.js`** — singleton PrismaClient создан.
   Все 8 файлов переведены с `new PrismaClient()` на singleton:
   - `middleware/auth.js`
   - `routes/auth.js`, `routes/users.js`, `routes/departments.js`, `routes/tasks.js`, `routes/notifications.js`
   - `services/visibility.js`, `services/fcm.js`

2. **`PUT /api/users/:id/transfer`** (ADMIN only) — добавлен в `routes/users.js`.
   Переводит сотрудника в другой отдел, валидирует существование отдела.

3. **`GET /api/departments/:id/tree`** — добавлен в `routes/departments.js`.
   Возвращает поддерево отдела (сам + все вложенные рекурсивно).

4. **Scheduled check просроченных задач** — добавлен в `src/index.js`.
   `setInterval` каждые 4 часа. Находит задачи `dueDate < now()` и `status NOT IN [DONE, CANCELLED]`,
   отправляет push assignees через `sendPushToUsers`.

5. **`.env`** — существовал, корректный.

6. **`prisma/seed.js`** — проверен, ошибок нет.

### Дополнительно (изменения от linter/другого агента, не откатывать):

- `routes/tasks.js` расширен:
  - `GET /api/tasks/:id` возвращает флаг `needsAcceptance` (задача назначена вверх по иерархии)
  - `POST /api/tasks/:id/accept` — endpoint принятия задачи assignee
  - `PUT /api/tasks/:id` — логирует изменения description и assignees в историю
  - Уведомления `TASK_REASSIGNED_REMOVED` / `TASK_REASSIGNED_ADDED`

- `services/fcm.js` расширен:
  - `notifyTaskEvent` принимает `extraData` (4-й параметр)
  - Новые события: `TASK_REASSIGNED_REMOVED`, `TASK_REASSIGNED_ADDED`, `DUE_SOON`

---

## Agent A — Frontend ⏳ НЕ НАЧАТ

Нужно создать в `/wow-tasks/frontend/src/`:

- `App.jsx` — Router + protected routes
- `pages/LoginPage.jsx`
- `pages/TasksPage.jsx`
- `pages/TaskDetailPage.jsx`
- `pages/TaskFormPage.jsx`
- `pages/DepartmentsPage.jsx`
- `pages/UsersPage.jsx`
- `components/layout/AppLayout.jsx`
- `components/layout/BottomNav.jsx`
- `components/tasks/TaskCard.jsx`
- `components/tasks/TaskFilters.jsx`
- `components/tasks/StatusBadge.jsx`
- `components/tasks/PriorityBadge.jsx`
- `components/departments/DeptTree.jsx`
- `components/users/UserCard.jsx`
- `components/ui/Modal.jsx`
- `components/ui/Spinner.jsx`
- `components/ui/EmptyState.jsx`
- `hooks/useTasks.js`
- `hooks/useUsers.js`
- `hooks/useDepartments.js`

Уже готово: `package.json`, `vite.config.js`, `tailwind.config.js`, `index.html`,
`src/main.jsx`, `src/index.css`, `src/i18n/*`, `src/store/authStore.js`, `src/utils/api.js`

Дизайн: `#1d5d86` primary, `#00b6be` teal, `#6bcbe0` light, `#f9a21a` accent.
Шрифты: PT Serif (заголовки), Inter (текст). Мобильный first, RTL (иврит).

---

## Agent C — Tests ⏳ НЕ НАЧАТ

Нужно в `/wow-tasks/backend/`:
- Установить jest + supertest в devDependencies
- `src/__tests__/visibility.test.js`
- `src/__tests__/auth.test.js`
- `src/__tests__/tasks.test.js`

---

## Дедлайн: 2026-07-31 13:00
