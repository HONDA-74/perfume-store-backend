import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  uri: process.env.MONGODB_URI,
  retryAttempts: parseInt(process.env.MONGODB_RETRY_ATTEMPTS ?? '3', 10),
  retryDelay: parseInt(process.env.MONGODB_RETRY_DELAY ?? '1000', 10),
}));
