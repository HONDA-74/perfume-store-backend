import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RequestLogger');

  use(req: Request, _res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    this.logger.debug(`Incoming request: ${method} ${originalUrl} from ${ip}`);
    next();
  }
}
