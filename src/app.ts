import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import apiRoutes from "./routes";
import { globalErrorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: "*"
  })
);

app.use(morgan("dev"));

app.use(express.json());

app.use(express.urlencoded({
  extended: true
}));

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "IT Interview AI API is running"
  });
});

app.use("/api/v1", apiRoutes);

app.use(globalErrorHandler);

export default app;