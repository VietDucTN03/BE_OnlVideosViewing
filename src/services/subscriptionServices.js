const asyncHandler = require("express-async-handler");
const Subscription = require("../models/payment/subscription");
const ChannelSubscription = require("../models/payment/userSubscription");
const Payment = require("../models/payment/payment");
const { generateTransactionId } = require("../utils/payment/payment");

const getSubscriptionPlans = asyncHandler(async (req, res) => {
  try {
    const plans = await Subscription.find({ isActive: true })
      .sort({ price: 1 }); // sắp xếp từ giá thấp -> cao

    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: "Error fetching subscription plans" });
  }
});

const subscribe = asyncHandler(async (req, res) => {
  try {
    const { subscriptionId, paymentMethod } = req.body;
    const channelId = req.channel.id; // Assuming channel is authenticated

    // Get subscription details
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({ message: "Subscription plan not found" });
    }

    // Calculate end date based on subscription duration
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + subscription.duration);

    // Create payment record
    const payment = new Payment({
      channelId,
      subscriptionId,
      amount: subscription.price,
      paymentMethod,
      transactionId: generateTransactionId(),
    });
    await payment.save();

    // Create channel subscription
    const channelSubscription = new ChannelSubscription({
      channelId,
      subscriptionId,
      startDate,
      endDate,
    });
    await channelSubscription.save();

    res.json({
      message: "Subscription successful",
      subscription: channelSubscription,
      payment,
    });
  } catch (error) {
    res.status(500).json({ message: "Error processing subscription" });
  }
});

const getChannelSubscription = asyncHandler(async (req, res) => {
  try {
    const channelId = req.channel.id;
    const subscription = await ChannelSubscription.findOne({
      channelId,
      status: "active",
    }).populate("subscriptionId");

    if (!subscription) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    res.json(subscription);
  } catch (error) {
    res.status(500).json({ message: "Error fetching channel subscription" });
  }
});

const cancelSubscription = asyncHandler(async (req, res) => {
  try {
    const channelId = req.channel.id;
    const subscription = await ChannelSubscription.findOne({
      channelId,
      status: "active",
    });

    if (!subscription) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    subscription.status = "cancelled";
    subscription.cancelledAt = new Date();
    subscription.autoRenew = false;
    await subscription.save();

    res.json({ message: "Subscription cancelled successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error cancelling subscription" });
  }
});

module.exports = {
  getSubscriptionPlans,
  subscribe,
  getChannelSubscription,
  cancelSubscription,
};
