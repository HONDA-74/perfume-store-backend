import appConfig from './app.config';
import cloudinaryConfig from './cloudinary.config';
import databaseConfig from './database.config';
import geminiConfig from './gemini.config';
import jwtConfig from './jwt.config';
import throttlerConfig from './throttler.config';

export default [
  appConfig,
  databaseConfig,
  jwtConfig,
  cloudinaryConfig,
  throttlerConfig,
  geminiConfig,
];

export { validationSchema } from './validation.schema';
