import "reflect-metadata";
import "./config/di";
import dotenv from "dotenv";

dotenv.config();

import app from "./app";
import { connectDatabase } from "./config/database";
import { getEnv } from "./config/env";

const env = getEnv();

const startServer = async () => {
  try {
    // MongoDB
    await connectDatabase();

    // Start Server
    app.listen(env.PORT, () => {
      console.log(`Server running: http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();