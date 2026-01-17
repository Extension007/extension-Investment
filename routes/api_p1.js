const express = require('express');
const router = express.Router();
const { ensureGuestId, guestRateLimit, captchaHook } = require('../middleware/p1Guest');
const { requireAuth, requireAdmin, requireUser } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { httpError } = require('../utils/httpError');
const { notifyUser } = require('../services/notify');
const { redeemSlotCode, createCodes, issuePaymentActivationCode, consumePaymentActivationCode } = require('../services/codeService');
const { grantAlba, listTransactions, spendAlba } = require('../services/albaService');
const { createVideo, listPublic, moderate, vote } = require('../services/videoService');
const { assertVerified } = require('../services/p1Rules');

// CODES
router.post('/codes/redeem', requireUser, csrfProtection, async (req, res, next) => {
  try {
    assertVerified(req.user);
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Code required' });

    const result = await redeemSlotCode({
      user: req.user,
      codeValue: code,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });

    await notifyUser(req.user._id, { type: 'slot_redeemed', code: result.code.code });
    res.json({ success: true, code: result.code });
  } catch (err) {
    next(err);
  }
});

router.post('/codes', requireAdmin, csrfProtection, async (req, res, next) => {
  try {
    const { count, kind, type, expiresAt } = req.body;
    if (!count || !kind || !type) return res.status(400).json({ success: false, message: 'count, kind, type required' });

    const codes = await createCodes({ count, kind, type, expiresAt, createdBy: req.user._id });
    res.json({ success: true, codes });
  } catch (err) {
    next(err);
  }
});

router.get('/codes', requireAdmin, async (req, res, next) => {
  try {
    const codes = await require('../models/Code').find().sort({ createdAt: -1 }).limit(100).exec();
    res.json({ success: true, codes });
  } catch (err) {
    next(err);
  }
});

// ALBA
router.post('/alba/grant', requireAdmin, async (req, res, next) => {
  try {
    const { userId, amount, reason } = req.body;
    if (!userId || amount == null || !reason) return res.status(400).json({ success: false, message: 'userId, amount, reason required' });

    const user = await grantAlba({
      UserModel: require('../models/User'),
      userId,
      amount,
      reason,
      actorAdminId: req.user._id
    });
    await notifyUser(userId, { type: 'alba_granted', amount, reason });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// Grant ALBA by login (username)
router.post('/alba/grant-by-login', requireAdmin, async (req, res) => {
  try {
    const { login, amount, reason } = req.body;
    if (!login || !amount || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Login, amount, and reason are required'
      });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    const User = require('../models/User');

    // Find user by login (username)
    const user = await User.findOne({ username: login });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this login'
      });
    }

    // Grant ALBA to the user
    const updatedUser = await grantAlba({
      UserModel: User,
      userId: user._id,
      amount,
      reason,
      actorAdminId: req.user._id
    });

    // Notify the user about the ALBA grant
    await notifyUser(user._id, {
      type: 'alba_granted',
      amount,
      reason,
      admin: req.user.username
    });

    res.json({
      success: true,
      message: `Successfully granted ${amount} ALBA to user ${login}`,
      user: {
        id: user._id,
        username: user.username,
        newBalance: updatedUser.albaBalance
      }
    });
  } catch (err) {
    console.error('Error granting ALBA by login:', err);
    res.status(500).json({
      success: false,
      message: 'Error granting ALBA: ' + err.message
    });
  }
});

// ENTITLEMENTS API
router.post('/entitlements/purchase', requireAuth, async (req, res) => {
  try {
    const { type, idempotencyKey } = req.body;
    if (!type || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: 'Type and idempotencyKey are required'
      });
    }

    const User = require('../models/User');
    const { purchaseEntitlement } = require('../services/albaService');

    const result = await purchaseEntitlement({
      UserModel: User,
      userId: req.user._id,
      type,
      idempotencyKey
    });

    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      entitlement: result.entitlement,
      transaction: result.transaction,
      message: 'Entitlement purchased successfully'
    });
  } catch (err) {
    console.error('Error purchasing entitlement:', err);
    res.status(500).json({
      success: false,
      message: 'Error purchasing entitlement: ' + err.message
    });
  }
});

