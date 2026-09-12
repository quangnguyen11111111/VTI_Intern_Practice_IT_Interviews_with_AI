import { logger } from './infrastructure/logging/logger';
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
import { OutboxDispatcher } from "./infrastructure/jobs/OutboxDispatcher";

const env = getEnv();

const startServer = async () => {
  try {
    // MongoDB
    await connectDatabase(env);

    // Start Agenda Background Jobs
    const jobScheduler = container.resolve<AgendaJobScheduler>('IJobScheduler');
    
    // Register Handlers
    jobScheduler.registerHandler(container.resolve(GenerateQuestionJobHandler));
    jobScheduler.registerHandler(container.resolve(EvaluateAnswersJobHandler));
    
    // Start Queue
    await jobScheduler.start();
    const outboxDispatcher = container.resolve(OutboxDispatcher);
    await outboxDispatcher.start();

    // Start Server
    const server = app.listen(env.PORT, () => {
      logger.info('server.started');
    });

    // Graceful Shutdown
    const gracefulShutdown = async () => {
      logger.info('server.stopping');
      server.close(() => {
        logger.info('server.closed');
      });
      outboxDispatcher.stop();
      await jobScheduler.stop();
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    logger.error('server.startup_failed');
    process.exit(1);
  }
};

startServer();
