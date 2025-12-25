// Mocks must be at the top before any imports
jest.mock('csurf', () => {
  return jest.fn(() => (req, res, next) => {
    // Mock CSRF token generation
    req.csrfToken = () => 'test-csrf-token';
    res.locals.csrfToken = 'test-csrf-token';
    next();
  });
});

jest.mock('express-session', () => {
  return jest.fn(() => (req, res, next) => {
    // Simple session mock - extract user from cookie for tests
    if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});

      if (cookies['connect.sid']) {
        const sessionId = cookies['connect.sid'];
        if (sessionId.startsWith('admin-session-')) {
          const userId = sessionId.replace('admin-session-', '');
          req.session = { user: { _id: userId, role: 'admin' } };
        } else if (sessionId.startsWith('user-session-')) {
          const userId = sessionId.replace('user-session-', '');
          req.session = { user: { _id: userId, role: 'user' } };
        } else {
          req.session = {};
        }
      } else {
        req.session = {};
      }
    } else {
      req.session = {};
    }
    next();
  });
});

jest.mock('connect-mongo', () => {
  return {
    create: jest.fn(() => ({}))
  };
});

// Polyfills for Node.js environment
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Polyfills for jsdom environment
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
