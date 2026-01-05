const jwt = require('jsonwebtoken');
const { generateToken, verifyToken } = require('../../config/jwt');
const User = require('../../models/User');

describe('JWT Authentication', () => {
  const mockUserData = {
    _id: 'test-user-id',
    username: 'testuser',
    role: 'user'
  };

  test('should generate a valid JWT token', () => {
    const token = generateToken(mockUserData);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    
    // Verify the token structure
    const parts = token.split('.');
    expect(parts).toHaveLength(3); // JWT has 3 parts: header.payload.signature
    
    // Decode and verify the payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'exto-jwt-secret-change-in-production');
    expect(decoded._id).toBe(mockUserData._id);
    expect(decoded.username).toBe(mockUserData.username);
    expect(decoded.role).toBe(mockUserData.role);
  });

  test('should verify a valid JWT token', () => {
    const token = generateToken(mockUserData);
    const decoded = verifyToken(token);
    
    expect(decoded).toBeDefined();
    expect(decoded._id).toBe(mockUserData._id);
    expect(decoded.username).toBe(mockUserData.username);
    expect(decoded.role).toBe(mockUserData.role);
  });

  test('should return null for invalid JWT token', () => {
    const invalidToken = 'invalid.token.here';
    const decoded = verifyToken(invalidToken);
    
    expect(decoded).toBeNull();
  });

  test('should return null for expired JWT token', () => {
    // Create a token with very short expiration
    const shortLivedToken = jwt.sign(
      mockUserData, 
      process.env.JWT_SECRET || 'exto-jwt-secret-change-in-production', 
      { expiresIn: '1ms' } // 1 millisecond
    );
    
    // Wait for the token to expire
    jest.useFakeTimers();
    jest.advanceTimersByTime(2);
    
    const decoded = verifyToken(shortLivedToken);
    
    expect(decoded).toBeNull();
    
    jest.useRealTimers();
  });
});