router.get('/entitlements/available', requireAuth, async (req, res) => {
  try {
    const { getAvailableEntitlements } = require('../services/albaService');

    const entitlements = await getAvailableEntitlements(req.user._id);

    // Group by type
    const productEntitlements = entitlements.filter(e => e.type === 'product');
    const serviceEntitlements = entitlements.filter(e => e.type === 'service');

    res.json({
      success: true,
      entitlements: {
        product: productEntitlements,
        service: serviceEntitlements,
        total: entitlements.length
      }
    });
  } catch (err) {
    console.error('Error getting available entitlements:', err);
    res.status(500).json({
      success: false,
      message: 'Error getting available entitlements: ' + err.message
    });
  }
});

// REFERRAL API
router.post('/referrals/set-binding', requireAuth, async (req, res) => {
  try {
    const { referrerId } = req.body;
    if (!referrerId) {
      return res.status(400).json({
        success: false,
        message: 'Referrer ID is required'
      });
    }

    const User = require('../models/User');
    const { setReferralBinding } = require('../services/referralService');

    const result = await setReferralBinding({
      UserModel: User,
      userId: req.user._id,
      referrerId
    });

    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      message: 'Referral binding set successfully',
      user: result.user
    });
  } catch (err) {
    console.error('Error setting referral binding:', err);
    res.status(500).json({
      success: false,
      message: 'Error setting referral binding: ' + err.message
    });
  }
});

router.get('/referrals/stats', requireAuth, async (req, res) => {
  try {
    const { getReferralStats } = require('../services/referralService');

    const stats = await getReferralStats(req.user._id);

    res.json({
      success: true,
      stats
    });
  } catch (err) {
    console.error('Error getting referral stats:', err);
    res.status(500).json({
      success: false,
      message: 'Error getting referral stats: ' + err.message
    });
  }
});

// Get ALBA transactions history
router.get('/alba/transactions-history', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;
    const AlbaTransaction = require('../models/AlbaTransaction');
    
    // Get transactions with related user info
    const transactions = await AlbaTransaction.find({})
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('userId', 'username email')
      .populate('relatedUserId', 'username email'); // This would be the target user for admin grants
    
    res.json({
      success: true,
      transactions,
      total: await AlbaTransaction.countDocuments({})
    });
  } catch (err) {
    console.error('Error fetching ALBA transactions:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching ALBA transactions: ' + err.message
    });
  }
});


router.get('/alba/transactions', requireAuth, async (req, res, next) => {
  try {
    const txs = await listTransactions({ userId: req.user._id });
    res.json({ success: true, transactions: txs });
  } catch (err) {
    next(err);
  }
});

// LEGACY PAID FLOW - ADMIN ONLY
router.post('/payments/alba', requireAdmin, async (req, res, next) => {
  try {
    const { paymentType, cardType, cardId, userId } = req.body;
    if (paymentType !== 'upgrade_to_paid' || !cardType || !cardId || !userId) {
      return res.status(400).json({ success: false, message: 'paymentType=upgrade_to_paid, cardType, cardId, userId required' });
    }

    const result = await spendAlba({
      UserModel: require('../models/User'),
      userId: userId,
      amount: 30,
      reason: 'upgrade_to_paid',
      relatedCardType: cardType,
      relatedCardId: cardId
    });

    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });

    const activationCode = await issuePaymentActivationCode({
      userId: userId,
      cardType,
      cardId,
      createdBy: req.user._id
    });

    await notifyUser(userId, { type: 'paid_upgrade_requested', cardType, cardId, activationCode: activationCode.code });
    res.json({ success: true, activationCode: activationCode.code });
  } catch (err) {
    next(err);
  }
});

