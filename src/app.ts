import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

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

export default app;