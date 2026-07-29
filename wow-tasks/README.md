# WOW Tasks — Корпоративный таск-трекер

Внутреннее приложение-трекер задач для компании **WOW Corporation**.

---

## Быстрый старт (локально)

### Требования
- Docker Desktop
- Node.js 20+ (только для фронтенда без Docker)

### Запуск

```bash
git clone <repo>
cd wow-tasks

# Запустить все сервисы
docker compose up -d

# Накатить миграции и заполнить тестовыми данными
docker exec wow-tasks-backend npx prisma migrate dev --name init
docker exec wow-tasks-backend npm run db:seed
```

**Приложение:** http://localhost:5174
**API:** http://localhost:4000
**API Health:** http://localhost:4000/health

---

## Тестовые учётные записи

| Роль | Логин | Пароль | Отдел |
|---|---|---|---|
| **Администратор** | `admin` | `Admin2026!` | WOW Corporation |
| **Руководитель разработки** | `dev_manager` | `Manager2026!` | Разработка |
| **Руководитель продаж** | `sales_manager` | `Manager2026!` | Продажи |
| **Тимлид Backend** | `backend_manager` | `Manager2026!` | Backend |
| **Сотрудник** | `emp_anna` | `Emp2026!` | Backend |
| **Сотрудник** | `emp_boris` | `Emp2026!` | Backend |
| **Сотрудник** | `emp_vera` | `Emp2026!` | Mobile |
| **Сотрудник** | `emp_gena` | `Emp2026!` | Mobile |
| **Сотрудник** | `emp_daria` | `Emp2026!` | Продажи IL |
| **Сотрудник** | `emp_elena` | `Emp2026!` | Продажи EU |
| **Сотрудник** | `emp_ivan` | `Emp2026!` | Административный отдел |

---

## Тестовые данные (seed)

### Структура отделов (4 уровня вложенности)

```
WOW Corporation
├── Разработка                  ← руководитель: dev_manager
│   ├── Backend                 ← руководитель: backend_manager
│   └── Mobile
├── Продажи                     ← руководитель: sales_manager
│   ├── Продажи IL
│   └── Продажи EU
└── Административный отдел
```

### Пользователи
- 1 администратор
- 3 руководителя отделов
- 7 сотрудников
- **Итого: 11 пользователей**

### Задачи
- **21 задача** распределена по отделам
- Статусы: `NEW` (9), `IN_PROGRESS` (7), `DONE` (5)
- Приоритеты: LOW, MEDIUM, HIGH, URGENT
- Несколько задач с несколькими исполнителями

---

## Технологический стек

### Frontend (`frontend/`)
- **React 18** + **Vite 5** — SPA, PWA (`vite-plugin-pwa`)
- **React Router 6** — маршрутизация
- **TanStack Query 5** — работа с серверным состоянием / кэширование
- **Zustand** — локальный стейт-менеджмент
- **Axios** — HTTP-клиент
- **i18next / react-i18next** — мультиязычность (RU, EN, HE с RTL)
- **Tailwind CSS 3** (+ `@tailwindcss/forms`, PostCSS, Autoprefixer) — стили
- **Firebase JS SDK** — приём push-уведомлений (FCM)
- **date-fns** — работа с датами

### Backend (`backend/`)
- **Node.js** + **Express 4** (+ `express-async-errors`, `express-validator`)
- **Prisma ORM 5** — доступ к БД и миграции
- **PostgreSQL** — основная база данных
- **jsonwebtoken** + **bcryptjs** — аутентификация/авторизация (JWT)
- **firebase-admin** — отправка push-уведомлений (FCM)
- **multer** — загрузка файлов (локальное хранилище)
- **cors**, **dotenv**, **uuid**
- **Jest** + **Supertest** — тестирование

### Инфраструктура
- **Docker Compose** — локальный запуск (frontend, backend, PostgreSQL)
- **Firebase Hosting** — деплой фронтенда
- **Railway** — планируемый хостинг backend + PostgreSQL в проде
- **Firebase Cloud Messaging (FCM)** — единственный канал push-уведомлений

```
Frontend  →  React + Vite (PWA)
Backend   →  Node.js + Express
Database  →  PostgreSQL + Prisma ORM
Push      →  Firebase Cloud Messaging (FCM)
```

### Порты (локально)
| Сервис | Порт |
|---|---|
| Frontend | 5174 |
| Backend API | 4000 |
| PostgreSQL | 5433 |

---

## Логика видимости задач

**Критически важная часть — проверяется на сервере, не только в интерфейсе.**

| Роль | Видит задачи |
|---|---|
| `ADMIN` | Все задачи в системе |
| `MANAGER` | Задачи своего отдела + **всех вложенных отделов рекурсивно** (только вниз, не вверх) |
| `EMPLOYEE` | Только задачи где он автор или исполнитель |

**Пример:**
- `dev_manager` (руководитель Разработки) видит задачи Разработки, Backend и Mobile
- `backend_manager` (руководитель Backend) **НЕ видит** задачи отдела Разработка и Mobile
- Попытка получить чужую задачу напрямую через API (по ID) — возвращает `404`, не `403`

Реализовано через рекурсивный SQL CTE запрос (`WITH RECURSIVE`).

---

## Правило удаления отдела

Отдел **нельзя удалить** если у него есть:
- Активные сотрудники
- Дочерние подотделы

→ API вернёт `400` с описанием что мешает удалению.
→ Нужно сначала перевести сотрудников в другой отдел и удалить / переместить дочерние отделы.

Задачи удалённого отдела **не удаляются** — они переходят в статус "без отдела" (`departmentId: null`) и остаются доступны через историю.

---

## Push-уведомления

Требуется разрешение браузера на уведомления.

| Событие | Кому |
|---|---|
| Задача назначена | Новому исполнителю |
| Изменён статус | Всем исполнителям + автору |
| Изменён приоритет / срок | Исполнителям |
| Задача закрыта / отменена | Автору |
| Срок задачи истёк | Исполнителям (проверка каждые 4 часа) |

Инициатор действия **не получает** уведомление о своём же изменении.

---

## Мультиязычность

Поддерживаемые языки:
- 🇷🇺 Русский
- 🇬🇧 English
- 🇮🇱 עברית (иврит, RTL)

Переключатель языка: на экране входа (правый верхний угол).

---

## Сброс тестовых данных

```bash
docker exec wow-tasks-backend npm run db:reset
```

---

## Переменные окружения

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://wowtasks:wowtasks_dev_2026@localhost:5433/wowtasks
JWT_SECRET=...
FIREBASE_ADMIN_SDK_PATH=./firebase-adminsdk.json
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:4000
VITE_FIREBASE_VAPID_KEY=...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=task-treker-wow-corp
```
