import "dotenv/config"; // Load env vars immediately
import "reflect-metadata";
import "./config/di";

import app from "./app";
import { connectDatabase } from "./config/database";
import { getEnv } from "./config/env";

import { container } from "./config/di";
import { IJobScheduler } from "./domain/jobs/IJobScheduler";
import { GenerateQuestionJobHandler } from "./domain/jobs/handlers/GenerateQuestionJobHandler";
import { EvaluateAnswersJobHandler } from "./domain/jobs/handlers/EvaluateAnswersJobHandler";
import { AgendaJobScheduler } from "./infrastructure/jobs/AgendaJobScheduler";

const env = getEnv();

const startServer = async () => {
  try {
    // MongoDB
    await connectDatabase();

    // Start Agenda Background Jobs
    const jobScheduler = container.resolve<AgendaJobScheduler>('IJobScheduler');
    
    // Register Handlers
    jobScheduler.registerHandler(container.resolve(GenerateQuestionJobHandler));
    jobScheduler.registerHandler(container.resolve(EvaluateAnswersJobHandler));
    
    // Start Queue
    await jobScheduler.start();

    // Start Server
    const server = app.listen(env.PORT, () => {
      console.log(`Server running: http://localhost:${env.PORT}`);
    });

    // Graceful Shutdown
    const gracefulShutdown = async () => {
      console.log('Received kill signal, shutting down gracefully');
      server.close(() => {
        console.log('Closed out remaining connections');
      });
      await jobScheduler.stop();
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();