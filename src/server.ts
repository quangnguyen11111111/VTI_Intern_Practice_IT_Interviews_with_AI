import "dotenv/config"; // Load env vars immediately
import "reflect-metadata";
import "./config/di";

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