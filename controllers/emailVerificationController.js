const {
  verifyEmail,
  verifyEmailByTokenOnly,
  resendVerificationEmail
} = require('../services/emailVerificationService');
const User = require('../models/User');
const { notifyAdmin } = require('../services/adminNotificationService');
const { getUserFromRequest, getAuthUserId } = require('../middleware/auth');
const { generateToken } = require('../config/jwt');

async function finalizeSuccessfulVerification(req, res, user, { alreadyVerified = false } = {}) {
  if (!alreadyVerified) {
    try {
      await notifyAdmin(
        'Email verified',
        'A user has verified their email.',
        {
          'Имя пользователя': user.username,
          Email: user.email,
          'ID пользователя': user.id.toString(),
          'Дата подтверждения': new Date().toLocaleString('ru-RU')
        },
        { locale: req.locale }
      );
    } catch (notificationError) {
      console.error('Ошибка при отправке уведомления администратору:', notificationError);
    }

    try {
      const { grantReferralBonusIfEligible } = require('../services/referralService');
      await grantReferralBonusIfEligible({ UserModel: User, user });
    } catch (referralError) {
      console.error('Ошибка при начислении реферального бонуса:', referralError);
    }
  }

  const currentId = getAuthUserId(req.user);
  const shouldReplaceSession = !currentId || currentId === user.id.toString();

  if (shouldReplaceSession) {
    if (req.session) {
      req.session.user = {
        _id: user.id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        emailVerified: true
      };
      await new Promise((resolve) => {
        req.session.save(() => resolve());
      });
    }

    const updatedUserData = {
      _id: user.id.toString(),
      username: user.username,
      role: user.role,
      emailVerified: true
    };
    const newToken = generateToken(updatedUserData);
    res.cookie('exto_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24
    });
  }

  return res.render('verification-success', {
    message: alreadyVerified
      ? req.t('auth.verifyEmailSuccess', 'Email already verified. You can sign in.')
      : req.t('auth.verifyEmailSuccess', 'Your email has been verified successfully.'),
    alreadyVerified,
    username: user.username,
    email: user.email,
    csrfToken: res.locals.csrfToken
  });
}

exports.verifyEmail = async (req, res) => {
  try {
    const { userId, token } = req.params;

    // Do NOT clear session/JWT before token validation
    const result = await verifyEmail(userId, token);

    if (result.status === 'already_verified' && result.user) {
      return finalizeSuccessfulVerification(req, res, result.user, { alreadyVerified: true });
    }

    if (result.status === 'verified' && result.user) {
      return finalizeSuccessfulVerification(req, res, result.user, { alreadyVerified: false });
    }

    // On failure: leave session and JWT untouched
    return res.status(400).render('email-verification-error', {
      error: req.t('auth.verifyEmailError', 'The verification link is invalid or expired.'),
      csrfToken: res.locals.csrfToken
    });
  } catch (error) {
    console.error('Email verification error:', error.message);
    return res.status(400).render('email-verification-error', {
      error: req.t('auth.verifyEmailError', 'Could not verify email. Please try again later.'),
      csrfToken: res.locals.csrfToken
    });
  }
};

/** Compatibility for old emails: /verify-email/:token */
exports.verifyEmailLegacy = async (req, res) => {
  try {
    const { token } = req.params;
    const result = await verifyEmailByTokenOnly(token);

    if (result.status === 'already_verified' && result.user) {
      return finalizeSuccessfulVerification(req, res, result.user, { alreadyVerified: true });
    }

    if (result.status === 'verified' && result.user) {
      return finalizeSuccessfulVerification(req, res, result.user, { alreadyVerified: false });
    }

    return res.status(400).render('email-verification-error', {
      error: req.t('auth.verifyEmailError', 'The verification link is invalid or expired.'),
      csrfToken: res.locals.csrfToken
    });
  } catch (error) {
    console.error('Email verification (legacy) error:', error.message);
    return res.status(400).render('email-verification-error', {
      error: req.t('auth.verifyEmailError', 'Could not verify email. Please try again later.'),
      csrfToken: res.locals.csrfToken
    });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: req.t('api.fieldsRequired', 'Please fill in required fields') });
    }

    await resendVerificationEmail(email, req.locale);
    res.json({
      success: true,
      message: req.t('auth.resendVerificationSent', 'Verification email sent. Check your inbox.')
    });
  } catch (error) {
    console.error('Resend verification error:', error.message);
    // Constant response to avoid user enumeration
    res.json({
      success: true,
      message: req.t('auth.resendVerificationSent', 'Verification email sent. Check your inbox.')
    });
  }
};

exports.verificationStatus = async (req, res) => {
  try {
    const authUser = getUserFromRequest(req);
    if (!authUser) {
      return res.status(401).redirect('/user/login');
    }

    const userId = getAuthUserId(authUser);
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).redirect('/user/login');
    }

    res.render('verification-status', {
      user,
      csrfToken: res.locals.csrfToken
    });
  } catch (error) {
    console.error('Verification status error:', error.message);
    res.status(500).json({ success: false, message: req.t('api.serverError', 'Server error') });
  }
};
