const asyncHandler = require("express-async-handler");
const User = require("../../../models/user/user");
const Channel = require("../../../models/user/channel");
const Subscription = require("../../../models/payment/subscription");
const Payment = require("../../../models/payment/payment");
const UserSubscription = require("../../../models/payment/userSubscription");
const mongoose = require("mongoose");

const updateUserSubscription = require("../../../utils/payment/updateUserSubscription");

const getUserSubscriptionHistory = asyncHandler(async (req, res) => {
    const {
        page = 1,
        sort = "createdAtDesc",
        status = "all", // all | active | expired | cancelled
    } = req.query;
    const { userId } = req.params;

    const pageNum = parseInt(page, 10);
    const limit = 5;
    const skip = (pageNum - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid user ID format.",
        });
    }

    const sortOptions = {
        createdAtDesc: { createdAt: -1 },
        createdAtAsc: { createdAt: 1 },
        startDateAsc: { startDate: 1 },
        startDateDesc: { startDate: -1 },
        endDateAsc: { endDate: 1 },
        endDateDesc: { endDate: -1 },
    };

    const sortCondition = sortOptions[sort] || sortOptions.createdAtDesc;

    // Base query
    const baseQuery = { userId: new mongoose.Types.ObjectId(userId) };

    // Lấy tổng số lịch sử ban đầu (chưa filter status)
    const totalHistory = await UserSubscription.countDocuments(baseQuery);

    // Thêm điều kiện lọc
    const query = { ...baseQuery };
    if (["active", "expired", "cancelled"].includes(status)) {
        query.status = status;
    }

    const filteredTotal = await UserSubscription.countDocuments(query);
    const totalPages = Math.ceil(filteredTotal / limit);

    try {
        const history = await UserSubscription.find(query)
            .populate({
                path: "subscriptionId",
                model: "Subscription",
            })
            .populate({
                path: "paymentId",
                model: "Payment",
            })
            .sort(sortCondition)
            .skip(skip)
            .limit(limit)
            .lean();

        const hasMore = skip + history.length < filteredTotal;

        // Nếu tất cả subscriptionId null hoặc gói không active
        const allInvalid = history.every(
            (sub) => !sub.subscriptionId || sub.subscriptionId.isActive === false
        );
        if (allInvalid && history.length > 0) {
            return res.status(200).json({
                success: true,
                history: [],
                totalHistory: filteredTotal,
                totalPages,
                page: pageNum,
                limit,
                hasMore,
                sort,
                status,
                message: "Gói đã bị xóa hoặc hủy.",
            });
        }

        // Không có bản ghi
        if (totalHistory === 0) {
            return res.status(200).json({
                success: true,
                history: [],
                totalHistory: 0,
                totalPages: 0,
                page: 1,
                limit,
                hasMore: false,
                sort,
                status,
                message: "Người dùng này chưa từng đăng ký gói nào.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Successfully fetched subscription history",
            history,
            totalHistory: filteredTotal,
            totalPages,
            page: pageNum,
            limit,
            hasMore,
            sort,
            status,
        });
    } catch (error) {
        console.error("❌ Error fetching subscription history:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch subscription history",
            error: error.message,
        });
    }
});

const cancelUserSubscription = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid user ID format.",
        });
    }

    // Tìm gói đang active
    const activeSub = await UserSubscription.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        status: "active",
    }).populate("subscriptionId");

    if (!activeSub) {
        return res.status(400).json({
            success: false,
            message: "Không có gói đăng ký đang hoạt động để hủy.",
        });
    }

    // Cập nhật trạng thái gói thành cancelled
    activeSub.status = "cancelled";
    activeSub.cancelledAt = new Date();
    await activeSub.save();

    // Cập nhật kênh thành không premium
    await Channel.findOneAndUpdate(
        { owner: userId },
        { $set: { isPremium: false } }
    );

    // Gọi hàm updateUserSubscription
    await updateUserSubscription({
        userId,
        subscriptionName: activeSub.subscriptionId?.name || "Premium",
        endDate: activeSub.endDate,
        type: "cancelled",
    });

    return res.status(200).json({
        success: true,
        message: "Hủy gói đăng ký thành công.",
        subscription: activeSub,
    });
});

module.exports = {
    getUserSubscriptionHistory,
    cancelUserSubscription,
};