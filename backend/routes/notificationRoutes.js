const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
  deleteNotification,
  deleteAll,
} = require("../controllers/notificationController");

const router = express.Router();

router.use(authMiddleware);

router.get("/",             getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all",   markAllRead);
router.patch("/:id/read",   markAsRead);
router.delete("/",          deleteAll);
router.delete("/:id",       deleteNotification);

module.exports = router;
