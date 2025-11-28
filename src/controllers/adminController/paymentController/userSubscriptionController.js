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
    const limit = 9;
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
        endDateAsc: { endDate: 1 },
        endDateDesc: { endDate: -1 },
    };

    const sortCondition = sortOptions[sort] || sortOptions.createdAtDesc;

    const baseQuery = { userId: new mongoose.Types.ObjectId(userId) };

    let totalHistory = await UserSubscription.countDocuments(baseQuery);

    const query = { ...baseQuery };
    if (["active", "expired", "cancelled"].includes(status)) {
        query.status = status;
    }

    totalHistory = await UserSubscription.countDocuments(query);

    const totalPages = Math.ceil(totalHistory / limit);

    try {
        const filteredTotal = await UserSubscription.countDocuments(query);
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

        // * If all subscriptionId null or package is not active
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
                message: "The package has been deleted or canceled.",
            });
        }

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
                message: "This user has never subscribed to any package.",
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
        console.error("Error fetching subscription history:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch subscription history",
            error: error.message,
        });
    }
});

const getUserSubscription = asyncHandler(async (req, res) => {
    const { userId, userSubscriptionId } = req.params;

    if (!userId || !userSubscriptionId) {
        return res.status(400).json({
            success: false,
            message: "Missing user Id or user SubscriptionId."
        });
    }

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(userSubscriptionId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid user Id or user SubscriptionId format."
        });
    }

    try {
        // Get data in parallel: UserSubscription + Channel
        const [userSub, channel] = await Promise.all([
            UserSubscription.findOne({
                _id: new mongoose.Types.ObjectId(userSubscriptionId),
                userId: new mongoose.Types.ObjectId(userId),
            })
                .populate("userId", "username email")
                .populate("subscriptionId", "name description price duration periodType features isActive")
                .populate("paymentId", "paymentMethod amount status transactionId paymentDate paymentMeta")
                .lean(),
            Channel.findOne({ owner: userId })
                .select("nameChannel avatarChannel isPremium violationStatus")
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

const cancelUserSubscription = asyncHandler(async (req, res) => {
    const { userId, userSubscriptionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(userSubscriptionId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid userId or userSubscriptionId format.",
        });
    }

    try {
        const userSub = await UserSubscription.findOne({
            _id: new mongoose.Types.ObjectId(userSubscriptionId),
            userId: new mongoose.Types.ObjectId(userId),
        }).populate("subscriptionId", "name");

        if (!userSub) {
            return res.status(404).json({
                success: false,
                message: "No subscription found.",
            });
        }

        if (userSub.status !== "active") {
            return res.status(400).json({
                success: false,
                message: "This subscription is no longer active for cancellation.",
            });
        }

        userSub.status = "cancelled";
        userSub.cancelledAt = new Date();
        await userSub.save();

        await Channel.findOneAndUpdate(
            { owner: userId },
            { $set: { isPremium: false } }
        );

        await updateUserSubscription({
            userId,
            subscriptionName: userSub.subscriptionId?.name || "Premium",
            endDate: userSub.endDate,
            type: "cancelled",
        });

        return res.status(200).json({
            success: true,
            message: "Cancel subscription successfully.",
            subscription: userSub,
        });
    } catch (error) {
        console.error("Error when canceling subscription:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while canceling the subscription.",
            error: error.message,
        });
    }
});

module.exports = {
    getUserSubscriptionHistory,
    getUserSubscription,
    cancelUserSubscription,
};