import request from 'request';
import * as errors from './errors';

function sportnetUserSecurityHandler(req, authOrSecDef, scopesOrApiKey, next) {
  // token header
  const authorizationHeader = req.get('authorization');

  if (!authorizationHeader) {
    return next(
      new errors.RESTErrorUnauthorized(
        'UNAUTHORIZED',
        'Authorization header missing',
      ),
    );
  }
  const token = authorizationHeader.match(/^Bearer (.*)$/);

  if (!token) {
    return next(
      new errors.RESTErrorUnauthorized(
        'UNAUTHORIZED',
        'Authorization header mismatch',
      ),
    );
  }

  // skontrolujeme tokeninfo
  const security = req.security || {};
  [security.access_token_type, security.access_token] = token;

  request.post(
    {
      uri: req.config.get('server.security.sportnet_user.tokeninfo_url'),
      auth: {
        user: req.config.get('server.security.sportnet_user.client_id'),
        password: req.config.get('server.security.sportnet_user.secret'),
      },
      json: { access_token: security.access_token },
    },
    async (error, response) => {
      if (error) {
        return next(new errors.RESTError(500, error.name, error.message));
      }
      if (response.statusCode === 200) {
        security.tokeninfo = response.body;
        req.security = security;
        req.auth_user = security.tokeninfo.userinfo;
        return next();
      }
      return next(
        new errors.RESTErrorUnauthorized('UNAUTHORIZED', null, {
          oauth_response: response.body,
        }),
      );
    },
  );

  return null;
}

module.exports = {
  sportnet_user: sportnetUserSecurityHandler,
};
