const { csrfProtection } = require('./csrf');

function apiCsrfProtection() {
  return function(req, res, next) {
    if (req.headers['x-csrf-token'] && !req.headers['csrf-token']) {
      req.headers['csrf-token'] = req.headers['x-csrf-token'];
    }

    csrfProtection(req, res, (err) => {
      if (err) {
        if (err.code === 'EBADCSRFTOKEN') {
          return res.status(403).json({
            success: false,
            error: 'InvalidCSRF',
            message: 'CSRF token invalid or missing'
          });
        }
        return next(err);
      }
      next();
    });
  };
}

module.exports = { apiCsrfProtection };
