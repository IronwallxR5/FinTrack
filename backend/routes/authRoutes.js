const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const passport = require("../config/passport");
const { register, login, getProfile, updateProfile } = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getProfile);
router.put("/me", authMiddleware, updateProfile);


router.get("/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get("/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${FRONTEND_URL}/login?error=google_auth_failed`,
  }),
  (req, res) => {
    const token = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    req.logout(() => {});

    res.redirect(`${FRONTEND_URL}/oauth/callback?token=${token}`);
  }
);

module.exports = router;
