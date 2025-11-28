const asyncHandler = require("express-async-handler");
const Subscription = require("../../../models/payment/subscription");
const Payment = require("../../../models/payment/payment");
const UserSubscription = require("../../../models/payment/userSubscription");
const mongoose = require("mongoose");

const getSubscriptionSummary = asyncHandler(async (req, res) => {
  try {
    const totalPlans = await Subscription.countDocuments();
    const activePlans = await Subscription.countDocuments({ isActive: true });
    const inactivePlans = await Subscription.countDocuments({ isActive: false });

    res.status(200).json([
      { key: "total", value: totalPlans, title: "Total Plans" },
      { key: "active", value: activePlans, title: "Active Plans" },
      { key: "inactive", value: inactivePlans, title: "Inactive Plans" },
    ]);
  } catch (error) {
    console.error("Error getting subscription summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get subscription summary",
      error: error.message,
    });
  }
});

const getTopSubscriptions = asyncHandler(async (req, res) => {
  try {
    const topSubscriptions = await Subscription.find()
      .sort({ totalSubscribers: -1 })
      .limit(3)
      .lean();

    if (topSubscriptions.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No subscription plans found.",
        topSubscriptions: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Top 3 subscription plans fetched successfully",
      topSubscriptions,
    });
  } catch (error) {
    console.error("Error fetching top subscriptions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top subscriptions",
      error: error.message,
    });
  }
});

const getAllSubscriptionPlans = asyncHandler(async (req, res) => {
  const {
    page = 1,
    keyword = "",
    sort = "createdAtDesc",
    activeStatus = "all", // all | active | inactive
    periodType = "all", // all | day | week | month
  } = req.query;

  const pageNum = parseInt(page, 10);
  const limit = 5;
  const skip = (pageNum - 1) * limit;

  const sortOptions = {
    createdAtDesc: { createdAt: -1 },
    createdAtAsc: { createdAt: 1 },
    priceAsc: { price: 1 },
    priceDesc: { price: -1 },
    subscribersAsc: { totalSubscribers: 1 },
    subscribersDesc: { totalSubscribers: -1 },
  };

  const sortCondition = sortOptions[sort] || sortOptions.createdAtDesc;

  // Base query
  const baseQuery = {};

  // no filter keyword
  let totalPlans = await Subscription.countDocuments(baseQuery);

  // Add filter conditions
  const query = { ...baseQuery };

  if (keyword) {
    query.name = { $regex: keyword, $options: "i" };
  }

  if (["active", "inactive"].includes(activeStatus)) {
    query.isActive = activeStatus === "active";
  }

  if (["day", "week", "month"].includes(periodType)) {
    query.periodType = periodType;
  }

  totalPlans = await Subscription.countDocuments(query);

  const totalPages = Math.ceil(totalPlans / limit);

  try {
    const filteredTotal = await Subscription.countDocuments(query);
    const plans = await Subscription.find(query)
      .sort(sortCondition)
      .skip(skip)
      .limit(limit)
      .lean();

    const hasMore = skip + plans.length < filteredTotal;

    // Not found when keyword is present
    if (keyword && filteredTotal === 0) {
      return res.status(200).json({
        success: true,
        plans: [],
        totalPlans: 0,
        page: 1,
        limit,
        hasMore: false,
        keyword,
        sort,
        activeStatus,
        periodType,
        message: `No subscription plans found matching the keyword "${keyword}".`,
      });
    }

    // There are no packages in the system.
    if (totalPlans === 0) {
      return res.status(200).json({
        success: true,
        plans: [],
        totalPlans: 0,
        totalPages: 0,
        page: 1,
        limit,
        hasMore: false,
        keyword,
        sort,
        activeStatus,
        periodType,
        message: "No subscription plans available in the system.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Successfully fetched subscription plans",
      plans,
      totalPlans: filteredTotal,
      totalPages,
      page: pageNum,
      limit,
      hasMore,
      keyword,
      sort,
      activeStatus,
      periodType,
    });
  } catch (error) {
    console.error("Error fetching subscription plans:", error);
    res.status(500).json({
      message: "Failed to fetch subscription plans",
      error: error.message,
    });
  }
});

const createSubscriptionPlan = asyncHandler(async (req, res) => {
  try {
    const { name, description, price, duration, periodType, features, isActive } = req.body;

    // Validate input
    if (!name || !description || !price || !duration || !periodType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Check valid enum for name
    const allowedNames = ["Basic", "Premium"];
    if (!allowedNames.includes(name)) {
      return res.status(400).json({ message: `Invalid name. Allowed: ${allowedNames.join(", ")}` });
    }

    // Check valid enum for periodType
    const allowedPeriodTypes = ["day", "week", "month"];
    if (!allowedPeriodTypes.includes(periodType)) {
      return res.status(400).json({ message: `Invalid periodType. Allowed: ${allowedPeriodTypes.join(", ")}` });
    }

    // Check if same name and periodType already exist
    const existingPlan = await Subscription.findOne({ name, periodType, price });
    if (existingPlan) {
      return res.status(400).json({ message: "Subscription plan with same name, periodType and price already exists." });
    }

    // Create new plan
    const newPlan = await Subscription.create({
      name,
      description,
      price,
      duration,
      periodType,
      features: Array.isArray(features) ? features : [],
      isActive: isActive !== undefined ? isActive : true,
    });

    return res.status(201).json({
      success: true,
      message: "Subscription plan created successfully",
      plan: newPlan,
    });

  } catch (error) {
    console.error("Error creating subscription plan:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create subscription plan",
      error: error.message,
    });
  }
});

const getSubscriptionById = asyncHandler(async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription ID format.",
      });
    }

    // remove totalSubscribers when querying
    const subscription = await Subscription.findById(subscriptionId)
      .lean();

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subscription plan fetched successfully",
      subscription,
    });
  } catch (error) {
    console.error("Error fetching subscription by id:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription plan",
      error: error.message,
    });
  }
});

