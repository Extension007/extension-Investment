const { earnReferralBonus } = require('./albaService');

async function grantReferralBonusIfEligible({ UserModel, user }) {
  if (user.emailVerified !== true) return;
  if (!user.referredBy) return;
  if (user.refBonusGranted === true) return;

  await earnReferralBonus({
    UserModel,
    referrerUserId: user.referredBy,
    referredUserId: user._id,
    amount: 10
  });

  user.refBonusGranted = true;
  await user.save();
}

module.exports = { grantReferralBonusIfEligible };
