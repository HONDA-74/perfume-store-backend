import { Request } from 'express';
import { JwtPayload } from './interfaces/jwt-payload.interface';

export type RequestWithUser = Request & {
  user: JwtPayload;
  requestId?: string;
};
