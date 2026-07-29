const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding WOW Tasks database...');

  // ── Departments tree ──────────────────────────────
  const root = await prisma.department.create({ data: { name: 'WOW Corporation' } });
  const dev  = await prisma.department.create({ data: { name: 'Разработка', parentId: root.id } });
  const backend = await prisma.department.create({ data: { name: 'Backend', parentId: dev.id } });
  const mobile  = await prisma.department.create({ data: { name: 'Mobile', parentId: dev.id } });
  const sales   = await prisma.department.create({ data: { name: 'Продажи', parentId: root.id } });
  const salesIL = await prisma.department.create({ data: { name: 'Продажи IL', parentId: sales.id } });
  const salesEU = await prisma.department.create({ data: { name: 'Продажи EU', parentId: sales.id } });
  const admin   = await prisma.department.create({ data: { name: 'Административный отдел', parentId: root.id } });

  const hash = (p) => bcrypt.hash(p, 12);

  // ── Admin ─────────────────────────────────────────
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@wow-corp.com',
      login: 'admin',
      passwordHash: await hash('Admin2026!'),
      firstName: 'Алексей',
      lastName: 'Директоров',
      role: 'ADMIN',
      position: 'Директор',
      departmentId: root.id,
    },
  });

  // ── Managers ──────────────────────────────────────
  const managerDev = await prisma.user.create({
    data: {
      email: 'dev.manager@wow-corp.com',
      login: 'dev_manager',
      passwordHash: await hash('Manager2026!'),
      firstName: 'Иван',
      lastName: 'Разработчиков',
      role: 'MANAGER',
      position: 'Руководитель разработки',
      departmentId: dev.id,
    },
  });

  const managerSales = await prisma.user.create({
    data: {
      email: 'sales.manager@wow-corp.com',
      login: 'sales_manager',
      passwordHash: await hash('Manager2026!'),
      firstName: 'Мария',
      lastName: 'Продажникова',
      role: 'MANAGER',
      position: 'Руководитель продаж',
      departmentId: sales.id,
    },
  });

  const managerBackend = await prisma.user.create({
    data: {
      email: 'backend.manager@wow-corp.com',
      login: 'backend_manager',
      passwordHash: await hash('Manager2026!'),
      firstName: 'Сергей',
      lastName: 'Бэкендов',
      role: 'MANAGER',
      position: 'Тимлид Backend',
      departmentId: backend.id,
    },
  });

  // Assign heads
  await prisma.department.update({ where: { id: dev.id },     data: { headId: managerDev.id } });
  await prisma.department.update({ where: { id: sales.id },   data: { headId: managerSales.id } });
  await prisma.department.update({ where: { id: backend.id }, data: { headId: managerBackend.id } });

  // ── Employees ─────────────────────────────────────
  const employees = await Promise.all([
    prisma.user.create({ data: { email: 'emp1@wow-corp.com', login: 'emp_anna', passwordHash: await hash('Emp2026!'), firstName: 'Анна', lastName: 'Кодерова', role: 'EMPLOYEE', position: 'Backend разработчик', departmentId: backend.id } }),
    prisma.user.create({ data: { email: 'emp2@wow-corp.com', login: 'emp_boris', passwordHash: await hash('Emp2026!'), firstName: 'Борис', lastName: 'Питонов', role: 'EMPLOYEE', position: 'Backend разработчик', departmentId: backend.id } }),
    prisma.user.create({ data: { email: 'emp3@wow-corp.com', login: 'emp_vera', passwordHash: await hash('Emp2026!'), firstName: 'Вера', lastName: 'Мобильникова', role: 'EMPLOYEE', position: 'iOS разработчик', departmentId: mobile.id } }),
    prisma.user.create({ data: { email: 'emp4@wow-corp.com', login: 'emp_gena', passwordHash: await hash('Emp2026!'), firstName: 'Геннадий', lastName: 'Андроидов', role: 'EMPLOYEE', position: 'Android разработчик', departmentId: mobile.id } }),
    prisma.user.create({ data: { email: 'emp5@wow-corp.com', login: 'emp_daria', passwordHash: await hash('Emp2026!'), firstName: 'Дарья', lastName: 'Продажная', role: 'EMPLOYEE', position: 'Менеджер по продажам IL', departmentId: salesIL.id } }),
    prisma.user.create({ data: { email: 'emp6@wow-corp.com', login: 'emp_elena', passwordHash: await hash('Emp2026!'), firstName: 'Елена', lastName: 'Европейская', role: 'EMPLOYEE', position: 'Менеджер по продажам EU', departmentId: salesEU.id } }),
    prisma.user.create({ data: { email: 'emp7@wow-corp.com', login: 'emp_ivan', passwordHash: await hash('Emp2026!'), firstName: 'Игорь', lastName: 'Административный', role: 'EMPLOYEE', position: 'Офис-менеджер', departmentId: admin.id } }),
  ]);

  const [anna, boris, vera, gena, daria, elena, igor] = employees;

  // ── Tasks (20+) ───────────────────────────────────
  const tasksData = [
    // Backend tasks
    { title: 'Разработать API авторизации', description: 'JWT токены, refresh, blacklist', status: 'DONE', priority: 'HIGH', departmentId: backend.id, authorId: managerBackend.id, assigneeIds: [anna.id] },
    { title: 'Оптимизация запросов к БД', description: 'Добавить индексы на таблицы tasks и users', status: 'IN_PROGRESS', priority: 'HIGH', departmentId: backend.id, authorId: managerBackend.id, assigneeIds: [boris.id] },
    { title: 'Написать юнит-тесты для сервиса видимости', description: 'Покрытие >80%, тестировать рекурсию по иерархии', status: 'NEW', priority: 'MEDIUM', departmentId: backend.id, authorId: managerDev.id, assigneeIds: [anna.id, boris.id] },
    { title: 'Настроить CI/CD pipeline', description: 'GitHub Actions, автодеплой на Railway', status: 'NEW', priority: 'MEDIUM', departmentId: backend.id, authorId: managerDev.id, assigneeIds: [managerBackend.id] },
    { title: 'Реализовать FCM push уведомления', description: 'Интеграция Firebase Admin SDK', status: 'IN_PROGRESS', priority: 'HIGH', departmentId: backend.id, authorId: managerBackend.id, assigneeIds: [anna.id] },
    { title: 'Добавить загрузку файлов', description: 'Multer, валидация типов, лимит 10MB', status: 'DONE', priority: 'LOW', departmentId: backend.id, authorId: managerBackend.id, assigneeIds: [boris.id] },
    { title: 'Реализовать историю изменений задачи', description: 'Логировать поля: status, priority, dueDate, assignees', status: 'IN_PROGRESS', priority: 'MEDIUM', departmentId: backend.id, authorId: managerBackend.id, assigneeIds: [anna.id] },

    // Mobile tasks
    { title: 'Разработать экран авторизации', description: 'Дизайн по брендбуку WOW', status: 'DONE', priority: 'HIGH', departmentId: mobile.id, authorId: managerDev.id, assigneeIds: [vera.id] },
    { title: 'Реализовать PWA манифест', description: 'Иконки, splash screen, offline режим', status: 'IN_PROGRESS', priority: 'HIGH', departmentId: mobile.id, authorId: managerDev.id, assigneeIds: [vera.id, gena.id] },
    { title: 'Поддержка RTL для иврита', description: 'Направление текста, зеркалирование layout', status: 'IN_PROGRESS', priority: 'HIGH', departmentId: mobile.id, authorId: managerDev.id, assigneeIds: [vera.id] },
    { title: 'Экран списка задач с фильтрами', description: 'Фильтры: статус, исполнитель, срок, отдел', status: 'NEW', priority: 'HIGH', departmentId: mobile.id, authorId: managerDev.id, assigneeIds: [gena.id] },
    { title: 'Экран детали задачи', description: 'История, вложения, смена статуса', status: 'NEW', priority: 'MEDIUM', departmentId: mobile.id, authorId: managerDev.id, assigneeIds: [vera.id] },
    { title: 'Тестирование на реальных устройствах', description: 'iOS Safari, Android Chrome', status: 'NEW', priority: 'MEDIUM', dueDate: new Date('2026-07-31'), departmentId: mobile.id, authorId: managerDev.id, assigneeIds: [vera.id, gena.id] },

    // Sales tasks
    { title: 'Обзвон клиентов IL — Q3 2026', description: 'Список в CRM, цель: 50 контактов', status: 'IN_PROGRESS', priority: 'HIGH', departmentId: salesIL.id, authorId: managerSales.id, assigneeIds: [daria.id] },
    { title: 'Подготовить коммерческое предложение EU', description: 'На английском, шаблон в Google Drive', status: 'NEW', priority: 'MEDIUM', departmentId: salesEU.id, authorId: managerSales.id, assigneeIds: [elena.id] },
    { title: 'Отчёт по продажам за июль', description: 'Сводная таблица IL + EU', status: 'NEW', priority: 'HIGH', dueDate: new Date('2026-07-31'), departmentId: sales.id, authorId: managerSales.id, assigneeIds: [daria.id, elena.id] },
    { title: 'Обновить прайс-лист EU', description: 'Актуализировать цены с учётом курса', status: 'DONE', priority: 'MEDIUM', departmentId: salesEU.id, authorId: managerSales.id, assigneeIds: [elena.id] },

    // Admin tasks
    { title: 'Оформить онбординг для новых сотрудников', description: 'Инструкция по WOW Tasks, доступы', status: 'NEW', priority: 'LOW', departmentId: admin.id, authorId: adminUser.id, assigneeIds: [igor.id] },
    { title: 'Заказать канцтовары', description: 'Список на июль, согласовать бюджет', status: 'DONE', priority: 'LOW', departmentId: admin.id, authorId: adminUser.id, assigneeIds: [igor.id] },
    { title: 'Корпоратив WOW — планирование', description: 'Дата: 15 августа, локация, программа', status: 'IN_PROGRESS', priority: 'MEDIUM', dueDate: new Date('2026-08-01'), departmentId: admin.id, authorId: adminUser.id, assigneeIds: [igor.id] },
    { title: 'Разослать уведомления о запуске WOW Tasks', description: 'Email всем сотрудникам, инструкция по входу', status: 'NEW', priority: 'URGENT', dueDate: new Date('2026-07-31'), departmentId: admin.id, authorId: adminUser.id, assigneeIds: [igor.id] },
  ];

  for (const t of tasksData) {
    const { assigneeIds, dueDate, ...rest } = t;
    await prisma.task.create({
      data: {
        ...rest,
        dueDate: dueDate || null,
        assignees: { create: assigneeIds.map(uid => ({ userId: uid })) },
      },
    });
  }

  console.log('✅ Seed complete!');
  console.log('\n📋 Test accounts:');
  console.log('  Admin:   admin / Admin2026!');
  console.log('  Manager: dev_manager / Manager2026!');
  console.log('  Manager: sales_manager / Manager2026!');
  console.log('  Manager: backend_manager / Manager2026!');
  console.log('  Employee: emp_anna / Emp2026!');
  console.log('  Employee: emp_boris / Emp2026!');
  console.log('  Employee: emp_vera / Emp2026!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
