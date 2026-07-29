const prisma = require('../utils/prisma');

let admin = null;

function getFirebaseAdmin() {
  if (admin) return admin;

  try {
    let serviceAccount;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      // Preferred on hosting platforms (Railway, etc.): full JSON as one env var
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      serviceAccount = {
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
      };
    } else if (process.env.FIREBASE_ADMIN_SDK_PATH) {
      // Local dev: path to the downloaded service account JSON file
      const path = require('path');
      serviceAccount = require(path.resolve(process.env.FIREBASE_ADMIN_SDK_PATH));
    } else {
      return null;
    }

    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized for project:', serviceAccount.project_id);
    }
    return admin;
  } catch (e) {
    console.warn('Firebase Admin not initialized:', e.message);
    return null;
  }
}

async function sendPushToUsers(userIds, payload, excludeUserId = null) {
  const fb = getFirebaseAdmin();
  if (!fb) return; // Push disabled if Firebase not configured

  const tokens = await prisma.pushToken.findMany({
    where: {
      userId: { in: userIds.filter(id => id !== excludeUserId) },
    },
    select: { token: true },
  });

  if (!tokens.length) return;

  const tokenList = tokens.map(t => t.token);

  try {
    const result = await fb.messaging().sendEachForMulticast({
      tokens: tokenList,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      webpush: {
        fcmOptions: { link: payload.link || '/' },
      },
    });

    console.log(`[FCM] Sent to ${tokenList.length} token(s): ${result.successCount} succeeded, ${result.failureCount} failed`);
    result.responses.forEach((r, i) => {
      if (!r.success) {
        console.warn(`[FCM] Token failed (${tokenList[i].slice(0, 12)}...): ${r.error?.code} — ${r.error?.message}`);
      }
    });
  } catch (e) {
    console.error('FCM send error:', e.message);
  }
}

async function notifyTaskEvent(event, task, actor, assigneeIds = [], authorId = null, extraData = {}) {
  const fb = getFirebaseAdmin();
  if (!fb) return;

  const taskLink = `/tasks/${task.id}`;
  const taskTitle = task.title;

  const configs = {
    TASK_ASSIGNED: {
      to: assigneeIds,
      title: 'New task assigned',
      body: `You have been assigned: "${taskTitle}"`,
    },
    STATUS_CHANGED: {
      to: [...new Set([...assigneeIds, authorId].filter(Boolean))],
      title: 'Task status updated',
      body: `"${taskTitle}" status changed to ${task.status}`,
    },
    PRIORITY_CHANGED: {
      to: assigneeIds,
      title: 'Task priority updated',
      body: `"${taskTitle}" priority changed`,
    },
    DUE_DATE_CHANGED: {
      to: assigneeIds,
      title: 'Task due date changed',
      body: `"${taskTitle}" due date updated`,
    },
    TASK_CLOSED: {
      to: [authorId].filter(Boolean),
      title: 'Task closed',
      body: `"${taskTitle}" has been closed`,
    },
    TASK_CANCELLED: {
      to: [authorId].filter(Boolean),
      title: 'Task cancelled',
      body: `"${taskTitle}" has been cancelled`,
    },
    TASK_REASSIGNED_REMOVED: {
      to: extraData.removedAssigneeIds || [],
      title: 'Вас сняли с задачи',
      body: `Вы больше не исполнитель задачи "${taskTitle}"`,
    },
    TASK_REASSIGNED_ADDED: {
      to: extraData.addedAssigneeIds || [],
      title: 'Вам назначена задача',
      body: `Вас добавили как исполнителя: "${taskTitle}"`,
    },
    DUE_SOON: {
      to: assigneeIds,
      title: 'Срок задачи истекает',
      body: `До срока выполнения "${taskTitle}" осталось менее 24 часов`,
    },
  };

  const config = configs[event];
  if (!config || !config.to.length) return;

  await sendPushToUsers(config.to, {
    title: config.title,
    body: config.body,
    link: taskLink,
    data: { taskId: task.id, event },
  }, actor.id); // Don't notify the actor themselves
}

module.exports = { sendPushToUsers, notifyTaskEvent };
