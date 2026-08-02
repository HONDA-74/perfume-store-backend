import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
  issuer: process.env.JWT_ISSUER ?? 'luxury-perfume-store-api',
  audience: process.env.JWT_AUDIENCE ?? 'luxury-perfume-store-clients',
  algorithm: process.env.JWT_ALGORITHM ?? 'HS256',
}));