router.post('/users/confirm-paid', requireAdmin, async (req, res, next) => {
  try {
    const { userId, cardType, cardId, issueActivationCode = true } = req.body;
    if (!userId || !cardType || !cardId) return res.status(400).json({ success: false, message: 'userId, cardType, cardId required' });

    const User = require('../models/User');
    const user = await User.findById(userId).exec();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let activationCode = null;
    if (issueActivationCode) {
      activationCode = await issuePaymentActivationCode({ userId, cardType, cardId, createdBy: req.user._id });
    }

    user.tier = 'paid';
    user.tierRequested = 'paid';
    user.paymentStatus = 'paid';
    user.activationCodeId = activationCode?._id || null;
    user.status = 'approved';
    user.editCount = 0;
    await user.save();

    await notifyUser(userId, { type: 'paid_confirmed', cardType, cardId, activationCode: activationCode?.code });
    res.json({ success: true, user, activationCode: activationCode?.code });
  } catch (err) {
    next(err);
  }
});

router.post('/users/activate-paid', requireAuth, async (req, res, next) => {
  try {
    assertVerified(req.user);
    const { activationCode } = req.body;
    if (!activationCode) return res.status(400).json({ success: false, message: 'activationCode required' });

    const result = await consumePaymentActivationCode({ userId: req.user._id, activationCode });
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });

    const User = require('../models/User');
    const user = await User.findById(req.user._id).exec();
    user.tier = 'paid';
    user.tierRequested = 'paid';
    user.paymentStatus = 'paid';
    user.activationCodeId = result.code._id;
    user.status = 'approved';
    user.editCount = 0;
    await user.save();

    await notifyUser(req.user._id, { type: 'paid_activated', activationCode });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// VIDEO API
router.post('/videos', requireAuth, csrfProtection, async (req, res, next) => {
  try {
    assertVerified(req.user);
    const video = await createVideo({ user: req.user, payload: req.body });
    await notifyUser(req.user._id, { type: 'video_created', videoId: video._id });
    res.json({ success: true, video });
  } catch (err) {
    next(err);
  }
});

router.get('/videos', async (req, res, next) => {
  try {
    const genres = req.query.genres?.split(',').filter(Boolean) || [];
    const videos = await listPublic({ genres });
    res.json({ success: true, videos });
  } catch (err) {
    next(err);
  }
});

router.post('/videos/:id/vote', ensureGuestId, guestRateLimit(), captchaHook, async (req, res, next) => {
  try {
    const { vote } = req.body;
    if (!vote || !['up', 'down'].includes(vote)) return res.status(400).json({ success: false, message: 'vote must be up or down' });

    const voterKey = req.user ? `u:${req.user._id}` : `g:${req.guestId}`;
    const result = await vote({ id: req.params.id, voterKey, vote });

    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });

    res.json({ success: true, video: result.doc });
  } catch (err) {
    next(err);
  }
});

// Admin moderation
router.post('/videos/:id/approve', requireAdmin, csrfProtection, async (req, res, next) => {
  try {
    const { adminComment } = req.body;
    // adminComment is optional for approve

    const video = await moderate({ id: req.params.id, action: 'approve', adminComment });
    await notifyUser(video.userId, { type: 'video_approved', videoId: video._id, adminComment });
    res.json({ success: true, video });
  } catch (err) {
    next(err);
  }
});

router.post('/videos/:id/reject', requireAdmin, csrfProtection, async (req, res, next) => {
  try {
    const { adminComment, rejectionReason } = req.body;
    if (!adminComment || !rejectionReason) return res.status(400).json({ success: false, message: 'adminComment and rejectionReason required' });

    const video = await moderate({ id: req.params.id, action: 'reject', adminComment, rejectionReason });
    if (!video) return res.status(404).json({ success: false, error: 'NotFound', message: 'Video not found' });
    if (!video.userId) return res.status(400).json({ success: false, message: 'Video has no associated user' });

    await notifyUser(video.userId, { type: 'video_rejected', videoId: video._id, adminComment, rejectionReason });
    res.json({ success: true, video });
  } catch (err) {
    next(err);
  }
});

router.post('/videos/:id/block', requireAdmin, csrfProtection, async (req, res, next) => {
  try {
    const { adminComment } = req.body;
    if (!adminComment) return res.status(400).json({ success: false, message: 'adminComment required' });

    const video = await moderate({ id: req.params.id, action: 'block', adminComment });
    await notifyUser(video.userId, { type: 'video_blocked', videoId: video._id, adminComment });
    res.json({ success: true, video });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
