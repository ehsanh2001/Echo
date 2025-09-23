import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config, validateConfig } from "./config/env";
import userRoutes from "./routes/userRoutes";
import { prisma } from "./config/prisma";

validateConfig();

const app = express();

app.use(helmet());
app.use(cors());

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "user-service",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/users", userRoutes);

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
);

async function startServer() {
  try {
    await prisma.$connect();
    console.log("✅ Database connection established successfully");

    app.listen(config.port, () => {
      console.log(`User Service running on port ${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  console.log("��� SIGTERM received, shutting down gracefully");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("��� SIGINT received, shutting down gracefully");
  await prisma.$disconnect();
  process.exit(0);
});

export default app;

if (require.main === module) {
  startServer();
}
