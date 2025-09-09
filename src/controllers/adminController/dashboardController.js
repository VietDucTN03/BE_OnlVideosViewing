const Channel = require("../../models/user/channel");
const User = require("../../models/user/user");
const Video = require("../../models/content/video");
const Blog = require("../../models/content/blog");
const ShortVideo = require("../../models/content/shortVideo");
const Comment = require("../../models/interactions/comment");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const { getWeekLabels, getMonthLabels, getPeriodTextForWeekOrMonth, getTimeRange, getPeriodTextForQuarterOrYear } = require("../../utils/dashboard/statsHelper");

const getSystemStats = asyncHandler(async (req, res) => {
    try {
        // 📌 User/Account
        const totalAccounts = await User.countDocuments();
        const blockedAccounts = await User.countDocuments({ isBlocked: true });
        const normalAccounts = totalAccounts - blockedAccounts;

        // 📌 Videos
        const videoTotal = await Video.countDocuments();
        const videoNormal = await Video.countDocuments({ violationStatus: "normal" });
        const videoWarning = await Video.countDocuments({ violationStatus: "warning" });
        const videoBanned = await Video.countDocuments({ violationStatus: "banned" });

        // 📌 Shorts
        const shortTotal = await ShortVideo.countDocuments();
        const shortNormal = await ShortVideo.countDocuments({ violationStatus: "normal" });
        const shortWarning = await ShortVideo.countDocuments({ violationStatus: "warning" });
        const shortBanned = await ShortVideo.countDocuments({ violationStatus: "banned" });

        // 📌 Blogs
        const blogTotal = await Blog.countDocuments();
        const blogNormal = await Blog.countDocuments({ violationStatus: "normal" });
        const blogWarning = await Blog.countDocuments({ violationStatus: "warning" });
        const blogBanned = await Blog.countDocuments({ violationStatus: "banned" });

        res.status(200).json({
            accounts: {
                total: totalAccounts,
                blocked: blockedAccounts,
                normal: normalAccounts,
            },
            videos: {
                total: videoTotal,
                normal: videoNormal,
                warning: videoWarning,
                banned: videoBanned,
            },
            shorts: {
                total: shortTotal,
                normal: shortNormal,
                warning: shortWarning,
                banned: shortBanned,
            },
            blogs: {
                total: blogTotal,
                normal: blogNormal,
                warning: blogWarning,
                banned: blogBanned,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
});

const getUserStatsByFilter = asyncHandler(async (req, res) => {
    try {
        const { filter = "week" } = req.query;
        const now = new Date();
        let startDate, labels, stats;

        if (filter === "week") {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);

            labels = getWeekLabels(startDate);

            let newAccountData = [], blockedAccountData = [];
            for (let i = 0; i < 7; i++) {
                const dayStart = new Date(startDate);
                dayStart.setDate(startDate.getDate() + i);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(dayStart);
                dayEnd.setHours(23, 59, 59, 999);

                const [newAccounts, blockedAccounts] = await Promise.all([
                    User.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } }),
                    User.countDocuments({ isBlocked: true, updatedAt: { $gte: dayStart, $lte: dayEnd } })
                ]);

                newAccountData.push(newAccounts);
                blockedAccountData.push(blockedAccounts);
            }

            stats = [
                { key: "New Accounts", data: newAccountData },
                { key: "Blocked Accounts", data: blockedAccountData }
            ];

        } else if (filter === "month") {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            const daysInMonth = now.getDate();
            labels = getMonthLabels(daysInMonth);

            let newAccountData = Array(labels.length).fill(0);
            let blockedAccountData = Array(labels.length).fill(0);

            for (let i = 1; i <= daysInMonth; i++) {
                const dayStart = new Date(now.getFullYear(), now.getMonth(), i, 0, 0, 0);
                const dayEnd = new Date(now.getFullYear(), now.getMonth(), i, 23, 59, 59);

                const [newAccounts, blockedAccounts] = await Promise.all([
                    User.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } }),
                    User.countDocuments({ isBlocked: true, updatedAt: { $gte: dayStart, $lte: dayEnd } })
                ]);

                const weekIndex = Math.floor((i - 1) / 7);
                newAccountData[weekIndex] += newAccounts;
                blockedAccountData[weekIndex] += blockedAccounts;
            }

            stats = [
                { key: "New Accounts", data: newAccountData },
                { key: "Blocked Accounts", data: blockedAccountData }
            ];
        } else {
            return res.status(400).json({ success: false, message: "Invalid filter. Use 'week' or 'month'." });
        }

        res.status(200).json({
            success: true,
            filter,
            period: getPeriodTextForWeekOrMonth(filter, startDate, now),
            labels,
            stats
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

const getContentStatsByFilter = asyncHandler(async (req, res) => {
    try {
        const { filter = "week" } = req.query;
        const now = new Date();
        let startDate, labels, stats;

        if (filter === "week") {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);

            labels = getWeekLabels(startDate);

            let videoData = [], blogData = [], shortData = [];

            for (let i = 0; i < 7; i++) {
                const dayStart = new Date(startDate);
                dayStart.setDate(startDate.getDate() + i);
                dayStart.setHours(0, 0, 0, 0);

                const dayEnd = new Date(dayStart);
                dayEnd.setHours(23, 59, 59, 999);

                const [videoCount, blogCount, shortCount] = await Promise.all([
                    Video.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } }),
                    Blog.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } }),
                    ShortVideo.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } })
                ]);

                videoData.push(videoCount);
                blogData.push(blogCount);
                shortData.push(shortCount);
            }

            stats = [
                { key: "Videos", data: videoData },
                { key: "Shorts", data: shortData },
                { key: "Blogs", data: blogData },
            ];

        } else if (filter === "month") {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            const daysInMonth = now.getDate();
            labels = getMonthLabels(daysInMonth);

            let videoData = Array(labels.length).fill(0);
            let blogData = Array(labels.length).fill(0);
            let shortData = Array(labels.length).fill(0);

            for (let i = 1; i <= daysInMonth; i++) {
                const dayStart = new Date(now.getFullYear(), now.getMonth(), i, 0, 0, 0);
                const dayEnd = new Date(now.getFullYear(), now.getMonth(), i, 23, 59, 59);

                const [videoCount, blogCount, shortCount] = await Promise.all([
                    Video.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } }),
                    Blog.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } }),
                    ShortVideo.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } })
                ]);

                const weekIndex = Math.floor((i - 1) / 7);
                videoData[weekIndex] += videoCount;
                blogData[weekIndex] += blogCount;
                shortData[weekIndex] += shortCount;
            }

            stats = [
                { key: "Videos", data: videoData },
                { key: "Shorts", data: shortData },
                { key: "Blogs", data: blogData },
            ];
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid filter. Use 'week' or 'month'.",
            });
        }

        res.status(200).json({
            success: true,
            filter,
            period: getPeriodTextForWeekOrMonth(filter, startDate, now),
            labels,
            stats,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
});

