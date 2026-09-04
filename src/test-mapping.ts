import mongoose from 'mongoose';
import Role from './models/role.model';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/it-interview-ai');
  const role = await Role.findOne();
  console.log('Role found:', role);
  if (role) {
    const id = role._id.toString();
    console.log('Valid?', mongoose.Types.ObjectId.isValid(id));
    const found = await Role.findById(id);
    console.log('Found by ID:', found);
  }
  process.exit(0);
}
run();
