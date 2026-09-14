import mongoose from 'mongoose';
import { ProviderUsageAttemptModel } from './src/models/ProviderUsageAttempt';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const attempt = await ProviderUsageAttemptModel.find({ status: 'FAILED' })
    .sort({ createdAt: -1 })
    .limit(1)
    .lean();
  console.log('Latest FAILED attempt:', attempt);
  
  const ops = await mongoose.connection.collection('operationrecords').find({ status: 'FAILED' }).sort({ createdAt: -1 }).limit(1).toArray();
  console.log('Latest FAILED operation:', ops);
  
  process.exit(0);
}

run().catch(console.error);