const buildPipeline = (startDate, now, fieldName) => ([
    {
        $match: {
            createdAt: { $gte: startDate, $lte: now }
        }
    },
    {
        $project: {
            month: { $month: "$createdAt" },
            total: `$${fieldName}`
        }
    },
    {
        $group: {
            _id: "$month",
            total: { $sum: "$total" }
        }
    },
    { $sort: { _id: 1 } }
]);

const getViewStatsByFilter = asyncHandler(async (req, res) => {
    try {
        const { filter = "quarter" } = req.query;
        const now = new Date();
        const { year, currentMonth, startMonth, endMonth, currentQuarter } = getTimeRange(filter, now);

        const pipeline = buildPipeline(new Date(`${year}-${startMonth}-01`), now, "views");

        const [videoStats, shortStats] = await Promise.all([
            Video.aggregate(pipeline),
            ShortVideo.aggregate(pipeline)
        ]);

        const labels = [];
        const videoData = [];
        const shortData = [];

        for (let m = startMonth; m <= Math.min(endMonth, currentMonth); m++) {
            labels.push(`Tháng ${m}`);
            videoData.push(videoStats.find(v => v._id === m)?.total || 0);
            shortData.push(shortStats.find(s => s._id === m)?.total || 0);
        }

        return res.status(200).json({
            success: true,
            filter,
            period: getPeriodTextForQuarterOrYear(filter, { year, startMonth, endMonth, currentMonth, currentQuarter }),
            labels,
            stats: [
                { key: "Video Views", data: videoData },
                { key: "Short Video Views", data: shortData }
            ]
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

const getCommentStatsByFilter = asyncHandler(async (req, res) => {
    try {
        const { filter = "quarter" } = req.query;
        const now = new Date();
        const { year, currentMonth, startMonth, endMonth, currentQuarter } = getTimeRange(filter, now);

        const startDate = new Date(`${year}-${startMonth}-01`);

        const pipeline = buildPipeline(startDate, now, "commentTotal");

        const [videoStats, shortStats, blogStats] = await Promise.all([
            Video.aggregate(pipeline),
            ShortVideo.aggregate(pipeline),
            Blog.aggregate(pipeline)
        ]);

        const labels = [];
        const blogData = [];
        const videoData = [];
        const shortData = [];

        for (let m = startMonth; m <= Math.min(endMonth, currentMonth); m++) {
            labels.push(`Tháng ${m}`);
            blogData.push(blogStats.find(s => s._id === m)?.total || 0);
            videoData.push(videoStats.find(s => s._id === m)?.total || 0);
            shortData.push(shortStats.find(s => s._id === m)?.total || 0);
        }

        return res.status(200).json({
            success: true,
            filter,
            period: getPeriodTextForQuarterOrYear(filter, { year, startMonth, endMonth, currentMonth, currentQuarter }),
            labels,
            stats: [
                { key: "Video Comments", data: videoData },
                { key: "Short Video Comments", data: shortData },
                { key: "Blog Comments", data: blogData },
            ]
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

module.exports = {
    getSystemStats,
    getUserStatsByFilter,
    getContentStatsByFilter,
    getViewStatsByFilter,
    getCommentStatsByFilter,
};