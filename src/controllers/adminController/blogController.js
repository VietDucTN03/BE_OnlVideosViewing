const Channel = require("../../models/user/channel");
const Blog = require("../../models/content/blog");
const ReportReview = require("../../models/interactions/reportReview");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const deleteFromCloudinary = require("../../utils/cloudinary/deleteFromCloudinary");

const getBlogStats = asyncHandler(async (req, res) => {
    const totalBlogs = await Blog.countDocuments();
    const privateBlogs = await Blog.countDocuments({ isPrivate: true });
    const publicBlogs = await Blog.countDocuments({ isPrivate: false });

    res.status(200).json([
        { key: "total", value: totalBlogs, title: "Total Blogs" },
        { key: "public", value: publicBlogs, title: "Public" },
        { key: "private", value: privateBlogs, title: "Private" },
    ]);
});

const getAllBlogs = asyncHandler(async (req, res) => {
    const {
        page = 1,
        sort = "createdAtDesc",
        keyword = "",
        visibilityStatus = "all", // all | public | private
        banStatus = "all", // all | banned | notBanned
        violationStatus = "all", // all | normal | warning | banned
    } = req.query;

    const pageNum = parseInt(page);
    const limit = 5;
    const skip = (pageNum - 1) * limit;

    const sortOptions = {
        createdAtDesc: { createdAt: -1 },
        createdAtAsc: { createdAt: 1 },
        likesDesc: { "statusTotal.like": -1 },
        // dislikesDesc: { "statusTotal.dislike": -1 },
        commentsDesc: { commentTotal: -1 },
        reportReviewsDesc: { reportReviewCount: -1 },
    };

    const sortCondition = sortOptions[sort] || sortOptions.createdAtDesc;

    const query = {};

    if (keyword) {
        const matchedChannels = await Channel.find({
            nameChannel: { $regex: keyword, $options: "i" },
        }).select("_id");

        query.$or = [
            { title: { $regex: keyword, $options: "i" } },
            { author: { $in: matchedChannels.map((channel) => channel._id) } },
        ];
    }

    if (["public", "private"].includes(visibilityStatus)) {
        if (visibilityStatus === "public") {
            query.isPrivate = false;
        } else if (visibilityStatus === "private") {
            query.isPrivate = true;
        }
    }

    if (["banned", "notBanned"].includes(banStatus)) {
        if (banStatus === "banned") {
            query.isBanned = true;
        } else if (banStatus === "notBanned") {
            query.isBanned = false;
        }
    }

    // Filter theo violationStatus
    if (["normal", "warning", "banned"].includes(violationStatus)) {
        query.violationStatus = violationStatus;
    }

    const totalBlogs = await Blog.countDocuments(query);

    const blogs = await Blog.find(query)
        .populate({
            path: "author",
            select: "nameChannel avatarChannel",
        })
        .sort(sortCondition)
        .skip(skip)
        .limit(limit)
        .lean();

    const result = blogs.map((blog) => ({
        id: blog._id,
        title: blog.title,
        blogImgs: blog.blogImgs,
        categories: blog.categories,
        like: blog.statusTotal?.like || 0,
        // dislike: blog.statusTotal?.dislike || 0,
        comments: blog.commentTotal,
        reportReviews: blog.reportReviewCount,
        isPrivate: blog.isPrivate,
        isBanned: blog.isBanned,
        violationStatus: blog.violationStatus,
        createdAt: blog.createdAt,
        channelName: blog.author?.nameChannel || "",
        channelAvatar: blog.author?.avatarChannel || "",
    }));

    res.status(200).json({
        totalBlogs,
        blogs: result,
        hasMore: skip + limit < totalBlogs,
        // page: pageNum,
        limit,
        sort,
        keyword,
        visibilityStatus,
        banStatus,
        violationStatus,
    });
});

const getBlogById = asyncHandler(async (req, res) => {
    const { blogId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
        return res.status(400).json({ message: "Invalid blogId format" });
    }

    const blog = await Blog.findById(blogId)
        .populate({
            path: "author",
            select: "nameChannel avatarChannel subscribersCount violationStatus owner",
        })
        .lean();

    if (!blog) {
        return res.status(404).json({ message: "Blog not found" });
    }

    res.status(200).json({
        id: blog._id,
        title: blog.title,
        content: blog.content,
        blogImgs: blog.blogImgs,
        categories: blog.categories,
        like: blog.statusTotal?.like || 0,
        dislike: blog.statusTotal?.dislike || 0,
        comments: blog.commentTotal,
        reportCount: blog.reportCount,
        isPrivate: blog.isPrivate,
        isBanned: blog.isBanned,
        violationStatus: blog.violationStatus,
        createdAt: blog.createdAt,
        channelName: blog.author?.nameChannel || "",
        channelAvatar: blog.author?.avatarChannel || "",
        subscribersCount: blog.author?.subscribersCount || 0,
        owner: blog.author?.owner || false
    });
});

const getReportsByBlogId = asyncHandler(async (req, res) => {
    const { blogId } = req.params;
    const { resolvedResult = "all", page = 1 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
        return res.status(400).json({ message: "Invalid blogId format" });
    }

    const pageNum = parseInt(page);
    const limit = 5;
    const skip = (pageNum - 1) * limit;

    // Tạo điều kiện truy vấn
    const query = {
        contentId: blogId,
        contentType: "Blog",
    };

    // Lọc theo trạng thái xử lý
    if (["valid", "invalid", "pending"].includes(resolvedResult)) {
        query.resolvedResult = resolvedResult;
    }

    // Đếm tổng số report thỏa điều kiện
    const totalReports = await ReportReview.countDocuments(query);

    // Lấy danh sách report phân trang
    const reports = await ReportReview.find(query)
        .populate("reporters", "nameChannel avatarChannel")
        // .populate("reportedChannel", "nameChannel avatarChannel")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    if (!reports || reports.length === 0) {
        return res.status(200).json({
            blogId,
            totalReports: 0,
            hasMore: false,
            page: pageNum,
            limit,
            resolvedResult: resolvedResult || "all",
            reports: [],
            message: "No reports found",
        });
    }

    const formattedReports = reports.map((report) => ({
        id: report._id,
        reason: report.reason,
        isResolved: report.isResolved,
        resolvedResult: report.resolvedResult,
        createdAt: report.createdAt,
        // reportedChannel: {
        //   id: report.reportedChannel?._id,
        //   nameChannel: report.reportedChannel?.nameChannel,
        //   avatarChannel: report.reportedChannel?.avatarChannel,
        // },
        reporters: report.reporters?.map((rep) => ({
            id: rep._id,
            nameChannel: rep.nameChannel,
            avatarChannel: rep.avatarChannel,
        })),
    }));

    res.status(200).json({
        blogId,
        totalReports,
        hasMore: skip + limit < totalReports,
        page: pageNum,
        limit,
        resolvedResult: resolvedResult || "all",
        reports: formattedReports,
    });
});

const deleteBlogById = asyncHandler(async (req, res) => {
    const { blogId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
        return res.status(400).json({ message: "Invalid blogId format" });
    }

    const blog = await Blog.findById(blogId);

    if (!blog) {
        return res.status(404).json({ message: "Blog not found" });
    }

    await deleteFromCloudinary(blog.blogImgs, "image");
    
    await Blog.findByIdAndDelete(blogId);

    res.status(200).json({ message: `Blog "${blog.title}" deleted successfully` });
});

module.exports = {
    getBlogStats,
    getAllBlogs,
    getBlogById,
    getReportsByBlogId,
    deleteBlogById,
};