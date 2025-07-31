const Channel = require("../../models/user/channel");
const User = require("../../models/user/user");
const Video = require("../../models/content/video");
const Blog = require("../../models/content/blog");
const ShortVideo = require("../../models/content/shortVideo");
const Comment = require("../../models/interactions/comment");
const ReportReview = require("../../models/interactions/reportReview");

const checkAndUpdateContentViolationStatus = require("../../utils/checkAndUpdateReport/checkAndUpdateContentViolationStatus");

const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const getReportReviewStats = asyncHandler(async (req, res) => {
    const totalReports = await ReportReview.countDocuments();
    const validReports = await ReportReview.countDocuments({ resolvedResult: "valid" });
    const invalidReports = await ReportReview.countDocuments({ resolvedResult: "invalid" });
    const pendingReports = await ReportReview.countDocuments({ resolvedResult: "pending" });

    res.status(200).json([
        { key: "total", value: totalReports, title: "Total Reports" },
        { key: "valid", value: validReports, title: "Valid Reports" },
        { key: "invalid", value: invalidReports, title: "Invalid Reports" },
        { key: "pending", value: pendingReports, title: "Pending Reports" },
    ]);
});

const getAllReportReviews = asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        contentType, 
        status, 
        sort = "newest", 
        resolved,
        reason
    } = req.query;

    const pageNum = parseInt(page);
    const limit = 5;
    const skip = (pageNum - 1) * limit;

    // Query điều kiện
    const query = {};

    // Filter contentType
    if (contentType && contentType !== "all" && ["Video", "ShortVideo", "Blog"].includes(contentType)) {
        query.contentType = contentType;
    }

    // Filter resolvedResult
    if (status && status !== "all" && ["valid", "invalid", "pending"].includes(status)) {
        query.resolvedResult = status;
    }

    // Filter isResolved
    if (resolved && resolved !== "all") {
        if (resolved === "resolved") {
            query.isResolved = true;
        } else if (resolved === "unresolved") {
            query.isResolved = false;
        }
    }

    // Filter reason
    if (reason && reason !== "all") {
        query.reason = reason;
    }

    // Sắp xếp
    const sortOptions = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 }
    };
    const sortCondition = sortOptions[sort] || sortOptions.newest;

    // Đếm tổng
    const totalReports = await ReportReview.countDocuments(query);

    // Lấy dữ liệu
    const reports = await ReportReview.find(query)
        .sort(sortCondition)
        .skip(skip)
        .limit(limit)
        .populate("reporters", "nameChannel avatarChannel")
        .populate({
            path: "reportedChannel",
            select: "nameChannel avatarChannel violationStatus reportCount owner",
            populate: {
                path: "owner",
                select: "email typeLogin isBlocked"
            }
        })
        .lean();

    // Kiểm tra còn trang sau không
    const hasMore = skip + limit < totalReports;

    res.status(200).json({
        reports,
        totalReports,
        hasMore,
        page: pageNum,
        limit,
        contentType: contentType || "all",
        status: status || "all",
        sort: sort || "newest",
        resolved: resolved || "all",
        reason: reason || "all",
    });
});

const getReportReviewById = asyncHandler(async (req, res) => {
    const { reportId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
        return res.status(400).json({ message: "Invalid report id" });
    }

    // Tìm reportReview và populate dữ liệu channel
    const report = await ReportReview.findById(reportId)
        .populate({
            path: "reporters",
            select: "nameChannel avatarChannel"
        })
        .populate({
            path: "reportedChannel",
            select: "nameChannel avatarChannel violationStatus reportCount owner",
            populate: {
                path: "owner",
                select: "email typeLogin isBlocked"
            }
        })
        .lean();

    if (!report) {
        return res.status(404).json({ message: "Report not found" });
    }

    const { contentType, contentId } = report;

    if (!contentType || !contentId) {
        return res.status(400).json({ message: "Invalid content type or id" });
    }

    let contentData;

    switch (contentType) {
        case "Video":
            contentData = await Video.findById(contentId, "-category -views -statusTotal -playList -commentTotal")
                .populate({
                    path: "uploader",
                    select: "nameChannel avatarChannel"
                })
                .lean();
            break;
        case "ShortVideo":
            contentData = await ShortVideo.findById(contentId, "-tags -category -views -statusTotal -playList -commentTotal")
                .populate({
                    path: "uploader",
                    select: "nameChannel avatarChannel"
                })
                .lean();
            break;
        case "Blog":
            contentData = await Blog.findById(contentId, "-categories -statusTotal -commentTotal")
                .populate({
                    path: "author",
                    select: "nameChannel avatarChannel"
                })
                .lean();
            break;
        default:
            return res.status(400).json({ message: "Unsupported content type" });
    }

    if (!contentData) {
        return res.status(404).json({ message: `${contentType} not found` });
    }

    const reportWithContent = { ...report, content: contentData };

    res.status(200).json({
        report: reportWithContent
    });
});