const updateSubscriptionPlan = asyncHandler(async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription ID format.",
      });
    };

    const { name, description, price, duration, periodType, features, isActive } = req.body;

    // Find the package that needs to be updated
    const plan = await Subscription.findById(subscriptionId);
    if (!plan) {
      return res.status(404).json({ message: "Subscription plan not found." });
    }

    // If name is passed then validate
    if (name) {
      const allowedNames = ["Basic", "Premium"];
      if (!allowedNames.includes(name)) {
        return res.status(400).json({
          message: `Invalid name. Allowed: ${allowedNames.join(", ")}`
        });
      }
    }

    // If periodType is passed then validate
    if (periodType) {
      const allowedPeriodTypes = ["day", "week", "month"];
      if (!allowedPeriodTypes.includes(periodType)) {
        return res.status(400).json({
          message: `Invalid periodType. Allowed: ${allowedPeriodTypes.join(", ")}`
        });
      }
    }

    // Check for duplicates with other packages (if any key fields have changed)
    if (name || price || periodType) {
      const existingPlan = await Subscription.findOne({
        _id: { $ne: subscriptionId }, // ignore itself
        name: name || plan.name,
        periodType: periodType || plan.periodType,
        price: price || plan.price,
      });
      if (existingPlan) {
        return res.status(400).json({
          message: "Another subscription plan with same name, periodType and price already exists."
        });
      }
    }

    // Update only the submitted fields
    plan.name = name ?? plan.name;
    plan.description = description ?? plan.description;
    plan.price = price ?? plan.price;
    plan.duration = duration ?? plan.duration;
    plan.periodType = periodType ?? plan.periodType;
    plan.features = Array.isArray(features) ? features : plan.features;
    if (isActive !== undefined) plan.isActive = isActive;

    const updatedPlan = await plan.save();

    return res.status(200).json({
      success: true,
      message: "Subscription plan updated successfully",
      plan: updatedPlan,
    });

  } catch (error) {
    console.error("Error updating subscription plan:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update subscription plan",
      error: error.message,
    });
  }
});

const deleteSubscriptionPlan = asyncHandler(async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription ID format.",
      });
    }

    const plan = await Subscription.findById(subscriptionId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found.",
      });
    }

    // Only block if there is a Payment involved
    const relatedPayment = await Payment.findOne({
      subscriptionId: new mongoose.Types.ObjectId(subscriptionId),
    });
    if (relatedPayment) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete: This plan has related payment history.",
      });
    }

    // (Optional) Warn if a user is using it
    const activeUserSub = await UserSubscription.findOne({
      subscriptionId: new mongoose.Types.ObjectId(subscriptionId),
    });
    if (activeUserSub) {
      console.warn(`Plan ${subscriptionId} is still in use by some users.`);
    }

    await Subscription.deleteOne({ _id: subscriptionId });

    return res.status(200).json({
      success: true,
      message: "Subscription plan deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting subscription plan:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete subscription plan",
      error: error.message,
    });
  }
});

module.exports = {
  getSubscriptionSummary,
  getTopSubscriptions,
  getAllSubscriptionPlans,
  createSubscriptionPlan,
  getSubscriptionById,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
};