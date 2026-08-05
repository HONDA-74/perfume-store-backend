import appConfig from './app.config';
import cloudinaryConfig from './cloudinary.config';
import databaseConfig from './database.config';
import geminiConfig from './gemini.config';
import jwtConfig from './jwt.config';
import smtpConfig from './smtp.config';
import stripeConfig from './stripe.config';
import throttlerConfig from './throttler.config';

export default [
  appConfig,
  databaseConfig,
  jwtConfig,
  cloudinaryConfig,
  throttlerConfig,
  geminiConfig,
  stripeConfig,
  smtpConfig,
];

export { validationSchema } from './validation.schema';
