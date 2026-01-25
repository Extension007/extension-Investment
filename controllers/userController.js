const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Get current user data from database
 * Returns fresh data from DB to ensure sync with JWT and session
 */
exports.getMe = async (req, res) => {
  try {
    // Get user ID from authenticated request (from JWT or session)
    const userFromRequest = req.user || req.currentUser;
    
    if (!userFromRequest || !userFromRequest._id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: No user data found' 
      });
    }

    // Fetch fresh user data from database
    const user = await User.findById(userFromRequest._id)
      .select('_id username email role emailVerified createdAt updatedAt albaBalance refBonusGranted');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    logger.info({
      msg: 'api_me_success',
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified === true,
      albaBalance: user.albaBalance,
      refBonusGranted: user.refBonusGranted === true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });

    // Return fresh user data from database
    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        albaBalance: user.albaBalance,
        refBonusGranted: user.refBonusGranted
      }
    });
  } catch (error) {
    logger.error({
      msg: 'api_me_error',
      error: error.message
    });
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching user data' 
    });
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const userFromRequest = req.user || req.currentUser;
    
    if (!userFromRequest || !userFromRequest._id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: No user data found' 
      });
    }

    const { username } = req.body;
    
    if (username) {
      // Check if username is already taken by another user
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: userFromRequest._id } 
      });
      
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: 'Username already taken' 
        });
      }
    }

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(
      userFromRequest._id,
      { ...(username && { username }) },
      { new: true, select: '_id username role emailVerified' }
    );

    if (!updatedUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        role: updatedUser.role,
        emailVerified: updatedUser.emailVerified
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating user data' 
    });
  }
};
