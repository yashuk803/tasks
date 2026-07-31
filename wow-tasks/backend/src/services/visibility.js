const prisma = require('../utils/prisma');

/**
 * Get all department IDs that are descendants of the given department (including itself).
 * Uses recursive CTE for efficiency.
 */
async function getDescendantDeptIds(departmentId) {
  const result = await prisma.$queryRaw`
    WITH RECURSIVE dept_tree AS (
      SELECT id FROM "Department" WHERE id = ${departmentId}
      UNION ALL
      SELECT d.id FROM "Department" d
      INNER JOIN dept_tree dt ON d."parentId" = dt.id
    )
    SELECT id FROM dept_tree
  `;
  return result.map(r => r.id);
}

/**
 * Get all department IDs visible to a manager (their dept + all nested descendants).
 */
async function getVisibleDeptIds(user) {
  if (user.role === 'ADMIN') return null; // null = all departments

  if (user.role === 'MANAGER') {
    // Manager sees their own dept + all nested depts recursively
    const managedDeptId = user.headOfDept?.id || user.departmentId;
    if (!managedDeptId) return [user.departmentId].filter(Boolean);
    return getDescendantDeptIds(managedDeptId);
  }

  // EMPLOYEE: only their own department
  return [user.departmentId].filter(Boolean);
}

/**
 * Build Prisma WHERE clause for tasks visible to the current user.
 */
async function getTaskVisibilityFilter(user) {
  if (user.role === 'ADMIN') return {}; // sees everything

  if (user.role === 'MANAGER') {
    const visibleDeptIds = await getVisibleDeptIds(user);
    return {
      OR: [
        { departmentId: { in: visibleDeptIds } },
        { authorId: user.id },
        { assignees: { some: { userId: user.id } } },
      ],
    };
  }

  // EMPLOYEE: only tasks where they are author or assignee
  return {
    OR: [
      { authorId: user.id },
      { assignees: { some: { userId: user.id } } },
    ],
  };
}

/**
 * Check if user can access a specific task.
 */
async function canAccessTask(user, taskId) {
  const filter = await getTaskVisibilityFilter(user);
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...filter },
  });
  return !!task;
}

/**
 * Check if user can fully manage (edit all fields / delete) a specific task.
 * Per spec: this is a MANAGER+/ADMIN right (over their dept tree), plus the
 * task's own author. Plain EMPLOYEE assignees do NOT get full edit rights —
 * they can only change status and comment (see canChangeTaskStatus below).
 */
async function canManageTask(user, task) {
  if (user.role === 'ADMIN') return true;
  if (task.authorId === user.id) return true;

  if (user.role === 'MANAGER') {
    const visibleDeptIds = await getVisibleDeptIds(user);
    if (task.departmentId && visibleDeptIds.includes(task.departmentId)) return true;
  }

  return false;
}

/**
 * Check if user can at least change the status of a task (and comment on it).
 * Per spec, an EMPLOYEE who is just an assignee (not author/manager) is limited
 * to this — everyone who can fully manage a task can also do this.
 */
async function canChangeTaskStatus(user, task) {
  if (await canManageTask(user, task)) return true;
  return task.assignees?.some((a) => a.userId === user.id) ?? false;
}

/**
 * Build Prisma WHERE clause for users selectable as a task assignee.
 * Per spec: any user can assign a task to someone at their level or above in the
 * hierarchy (MANAGER/ADMIN roles, company-wide), in addition to whoever is already
 * within their direct management scope (own dept for EMPLOYEE, own subtree for
 * MANAGER). Assignments outside direct management scope require the assignee's
 * acceptance (see needsAcceptance in routes/tasks.js) — this filter only controls
 * who shows up as selectable, not whether acceptance is needed.
 */
async function getAssignableUsersFilter(user) {
  if (user.role === 'ADMIN') return {};

  const or = [{ role: { in: ['MANAGER', 'ADMIN'] } }];

  if (user.role === 'MANAGER') {
    const visibleDeptIds = await getVisibleDeptIds(user);
    if (visibleDeptIds?.length) or.push({ departmentId: { in: visibleDeptIds } });
  } else if (user.departmentId) {
    or.push({ departmentId: user.departmentId });
  }

  return { OR: or };
}

/**
 * Check if a user can assign tasks to another user.
 * Can assign to self or anyone below in hierarchy.
 */
async function canAssignToUser(assigner, targetUserId) {
  if (assigner.role === 'ADMIN') return true;
  if (assigner.id === targetUserId) return true;

  if (assigner.role === 'MANAGER') {
    const visibleDeptIds = await getVisibleDeptIds(assigner);
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) return false;
    return visibleDeptIds.includes(targetUser.departmentId);
  }

  return false;
}

module.exports = {
  getDescendantDeptIds,
  getVisibleDeptIds,
  getTaskVisibilityFilter,
  getAssignableUsersFilter,
  canAccessTask,
  canManageTask,
  canChangeTaskStatus,
  canAssignToUser,
};
