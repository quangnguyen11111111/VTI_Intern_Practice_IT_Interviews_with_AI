import "reflect-metadata";
import "./config/di";
import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import apiRoutes from "./routes";
import { AppError } from "./utils/AppError";
import { globalErrorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: "*"
  })
);

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "IT Interview AI API is running"
  });
});

// API v1 routes
app.use("/api/v1", apiRoutes);

// Catch-all cho API 404
app.use("/api", (req, res, next) => {
  next(new AppError(`Không tìm thấy API route: ${req.originalUrl}`, 404, "NOT_FOUND"));
});

// React Client static files & SPA fallback
const clientPath = path.join(process.cwd(), "client", "dist");
app.use(express.static(clientPath));

app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(clientPath, "index.html"), (err) => {
    if (err) {
      next();
    }
  });
});

// Middleware xử lý lỗi toàn cục
app.use(globalErrorHandler);

export default app;