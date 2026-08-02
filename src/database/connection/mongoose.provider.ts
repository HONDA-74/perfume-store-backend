import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

const logger = new Logger('DatabaseConnection');

/**
 * Builds the MongooseModule connection options, including connection-lifecycle
 * logging (connected/error/disconnected/reconnected) per SYSTEM_ARCHITECTURE.md §11.
 * Credentials are never logged — only lifecycle events.
 */
export function mongooseConnectionFactory(configService: ConfigService): MongooseModuleOptions {
  return {
    uri: configService.get<string>('database.uri'),
    retryAttempts: configService.get<number>('database.retryAttempts'),
    retryDelay: configService.get<number>('database.retryDelay'),
    connectionFactory: (connection: Connection) => {
      connection.on('connected', () => logger.log('MongoDB connection established.'));
      connection.on('error', (error: Error) =>
        logger.error('MongoDB connection error.', error?.stack),
      );
      connection.on('disconnected', () => logger.warn('MongoDB connection lost.'));
      connection.on('reconnected', () => logger.log('MongoDB reconnected.'));
      return connection;
    },
  };
}
