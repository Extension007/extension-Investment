const {
  isMultipartRequest,
  readCsrfToken,
  shouldDeferMultipartCsrf,
  requestPath
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
