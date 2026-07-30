const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding WOW Tasks database...');

  const hash = (p) => bcrypt.hash(p, 12);
  const PASSWORD = 'Password123';

  // ── Departments (flat, top-level) ──────────────────
  const management = await prisma.department.create({ data: { name: 'Management' } });
  const ipl        = await prisma.department.create({ data: { name: 'IPL' } });
  const sales       = await prisma.department.create({ data: { name: 'Sales' } });
  const smartComp   = await prisma.department.create({ data: { name: 'SmartComp' } });
  const it          = await prisma.department.create({ data: { name: 'IT' } });

  // ── Directors (ADMIN, Management) ──────────────────
  const arturSherman = await prisma.user.create({
    data: {
      email: 'a.sherman@wow-corp.com',
      login: 'a.sherman',
      passwordHash: await hash(PASSWORD),
      firstName: 'Артур',
      lastName: 'Шерман',
      role: 'ADMIN',
      position: 'Директор',
      departmentId: management.id,
    },
  });

  const vadimKarpun = await prisma.user.create({
    data: {
      email: 'v.karpun@wow-corp.com',
      login: 'v.karpun',
      passwordHash: await hash(PASSWORD),
      firstName: 'Вадим',
      lastName: 'Карпун',
      role: 'ADMIN',
      position: 'Директор',
      departmentId: management.id,
    },
  });

  const alexBekker = await prisma.user.create({
    data: {
      email: 'a.bekker@wow-corp.com',
      login: 'a.bekker',
      passwordHash: await hash(PASSWORD),
      firstName: 'Алекс',
      lastName: 'Беккер',
      role: 'ADMIN',
      position: 'Директор',
      departmentId: management.id,
    },
  });

  // ── Department Managers (MANAGER) ──────────────────
  const vitaliyKuznetsov = await prisma.user.create({
    data: {
      email: 'v.kuznetsov@wow-corp.com',
      login: 'v.kuznetsov',
      passwordHash: await hash(PASSWORD),
      firstName: 'Виталий',
      lastName: 'Кузнецов',
      role: 'MANAGER',
      position: 'Руководитель отдела',
      departmentId: ipl.id,
    },
  });

  const olyaGoncharova = await prisma.user.create({
    data: {
      email: 'o.goncharova@wow-corp.com',
      login: 'o.goncharova',
      passwordHash: await hash(PASSWORD),
      firstName: 'Оля',
      lastName: 'Гончарова',
      role: 'MANAGER',
      position: 'Руководитель отдела',
      departmentId: sales.id,
    },
  });

  const artemFerenets = await prisma.user.create({
    data: {
      email: 'a.ferenets@wow-corp.com',
      login: 'a.ferenets',
      passwordHash: await hash(PASSWORD),
      firstName: 'Артем',
      lastName: 'Ференец',
      role: 'MANAGER',
      position: 'Руководитель отдела',
      departmentId: smartComp.id,
    },
  });

  const igorVolkov = await prisma.user.create({
    data: {
      email: 'i.volkov@wow-corp.com',
      login: 'i.volkov',
      passwordHash: await hash(PASSWORD),
      firstName: 'Игорь',
      lastName: 'Волков',
      role: 'MANAGER',
      position: 'Руководитель отдела',
      departmentId: it.id,
    },
  });

  // Assign department heads
  await prisma.department.update({ where: { id: ipl.id }, data: { headId: vitaliyKuznetsov.id } });
  await prisma.department.update({ where: { id: sales.id }, data: { headId: olyaGoncharova.id } });
  await prisma.department.update({ where: { id: smartComp.id }, data: { headId: artemFerenets.id } });
  await prisma.department.update({ where: { id: it.id }, data: { headId: igorVolkov.id } });

  // ── Employees (EMPLOYEE) ────────────────────────────
  const mariaTarantsova = await prisma.user.create({
    data: {
      email: 'm.tarantsova@wow-corp.com',
      login: 'm.tarantsova',
      passwordHash: await hash(PASSWORD),
      firstName: 'Мария',
      lastName: 'Таранцова',
      role: 'EMPLOYEE',
      position: 'Менеджер по продажам',
      departmentId: sales.id,
    },
  });

  const yaroslavKryvulia = await prisma.user.create({
    data: {
      email: 'y.kryvulia@wow-corp.com',
      login: 'y.kryvulia',
      passwordHash: await hash(PASSWORD),
      firstName: 'Ярослав',
      lastName: 'Кривуля',
      role: 'EMPLOYEE',
      position: 'Специалист IT',
      departmentId: it.id,
    },
  });

  // ── Tasks (small placeholder set) ───────────────────
  const tasksData = [
    { title: 'Настроить процессы отдела', description: 'Определить регламенты и зоны ответственности', status: 'IN_PROGRESS', priority: 'HIGH', departmentId: ipl.id, authorId: arturSherman.id, assigneeIds: [vitaliyKuznetsov.id] },
    { title: 'Подготовить отчет за месяц', description: 'Сводка по продажам за июль', status: 'NEW', priority: 'MEDIUM', dueDate: new Date('2026-07-31'), departmentId: sales.id, authorId: olyaGoncharova.id, assigneeIds: [mariaTarantsova.id] },
    { title: 'Обзвон новых клиентов', description: 'Список лидов из CRM', status: 'IN_PROGRESS', priority: 'HIGH', departmentId: sales.id, authorId: olyaGoncharova.id, assigneeIds: [mariaTarantsova.id] },
    { title: 'Обновить документацию по проекту', description: 'Актуализировать техническую документацию SmartComp', status: 'NEW', priority: 'MEDIUM', departmentId: smartComp.id, authorId: vadimKarpun.id, assigneeIds: [artemFerenets.id] },
    { title: 'Настроить резервное копирование серверов', description: 'Проверить расписание бэкапов и восстановление', status: 'NEW', priority: 'HIGH', departmentId: it.id, authorId: igorVolkov.id, assigneeIds: [yaroslavKryvulia.id] },
    { title: 'Обновить рабочие станции сотрудников', description: 'Установить обновления ОС и антивирус', status: 'IN_PROGRESS', priority: 'MEDIUM', departmentId: it.id, authorId: igorVolkov.id, assigneeIds: [yaroslavKryvulia.id] },
    { title: 'Провести встречу с руководителями отделов', description: 'Согласовать планы на следующий квартал', status: 'NEW', priority: 'MEDIUM', dueDate: new Date('2026-08-05'), departmentId: management.id, authorId: alexBekker.id, assigneeIds: [vitaliyKuznetsov.id, olyaGoncharova.id, artemFerenets.id, igorVolkov.id] },
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
  console.log('\n📋 Test accounts (password for all: Password123):');
  console.log('  Director: a.sherman');
  console.log('  Director: v.karpun');
  console.log('  Director: a.bekker');
  console.log('  Manager:  v.kuznetsov (IPL)');
  console.log('  Manager:  o.goncharova (Sales)');
  console.log('  Manager:  a.ferenets (SmartComp)');
  console.log('  Manager:  i.volkov (IT)');
  console.log('  Employee: m.tarantsova (Sales)');
  console.log('  Employee: y.kryvulia (IT)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
