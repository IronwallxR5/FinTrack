const prisma = require("../config/prisma");

const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const [notifications, total, unread] = await Promise.all([
      prisma.notifications.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          is_read: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.notifications.count({ where: { user_id: userId } }),
      prisma.notifications.count({ where: { user_id: userId, is_read: false } }),
    ]);

    return res.status(200).json({
      success: true,
      total,
      unread,
      page,
      limit,
      data: notifications,
    });
  } catch (err) {
    next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const unread = await prisma.notifications.count({
      where: { user_id: userId, is_read: false },
    });
    return res.status(200).json({ success: true, unread });
  } catch (err) {
    next(err);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await prisma.notifications.updateMany({
      where: { id, user_id: userId },
      data: { is_read: true },
    });

    return res.status(200).json({ success: true, message: "Notification marked as read." });
  } catch (err) {
    next(err);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await prisma.notifications.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });
    return res.status(200).json({ success: true, message: "All notifications marked as read." });
  } catch (err) {
    next(err);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await prisma.notifications.deleteMany({
      where: { id, user_id: userId },
    });

    return res.status(200).json({ success: true, message: "Notification deleted." });
  } catch (err) {
    next(err);
  }
};

const deleteAll = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await prisma.notifications.deleteMany({
      where: { user_id: userId },
    });
    return res.status(200).json({ success: true, message: "All notifications cleared." });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
  deleteNotification,
  deleteAll,
};
