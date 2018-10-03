import server from './api/server';
import * as security from './api/helpers/security';

server({
  appRoot: __dirname, // required config
  swaggerSecurityHandlers: security,
});
