const express = require("express");

const subscriptionRouter = express.Router();

const subscriptionServices = require("../../services/subscriptionServices");

const verifyChannelOwnership = require("../../middlewares/verifyChannelOwnership");

const expressAsyncHandler = require("express-async-handler");
const subscription = require("../../models/payment/subscription");

subscriptionRouter.get("/get-subscription-plans", subscriptionServices.getSubscriptionPlans);

subscriptionRouter.post("/subscribe", verifyChannelOwnership, subscriptionServices.subscribe);

subscriptionRouter.get("/get-channel-subscription", verifyChannelOwnership, subscriptionServices.getChannelSubscription);

subscriptionRouter.post("/cancel-subscription", verifyChannelOwnership, subscriptionServices.cancelSubscription);


//! Test
subscriptionRouter.post('/seed-plan', expressAsyncHandler(async (req, res) => {
  try {
    const newPlan = await subscription.create({
      name: "Premium",
      description: "Gói cao cấp dành cho người dùng muốn tận hưởng đầy đủ tính năng và tiện ích của Metube.",
      price: "79000",
      duration: 1,
      features: ["Không quảng cáo", "Phát trong nền", "Download video chất lượng cao", "Truy cập nội dung độc quyền"],
      isActive: true
    });

    res.status(201).json({ message: "Seeded successfully", plan: newPlan });
  } catch (err) {
    res.status(500).json({ message: "Failed to seed plan", error: err.message });
  }
}));

module.exports = subscriptionRouter;