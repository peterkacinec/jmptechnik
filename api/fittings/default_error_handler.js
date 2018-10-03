import util from 'util';
import { HTTP_CODES } from '../helpers/errors';

const errorLog = require('debug')('error');

module.exports = function create() {
  return function errorHandler(ctx, next) {
    const context = ctx;

    if (!util.isError(context.error)) {
      return next();
    }

    const err = context.error;
    const req = context.request;

    errorLog(`\n\n[ERROR] ${new Date()}\n`);
    errorLog(req.method, req.originalUrl);
    errorLog(req.headers);
    errorLog(err);
    if (err.results && err.results.errors) {
      errorLog('[RESULTS.ERRORS]', err.results.errors);
    }

    try {
      context.headers['Content-Type'] = 'application/json';
      context.statusCode =
        err.status || err.statusCode || context.statusCode || HTTP_CODES.ERROR;

      delete context.error;

      let { payload } = err;
      let name = err.name || err.code || 'UNKNOWN_ERROR';

      if (err.failedValidation === true) {
        context.statusCode = 400;
        name = err.code;
        if (err.code === 'SCHEMA_VALIDATION_FAILED') {
          payload = { errors: err.results.errors };
        }
        if (err.code === 'REQUIRED') {
          payload = { path: err.path, paramName: err.paramName };
        }
      }
      if (err.allowedMethods) {
        context.statusCode = 405;
        name = 'METHOD_NOT_ALLOWED';
        payload = {
          allowedMethods: err.allowedMethods,
        };
      }

      const response = JSON.stringify({
        statusCode: context.statusCode,
        name: name,
        description: err.description || err.message,
        payload: payload,
        userinfo: err.userinfo,
        // originalError: err,
      });
      context.headers['Content-Length'] = response.length;

      next(null, response);
      return true;
    } catch (err2) {
      errorLog(err2);
      errorLog('jsonErrorHandler unable to stringify error: %j', err);
      next();
      return true;
    }
  };
};
