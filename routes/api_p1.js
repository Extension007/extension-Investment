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

router.post('/codes', requireAdmin, async (req, res, next) => {
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

    const user = await grantAlba({ UserModel: require('../models/User'), userId, amount, reason, actorAdminId: req.user._id });
    await notifyUser(userId, { type: 'alba_granted', amount, reason });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
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

// PAID FLOW
router.post('/payments/alba', requireAuth, async (req, res, next) => {
  try {
    assertVerified(req.user);
    const { paymentType, cardType, cardId } = req.body;
    if (paymentType !== 'upgrade_to_paid' || !cardType || !cardId) {
      return res.status(400).json({ success: false, message: 'paymentType=upgrade_to_paid, cardType, cardId required' });
    }

    const result = await spendAlba({
      UserModel: require('../models/User'),
      userId: req.user._id,
      amount: 30,
      reason: 'upgrade_to_paid',
      relatedCardType: cardType,
      relatedCardId: cardId
    });

    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });

    const activationCode = await issuePaymentActivationCode({
      userId: req.user._id,
      cardType,
      cardId,
      createdBy: req.user._id
    });

    await notifyUser(req.user._id, { type: 'paid_upgrade_requested', cardType, cardId, activationCode: activationCode.code });
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
router.post('/videos', requireAuth, async (req, res, next) => {
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
router.post('/videos/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const { adminComment } = req.body;
    if (!adminComment) return res.status(400).json({ success: false, message: 'adminComment required' });

    const video = await moderate({ id: req.params.id, action: 'approve', adminComment });
    await notifyUser(video.userId, { type: 'video_approved', videoId: video._id, adminComment });
    res.json({ success: true, video });
  } catch (err) {
    next(err);
  }
});

router.post('/videos/:id/reject', requireAdmin, async (req, res, next) => {
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

router.post('/videos/:id/block', requireAdmin, async (req, res, next) => {
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
