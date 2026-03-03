const pool = require("../config/db");

const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page   = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const [listRes, countRes] = await Promise.all([
      pool.query(
        `SELECT id, type, title, message, is_read, created_at
         FROM   notifications
         WHERE  user_id = $1
         ORDER  BY created_at DESC
         LIMIT  $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN NOT is_read THEN 1 ELSE 0 END) AS unread FROM notifications WHERE user_id = $1",
        [userId]
      ),
    ]);

    return res.status(200).json({
      success: true,
      total:  parseInt(countRes.rows[0].total,  10),
      unread: parseInt(countRes.rows[0].unread, 10),
      page,
      limit,
      data: listRes.rows,
    });
  } catch (err) {
    next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      "SELECT COUNT(*) AS unread FROM notifications WHERE user_id = $1 AND NOT is_read",
      [userId]
    );
    return res.status(200).json({
      success: true,
      unread: parseInt(result.rows[0].unread, 10),
    });
  } catch (err) {
    next(err);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    return res.status(200).json({ success: true, message: "Notification marked as read." });
  } catch (err) {
    next(err);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND NOT is_read",
      [userId]
    );
    return res.status(200).json({ success: true, message: "All notifications marked as read." });
  } catch (err) {
    next(err);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await pool.query(
      "DELETE FROM notifications WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    return res.status(200).json({ success: true, message: "Notification deleted." });
  } catch (err) {
    next(err);
  }
};

const deleteAll = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await pool.query("DELETE FROM notifications WHERE user_id = $1", [userId]);
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
