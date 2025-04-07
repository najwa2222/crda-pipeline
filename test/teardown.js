// test/teardown.js (critical for Windows)
import mongoose from 'mongoose';
import { deleteDatabase } from '../utils/database';

export default async () => {
  await deleteDatabase();
  await mongoose.disconnect().catch(err => {
    console.error('Mongoose disconnection error:', err);
    process.exit(1);
  });
};