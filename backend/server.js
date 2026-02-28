const express = require("express");
const cors = require("cors");
require("dotenv").config();

const runMigrations = require("./config/migrate");
const authRoutes = require("./routes/authRoutes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ success: true, message: "Personal Finance Tracker API is running 🚀" });
});

app.use("/api/auth", authRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await runMigrations();
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on PORT ${PORT}`);
  });
};

startServer();