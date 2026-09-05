const {
  isMultipartRequest,
  readCsrfToken,
  shouldDeferMultipartCsrf,
  requestPath,
  shouldSkipCsrf,
  isMobileApiPath
} = require('../../middleware/csrf');

describe('CSRF helpers', () => {
  test('readCsrfToken prefers body, then header', () => {
    expect(readCsrfToken({
      body: { _csrf: ' from-body ' },
      headers: { 'x-csrf-token': 'from-header' }
    })).toBe('from-body');

    expect(readCsrfToken({
      body: {},
      headers: { 'x-csrf-token': 'from-header' }
    })).toBe('from-header');

    expect(readCsrfToken({
      body: { _csrf: ['a', 'b'] },
      headers: {}
    })).toBe('a');
  });

  test('defers CSRF only for multipart card upload routes without a header', () => {
    const editReq = {
      method: 'POST',
      path: '/cabinet/product/7/edit',
      headers: { 'content-type': 'multipart/form-data; boundary=abc' },
      body: {},
      query: {}
    };
    expect(isMultipartRequest(editReq)).toBe(true);
    expect(requestPath(editReq)).toBe('/cabinet/product/7/edit');
    expect(shouldDeferMultipartCsrf(editReq)).toBe(true);

    expect(shouldDeferMultipartCsrf({
      ...editReq,
      headers: {
        'content-type': 'multipart/form-data; boundary=abc',
        'x-csrf-token': 'present'
      }
    })).toBe(false);

    expect(shouldDeferMultipartCsrf({
      method: 'POST',
      path: '/logout',
      headers: { 'content-type': 'multipart/form-data; boundary=abc' },
      body: {},
      query: {}
    })).toBe(false);

    expect(shouldDeferMultipartCsrf({
      method: 'POST',
      path: '/cabinet/product/7/edit',
      headers: { 'content-type': 'application/json' },
      body: {},
      query: {}
    })).toBe(false);
  });
});

describe('mobile CSRF skip', () => {
  test('skips CSRF for /api/mobile writes', () => {
    expect(isMobileApiPath({ originalUrl: '/api/mobile/v1/auth/login' })).toBe(true);
    expect(shouldSkipCsrf({ originalUrl: '/api/mobile/v1/auth/login' })).toBe(true);
    expect(shouldSkipCsrf({ originalUrl: '/api/mobile/v1/cards/4/vote' })).toBe(true);
  });

  test('does not skip CSRF for website or other APIs', () => {
    expect(shouldSkipCsrf({ originalUrl: '/user/login' })).toBe(false);
    expect(shouldSkipCsrf({ originalUrl: '/api/rating/1' })).toBe(false);
    expect(shouldSkipCsrf({ originalUrl: '/api/mobileevil' })).toBe(false);
    expect(shouldSkipCsrf({ originalUrl: '/cabinet/product/7/auto-renew' })).toBe(false);
  });
});
