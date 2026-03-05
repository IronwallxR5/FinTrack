const express = require("express");
const router = express.Router();
const { chat, categorize } = require("../controllers/aiController");
const authMiddleware = require("../middlewares/authMiddleware");

router.use(authMiddleware);

router.post("/chat",       chat);
router.post("/categorize", categorize);

module.exports = router;
