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
      .sort({ price: 1 }); // sắp xếp từ giá thấp -> cao

    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: "Error fetching subscription plans" });
  }
});

const getUserSubscriptionOfUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, status = "all", sort = "createdAtDesc" } = req.query;

  if (!userId) {
    return res.status(400).json({ message: "Thiếu userId." });
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

  // ✅ Filter theo status, bỏ qua nếu là "all" hoặc rỗng
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
    console.error("❌ Lỗi khi lấy subscription theo userId:", error);
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
      message: "Thiếu userId hoặc userSubscriptionId."
    });
  }

  try {
    // ✅ Chạy song song lấy subscription + channel
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
        message: "Không tìm thấy subscription hoặc không có quyền truy cập."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy chi tiết subscription thành công.",
      subscription: userSub,
      channel: channel || null
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy chi tiết userSubscription:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy chi tiết userSubscription.",
      error: error.message
    });
  }
});

const checkExpiredSubscriptions = async () => {
  try {
    const now = new Date();

    const expiredSubs = await UserSubscription.find({
      status: "active",
      endDate: { $lte: now }  // * less than or equal (endDate <= now)
    });

    if (expiredSubs.length === 0) return;

    for (const sub of expiredSubs) {
      sub.status = "expired";
      await sub.save();

      await Channel.findOneAndUpdate(
        { owner: sub.userId },
        { isPremium: false },
        { new: true }
      );
    }

    res.cookie("showExpiredModal", "true", {
      httpOnly: false,
      maxAge: 1000 * 60,
      sameSite: "strict",
    });

    console.log(`✅ Đã cập nhật ${expiredSubs.length} subscription hết hạn.`);
  } catch (error) {
    console.error("❌ Lỗi khi check expired subscriptions:", error);
  }
};

const cancelUserSubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { userSubscriptionId } = req.params;

  if (!userId || !userSubscriptionId) {
    return res.status(400).json({ message: "Thiếu userId hoặc userSubscriptionId." });
  }

  try {
    const userSub = await UserSubscription.findOne({
      _id: userSubscriptionId,
      userId
    }).populate("subscriptionId", "name");

    if (!userSub) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy subscription."
      });
    }

    if (userSub.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Subscription không ở trạng thái active, không thể hủy."
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
      message: "Subscription đã được hủy thành công.",
      subscription: userSub
    });
  } catch (error) {
    console.error("❌ Lỗi khi hủy subscription:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi hủy subscription",
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
