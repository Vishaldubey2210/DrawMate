import mongoose from 'mongoose';
import { ENV } from './env.js';
import { logger } from '../utils/logger.js';

let mongoMemoryServerInstance: any = null;

export async function connectDB(uriOverride?: string): Promise<string> {
  const targetUri = uriOverride || ENV.MONGODB_URI;

  if (targetUri) {
    try {
      const sanitizedUri = targetUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
      logger.info(`Connecting to MongoDB at: ${sanitizedUri}`, undefined, 'Database');
      await mongoose.connect(targetUri);
      logger.info('MongoDB database successfully connected.', undefined, 'Database');
      return targetUri;
    } catch (err: any) {
      if (ENV.NODE_ENV === 'production') {
        throw new Error(`Production MongoDB connection failed: ${err.message}`);
      }
      logger.warn(`Could not connect to provided MONGODB_URI (${err.message}). Falling back to MongoMemoryServer...`, undefined, 'Database');
    }
  }

  // Fallback to in-memory MongoDB in dev/test when no external MongoDB is running
  try {
    const fs = await import('fs');
    const path = await import('path');
    const possiblePaths = [
      path.resolve(process.cwd(), '../node_modules/.cache/mongodb-memory-server/mongod-x64-arch-7.0.24'),
      path.resolve(process.cwd(), 'node_modules/.cache/mongodb-memory-server/mongod-x64-arch-7.0.24'),
      path.resolve(process.cwd(), '../../node_modules/.cache/mongodb-memory-server/mongod-x64-arch-7.0.24'),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        process.env.MONGOMS_SYSTEM_BINARY = p;
        break;
      }
    }

    // @ts-ignore
    const { MongoMemoryServer } = (await import('mongodb-memory-server')) as any;
    mongoMemoryServerInstance = await MongoMemoryServer.create();
    const memoryUri = mongoMemoryServerInstance.getUri();
    console.log(`Initialized MongoMemoryServer instance at: ${memoryUri}`);
    await mongoose.connect(memoryUri);
    console.log('MongoDB (In-Memory) successfully connected.');
    return memoryUri;
  } catch (memoryErr: any) {
    console.error('Failed to initialize in-memory MongoDB server:', memoryErr);
    throw memoryErr;
  }
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoMemoryServerInstance) {
    await mongoMemoryServerInstance.stop();
    mongoMemoryServerInstance = null;
  }
}
