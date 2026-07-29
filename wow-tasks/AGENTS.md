# Инструкции для параллельных агентов

## Структура проекта
- /wow-tasks/backend  — Node.js + Express + Prisma
- /wow-tasks/frontend — React + Vite + PWA

## Agent A — Frontend UI (запускай в /wow-tasks/frontend)

**Задача:** Написать все React компоненты и страницы.

Уже готово: package.json, vite.config.js, tailwind.config.js, index.html, src/main.jsx, src/index.css, src/i18n/*, src/store/authStore.js, src/utils/api.js

**Нужно создать:**

1. `src/App.jsx` — Router setup с защищёнными маршрутами
2. `src/pages/LoginPage.jsx` — экран входа
3. `src/pages/TasksPage.jsx` — список задач с фильтрами
4. `src/pages/TaskDetailPage.jsx` — детали задачи, история, вложения
5. `src/pages/TaskFormPage.jsx` — создание/редактирование задачи
6. `src/pages/DepartmentsPage.jsx` — дерево отделов (admin only)
7. `src/pages/UsersPage.jsx` — список сотрудников (admin/manager)
8. `src/components/layout/AppLayout.jsx` — layout с нижней навигацией (мобильный)
9. `src/components/layout/BottomNav.jsx` — нижняя навигация
10. `src/components/tasks/TaskCard.jsx` — карточка задачи в списке
11. `src/components/tasks/TaskFilters.jsx` — фильтры задач
12. `src/components/tasks/StatusBadge.jsx` — бейдж статуса
13. `src/components/tasks/PriorityBadge.jsx` — бейдж приоритета
14. `src/components/departments/DeptTree.jsx` — дерево отделов
15. `src/components/users/UserCard.jsx` — карточка сотрудника
16. `src/components/ui/Modal.jsx` — модальное окно
17. `src/components/ui/Spinner.jsx` — загрузка
18. `src/components/ui/EmptyState.jsx` — пустой список
19. `src/hooks/useTasks.js` — React Query hooks для задач
20. `src/hooks/useUsers.js` — React Query hooks для пользователей
21. `src/hooks/useDepartments.js` — React Query hooks для отделов

**Дизайн:**
- Цвета: #1d5d86 (primary), #00b6be (teal), #6bcbe0 (light), #f9a21a (accent)
- Шрифты: PT Serif (заголовки), Inter/Proxima Nova (текст)
- Мобильный first, portrait orientation
- RTL для иврита — использовать `dir` от i18n, все margin/padding через logical properties (ms/me вместо ml/mr)
- Tailwind классы уже настроены: btn-primary, btn-secondary, card, input, label, badge, status-*, priority-*

**API endpoints:**
- POST /api/auth/login — { login, password } → { token, user }
- GET  /api/auth/me
- GET  /api/tasks?status=&priority=&assigneeId=&departmentId=&mine=true&search=
- POST /api/tasks — { title, description, priority, dueDate, departmentId, assigneeIds[] }
- PUT  /api/tasks/:id
- DELETE /api/tasks/:id
- GET  /api/users?departmentId=&role=&search=
- POST /api/users — admin only
- PUT  /api/users/:id — admin only
- GET  /api/departments
- POST /api/departments — admin only
- PUT  /api/departments/:id — admin only

**Стейт:**
- useAuthStore (zustand) — user, token, login(), logout(), isAdmin(), isManager()

---

## Agent B — Backend completion (запускай в /wow-tasks/backend)

**Задача:** Проверить и дополнить backend. Всё основное уже написано.

Уже готово: package.json, Dockerfile, prisma/schema.prisma, prisma/seed.js, src/index.js, все routes (auth, users, departments, tasks, notifications), middleware (auth, errorHandler), services (visibility, fcm)

**Нужно добавить/проверить:**

1. `src/utils/prisma.js` — singleton PrismaClient (сейчас каждый файл создаёт свой, нужно вынести)
2. Проверить что все routes правильно импортируют middleware
3. Добавить endpoint `PUT /api/users/:id/transfer` — перевод сотрудника в другой отдел
4. Добавить endpoint `GET /api/departments/:id/tree` — поддерево отдела
5. Добавить scheduled check на просроченные задачи (простой cron через setInterval):
   - Каждые 4 часа проверять задачи у которых dueDate < now() и status != DONE/CANCELLED
   - Отправлять push assignees
6. Убедиться что prisma/seed.js работает без ошибок
7. `.env` файл создать из `.env.example` для локального запуска

**Важно — бизнес логика visibility (уже реализована в src/services/visibility.js):**
- ADMIN видит всё
- MANAGER видит задачи своего отдела + ВСЕХ вложенных отделов рекурсивно (вниз, НЕ вверх)
- EMPLOYEE видит только задачи где он автор или исполнитель
- Эта проверка должна быть на сервере, не только на клиенте

---

## Agent C — Tests (запускай в /wow-tasks/backend)

**Задача:** Написать тесты для критической бизнес-логики.

**Нужно:**

1. Установить jest + supertest: добавить в devDependencies package.json
2. `src/__tests__/visibility.test.js` — тесты сервиса видимости:
   - ADMIN видит все задачи
   - MANAGER видит задачи своего отдела
   - MANAGER видит задачи вложенных отделов (рекурсивно)
   - MANAGER НЕ видит задачи отдела выше
   - EMPLOYEE видит только свои задачи
   - После перемещения отдела права пересчитываются
3. `src/__tests__/auth.test.js` — тесты авторизации:
   - Успешный логин
   - Неверный пароль
   - Неактивный пользователь
   - JWT expire
4. `src/__tests__/tasks.test.js` — тесты CRUD задач:
   - Создание задачи
   - Назначение исполнителей
   - Запрет доступа к чужой задаче по ID
   - История изменений записывается

Использовать test database (отдельная БД или mock Prisma).
