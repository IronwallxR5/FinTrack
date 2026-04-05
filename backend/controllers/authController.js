const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { isValidEmail } = require("../middlewares/validate");
const { SUPPORTED_CURRENCIES } = require("../config/currencies");

const SALT_ROUNDS = 10;

const register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (email.length > 255) {
      return res.status(400).json({
        success: false,
        message: "Email must not exceed 255 characters.",
      });
    }

    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 6 and 128 characters.",
      });
    }

    if (name && name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name must not exceed 100 characters.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.users.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered.",
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.users.create({
      data: {
        email: normalizedEmail,
        password_hash: passwordHash,
        name: name || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        preferred_currency: true,
        created_at: true,
      },
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          preferred_currency: user.preferred_currency,
          created_at: user.created_at,
        },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        preferred_currency: true,
        password_hash: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email. Please sign up first.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password. Please try again.",
      });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          preferred_currency: user.preferred_currency,
          created_at: user.created_at,
        },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        preferred_currency: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, password, preferred_currency } = req.body;

    if (!name && !password && !preferred_currency) {
      return res.status(400).json({
        success: false,
        message: "Provide at least name, password, or preferred_currency to update.",
      });
    }

    const data = {};

    if (name !== undefined) {
      if (name.length > 100) {
        return res.status(400).json({ success: false, message: "Name must not exceed 100 characters." });
      }
      data.name = name.trim();
    }

    if (password) {
      if (password.length < 6 || password.length > 128) {
        return res.status(400).json({
          success: false,
          message: "Password must be between 6 and 128 characters.",
        });
      }
      data.password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    if (preferred_currency) {
      const code = preferred_currency.toUpperCase();
      if (!SUPPORTED_CURRENCIES.includes(code)) {
        return res.status(400).json({
          success: false,
          message: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(", ")}.`,
        });
      }
      data.preferred_currency = code;
    }

    const updated = await prisma.users.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        preferred_currency: true,
        created_at: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated.",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getProfile, updateProfile };
