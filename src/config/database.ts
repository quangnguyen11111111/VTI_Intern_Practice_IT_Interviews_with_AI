import mongoose from "mongoose";
import { AppEnv } from './env';
import { logger } from '../infrastructure/logging/logger';

export const connectDatabase = async (env: AppEnv): Promise<void> => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      autoIndex: env.NODE_ENV !== 'production', autoCreate: env.NODE_ENV !== 'production',
    });
    logger.info('database.connected');
  } catch (error) {
    logger.error('database.connection_failed');
    throw new Error('DATABASE_CONNECTION_FAILED');
  }
};
