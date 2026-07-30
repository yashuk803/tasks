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

Пароль у всех пользователей одинаковый: `Password123`

| Роль | Логин | ФИО | Отдел |
|---|---|---|---|
| **Director (ADMIN)** | `a.sherman` | Артур Шерман | Management |
| **Director (ADMIN)** | `v.karpun` | Вадим Карпун | Management |
| **Director (ADMIN)** | `a.bekker` | Алекс Беккер | Management |
| **DepartmentManager (MANAGER)** | `v.kuznetsov` | Виталий Кузнецов | IPL |
| **DepartmentManager (MANAGER)** | `o.goncharova` | Оля Гончарова | Sales |
| **DepartmentManager (MANAGER)** | `a.ferenets` | Артем Ференец | SmartComp |
| **DepartmentManager (MANAGER)** | `i.volkov` | Игорь Волков | IT |
| **Employee** | `m.tarantsova` | Мария Таранцова | Sales |
| **Employee** | `y.kryvulia` | Ярослав Кривуля | IT |

---

## Тестовые данные (seed)

### Структура отделов (плоская, без вложенности)

```
Management     ← Артур Шерман, Вадим Карпун, Алекс Беккер (Director)
IPL            ← руководитель: v.kuznetsov
Sales          ← руководитель: o.goncharova
SmartComp      ← руководитель: a.ferenets
IT             ← руководитель: i.volkov
```

### Пользователи
- 3 директора (ADMIN, Management)
- 4 руководителя отделов (MANAGER)
- 2 сотрудника (EMPLOYEE)
- **Итого: 9 пользователей**

### Задачи
- **7 задач**-заглушек распределены по отделам для наглядности после ресида

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
- `i.volkov` (руководитель IT) видит только задачи отдела IT
- `o.goncharova` (руководитель Sales) **НЕ видит** задачи отдела IT
- Попытка получить чужую задачу напрямую через API (по ID) — возвращает `404`, не `403`

*В текущем сиде отделы плоские (без вложенности), но рекурсивная логика видимости в коде сохранена и сработает, если появятся вложенные отделы.*

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
