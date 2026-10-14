declare module 'mongodb-memory-server' {
  export class MongoMemoryServer {
    static create(options?: any): Promise<MongoMemoryServer>;
    getUri(): string;
    stop(): Promise<boolean>;
  }
}
