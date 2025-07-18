const crypto = require('crypto');

const generateTransactionId = () => {
  return `TXN_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
};

const calculateProration = (currentPlan, newPlan, daysLeft) => {
  const dailyRateOld = currentPlan.price / (currentPlan.duration * 30);
  const dailyRateNew = newPlan.price / (newPlan.duration * 30);
  const credit = dailyRateOld * daysLeft;
  const newCharge = dailyRateNew * daysLeft;
  return {
    credit,
    newCharge,
    difference: newCharge - credit
  };
};

const validatePaymentMethod = (paymentMethod) => {
  const validMethods = ['credit_card', 'paypal', 'bank_transfer'];
  return validMethods.includes(paymentMethod);
};

module.exports = {
  generateTransactionId,
  calculateProration,
  validatePaymentMethod
};