const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

prisma
  .$connect()
  .then(() => {
    console.log("Connected to PostgreSQL via Prisma");
  })
  .catch((err) => {
    console.error("Prisma database connection failed:", err.message);
  });

module.exports = prisma;
