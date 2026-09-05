const { serializeComment } = require('../../utils/commentSerialize');

describe('serializeComment', () => {
  test('maps sequelize plain row with nested user', () => {
    const out = serializeComment({
      id: 7,
      cardId: 42,
      cardType: 'Service',
      userId: 3,
      text: 'hello',
      createdAt: '2026-09-05T00:00:00.000Z',
      user: { id: 3, username: 'ann' }
    });
    expect(out).toMatchObject({
      id: 7,
      _id: 7,
      cardId: '42',
      cardType: 'Service',
      userId: 3,
      username: 'ann',
      text: 'hello'
    });
  });

  test('maps flattened raw include fields', () => {
    const out = serializeComment({
      id: 1,
      cardId: 9,
      text: 'hi',
      'user.username': 'bob'
    });
    expect(out.username).toBe('bob');
    expect(out._id).toBe(1);
  });

  test('returns null without id or text', () => {
    expect(serializeComment({ text: 'x' })).toBeNull();
    expect(serializeComment({ id: 1, text: '  ' })).toBeNull();
  });
});
