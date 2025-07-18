const ReportReview = require("../../models/interactions/reportReview");
const Channel = require("../../models/user/channel");
const Video = require("../../models/content/video");
const ShortVideo = require("../../models/content/shortVideo");
const Blog = require("../../models/content/blog");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const createReportReview = asyncHandler(async (req, res) => {
    const { channelId, contentType, contentId, reason } = req.body;

    if (!contentType || !contentId || !reason) {
        return res.status(400).json({ message: "Missing required fields." });
    }

    let reportedChannelId;

    // Tìm channelId của người bị report dựa trên contentType
    if (contentType === "Video") {
        const video = await Video.findById(contentId);
        if (!video) return res.status(404).json({ message: "Video not found." });
        reportedChannelId = video.uploader;
    } else if (contentType === "ShortVideo") {
        const shortVideo = await ShortVideo.findById(contentId);
        if (!shortVideo) return res.status(404).json({ message: "ShortVideo not found." });
        reportedChannelId = shortVideo.uploader;
    } else if (contentType === "Blog") {
        const blog = await Blog.findById(contentId);
        if (!blog) return res.status(404).json({ message: "Blog not found." });
        reportedChannelId = blog.author;
    } else {
        return res.status(400).json({ message: "Invalid contentType." });
    }

    let existingReport = await ReportReview.findOne({contentType, contentId, reason,});

    if (existingReport) {
        const hasReported = existingReport.reporters.includes(channelId);

        if (hasReported) {
            return res.status(200).json({ message: "Bạn đã báo cáo nội dung này trước đó." });
        }

        existingReport.reporters.push(channelId);
        await existingReport.save();

        return res.status(201).json({
            message: "Báo cáo đã được thêm vào danh sách theo dõi.",
            report: existingReport
        });
    }

    const newReport = new ReportReview({
        contentType,
        contentId,
        reason,
        reporters: [channelId],
        reportedChannel: reportedChannelId
    });

    await newReport.save();

    // Tăng reportReviewCount tương ứng
    if (contentType === "Video") {
        await Video.findByIdAndUpdate(contentId, { $inc: { reportReviewCount: 1 } });
    } else if (contentType === "ShortVideo") {
        await ShortVideo.findByIdAndUpdate(contentId, { $inc: { reportReviewCount: 1 } });
    } else if (contentType === "Blog") {
        await Blog.findByIdAndUpdate(contentId, { $inc: { reportReviewCount: 1 } });
    } else {
        return res.status(400).json({ message: "Invalid contentType." });
    }

    return res.status(201).json({
        message: "Báo cáo của bạn đã được gửi.",
        report: newReport
    });
});

module.exports = {
    createReportReview,
};