// const resolveVideoReport = asyncHandler(async (req, res) => {
//   const { reportId } = req.params;
//   const { result } = req.body; // 'valid' hoặc 'invalid'

//   if (!mongoose.Types.ObjectId.isValid(reportId)) {
//     return res.status(400).json({ message: "Invalid report ID" });
//   }

//   if (!["valid", "invalid"].includes(result)) {
//     return res.status(400).json({ message: "Kết quả phải là 'valid' hoặc 'invalid'" });
//   }

//   const report = await ReportReview.findById(reportId);
//   if (!report) {
//     return res.status(404).json({ message: "Report không tồn tại" });
//   }

//   if (report.contentType !== "Video") {
//     return res.status(400).json({ message: "Report này không thuộc loại video" });
//   }

//   if (report.resolvedResult !== "pending") {
//     return res.status(400).json({ message: "Report đã được xử lý trước đó" });
//   }

//   report.resolvedResult = result;
//   report.isResolved = true;
//   await report.save();

//   if (result === "valid") {
//     await Video.updateOne(
//       { _id: report.contentId },
//       { $inc: { reportCount: 1 } }
//     );
//   }

//   res.status(200).json({
//     reportId: report._id,
//     contentId: report.contentId,
//     resolvedResult: report.resolvedResult,
//     message: `Đã cập nhật kết quả xử lý report là "${result}"`,
//   });
// });

const resolveReportReview = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { result } = req.body;

  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    return res.status(400).json({ message: "Invalid report ID" });
  }

  if (!["valid", "invalid"].includes(result)) {
    return res.status(400).json({ message: "Kết quả phải là 'valid' hoặc 'invalid'" });
  }

  const report = await ReportReview.findById(reportId);
  if (!report) {
    return res.status(404).json({ message: "Report không tồn tại" });
  }

  if (report.resolvedResult !== "pending") {
    return res.status(400).json({ message: "Report đã được xử lý trước đó" });
  }

  let Model;
  let uploaderField;
  switch (report.contentType) {
    case "Video":
      Model = Video;
      uploaderField = "uploader";
      break;
    case "ShortVideo":
      Model = ShortVideo;
      uploaderField = "uploader";
      break;
    case "Blog":
      Model = Blog;
      uploaderField = "author";
      break;
    default:
      return res.status(400).json({ message: "Loại nội dung không hợp lệ" });
  }

  // Cập nhật trạng thái report
  report.resolvedResult = result;
  report.isResolved = true;
  await report.save();

  // Giảm reportReviewCount và (nếu valid) tăng reportCount
  const updateFields = { $inc: { reportReviewCount: -1 } };
  if (result === "valid") {
    updateFields.$inc.reportCount = 1;
  }

  await Model.updateOne(
    { _id: report.contentId },
    updateFields
  );

  // Nếu valid, check thêm để xử lý violationStatus & isBanned
  if (result === "valid") {
    const content = await Model.findById(report.contentId);
    if (content) {
      await checkAndUpdateContentViolationStatus({ content, Model, uploaderField });
    }
  }

  res.status(200).json({
    reportId: report._id,
    contentId: report.contentId,
    resolvedResult: report.resolvedResult,
    message: `Đã cập nhật kết quả xử lý report của ${report.contentType} là "${result}"`,
  });
});

module.exports = {
    getReportReviewStats,
    getAllReportReviews,
    getReportReviewById,
    // resolveVideoReport,
    resolveReportReview,
};

// * hàm gửi Cảnh báo đến tài khoản (thêm số lần bị ăn gậy, 3 lần = ban) theo kiểu email