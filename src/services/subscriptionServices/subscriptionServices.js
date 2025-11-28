const asyncHandler = require("express-async-handler");
const Channel = require("../../models/user/channel");
const User = require("../../models/user/user");
const Subscription = require("../../models/payment/subscription");
const UserSubscription = require("../../models/payment/userSubscription");
const Payment = require("../../models/payment/payment");

const updateUserSubscription = require("../../utils/payment/updateUserSubscription");

const getSubscriptionPlans = asyncHandler(async (req, res) => {
  try {
    const plans = await Subscription.find({ isActive: true })
      .sort({ price: 1 }); // sort from low price -> high price

    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: "Error fetching subscription plans" });
  }
});

const getUserSubscriptionOfUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, status = "all", sort = "createdAtDesc" } = req.query;

  if (!userId) {
    return res.status(400).json({ message: "Missing userId." });
  }

  const pageNum = parseInt(page, 10);
  const limit = 5;
  const skip = (pageNum - 1) * limit;

  const sortOptions = {
    createdAtDesc: { createdAt: -1 },
    createdAtAsc: { createdAt: 1 },
    endDateDesc: { endDate: -1 },
    endDateAsc: { endDate: 1 }
  };

  const sortCondition = sortOptions[sort] || sortOptions.createdAtDesc;

  // Base query
  const query = { userId };

  // Filter by status
  if (status && status !== "all") {
    query.status = status;
  }

  try {
    const totalSubs = await UserSubscription.countDocuments(query);
    const totalPages = Math.ceil(totalSubs / limit);

    const subs = await UserSubscription.find(query)
      .populate("subscriptionId", "name price duration periodType features")
      .populate("paymentId", "method amount status")
      .sort(sortCondition)
      .skip(skip)
      .limit(limit)
      .lean();

    const hasMore = skip + subs.length < totalSubs;

    if (totalSubs === 0) {
      return res.status(200).json({
        success: true,
        subscriptions: [],
        totalSubscriptions: 0,
        totalPages: 0,
        page: 1,
        limit,
        hasMore: false,
        status,
        sort,
        message: "User does not have any subscriptions."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Successfully fetched user subscriptions",
      subscriptions: subs,
      totalSubscriptions: totalSubs,
      totalPages,
      page: pageNum,
      limit,
      hasMore,
      status,
      sort
    });
  } catch (error) {
    console.error("Error when getting subscription by userId:", error);
    res.status(500).json({
      message: "Failed to fetch user subscriptions",
      error: error.message
    });
  }
});

const getDetailsOfUserSubscription = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { userSubscriptionId } = req.params;

  if (!userId || !userSubscriptionId) {
    return res.status(400).json({
      success: false,
      message: "Missing userId or userSubscriptionId."
    });
  }

  try {
    // Run parallel to get subscription + channel
    const [userSub, channel] = await Promise.all([
      UserSubscription.findOne({ _id: userSubscriptionId, userId })
        .populate("userId", "username email")
        .populate("subscriptionId", "name description price duration periodType features")
        .populate("paymentId", "paymentMethod amount status transactionId paymentDate")
        .lean(),
      Channel.findOne({ owner: userId })
        .select("nameChannel avatarChannel isPremium")
        .lean()
    ]);

    if (!userSub) {
      return res.status(404).json({
        success: false,
        message: "No subscription found or no access."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Get subscription details successfully.",
      subscription: userSub,
      channel: channel || null
    });
  } catch (error) {
    console.error("Error while getting userSubscription details:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while retrieving userSubscription details.",
      error: error.message
    });
  }
});

const checkExpiredSubscriptions = async (res = null) => {
  try {
    const now = new Date();

    const expiredSubs = await UserSubscription.find({
      status: "active",
      endDate: { $lte: now }  // * less than or equal (endDate <= now)
    }).populate("subscriptionId", "name");

    if (expiredSubs.length === 0) return;

    for (const sub of expiredSubs) {
      sub.status = "expired";
      await sub.save();

      await Channel.findOneAndUpdate(
        { owner: sub.userId },
        { isPremium: false },
        { new: true }
      );

      await updateUserSubscription({
        userId: sub.userId,
        subscriptionName: sub.subscriptionId?.name || "Premium",
        endDate: sub.endDate,
        type: "expired"
      });
    }

    if (res) {
      res.cookie("showExpiredModal", "true", {
        httpOnly: false,
        maxAge: 1000 * 60, // 1 minute
        sameSite: "strict",
      });
      console.log("The showExpiredModal cookie has been set for the client.");
    } else {
      console.log("No client, skip cookie set.");
    }

    console.log(`Updated ${expiredSubs.length} subscription expiration.`);
  } catch (error) {
    console.error("Error when checking expired subscriptions:", error);
  }
};

const cancelUserSubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { userSubscriptionId } = req.params;

  if (!userId || !userSubscriptionId) {
    return res.status(400).json({ message: "Missing userId or userSubscriptionId" });
  }

  try {
    const userSub = await UserSubscription.findOne({
      _id: userSubscriptionId,
      userId
    }).populate("subscriptionId", "name");

    if (!userSub) {
      return res.status(404).json({
        success: false,
        message: "No subscription found."
      });
    }

    if (userSub.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Subscription is not active and cannot be canceled."
      });
    }

    userSub.status = "cancelled";
    userSub.cancelledAt = new Date();
    await userSub.save();

    await Channel.findOneAndUpdate(
      { owner: userId },
      { isPremium: false },
      { new: true }
    );

    await updateUserSubscription({
      userId,
      subscriptionName: userSub.subscriptionId?.name || "Premium",
      endDate: userSub.endDate,
      type: "cancelled"
    });

    return res.status(200).json({
      success: true,
      message: "Subscription has been canceled successfully.",
      subscription: userSub
    });
  } catch (error) {
    console.error("Error when canceling subscription:", error);
    res.status(500).json({
      success: false,
      message: "Error canceling subscription",
      error: error.message
    });
  }
});

module.exports = {
  getSubscriptionPlans,
  getUserSubscriptionOfUser,
  getDetailsOfUserSubscription,
  checkExpiredSubscriptions,
  cancelUserSubscription,
};
