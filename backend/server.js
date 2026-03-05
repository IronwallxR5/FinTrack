const express = require("express");
const cors = require("cors");
const session = require("express-session");
const path = require("path");
require("dotenv").config();

const runMigrations = require("./config/migrate");
const passport = require("./config/passport");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const aiRoutes = require("./routes/aiRoutes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.set("trust proxy", 1);

const frontendUrl = (process.env.FRONTEND_URL || "*").replace(/\/$/, "");
app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json());

const isProduction = process.env.NODE_ENV === "production";
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 5 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/", (_req, res) => {
  res.json({ success: true, message: "Personal Finance Tracker API is running 🚀" });
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ai", aiRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await runMigrations();
  app.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`);
  });
};

startServer();