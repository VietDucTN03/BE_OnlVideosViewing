const Channel = require("../../models/user/channel");
const Video = require("../../models/content/video");
const Playlist = require("../../models/content/playlist");
const ReportReview = require("../../models/interactions/reportReview");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const deleteFromCloudinary = require("../../utils/cloudinary/deleteFromCloudinary");

const getVideoStats = asyncHandler(async (req, res) => {
  const totalVideos = await Video.countDocuments();
  const privateVideos = await Video.countDocuments({ isPrivate: true });
  const publicVideos = await Video.countDocuments({ isPrivate: false });

  res.status(200).json([
    { key: "total", value: totalVideos, title: "Total Videos" },
    { key: "public", value: publicVideos, title: "Public" },
    { key: "private", value: privateVideos, title: "Private" },
  ]);
});

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    sort = "createdAtDesc",
    keyword = "",
    visibilityStatus = "all",  // all | public | private
    banStatus = "all",         // all | banned | notBanned
    violationStatus = "all",   // all | normal | warning | banned
  } = req.query;

  const pageNum = parseInt(page);
  const limit = 10;
  const skip = (pageNum - 1) * limit;

  const sortOptions = {
    createdAtDesc: { createdAt: -1 },
    createdAtAsc: { createdAt: 1 },
    viewsDesc: { views: -1 },
    likesDesc: { "statusTotal.like": -1 },
    // dislikesDesc: { "statusTotal.dislike": -1 },
    commentsDesc: { commentTotal: -1 },
    reportReviewsDesc: { reportReviewCount: -1 },
  };

  const sortCondition = sortOptions[sort] || sortOptions.createdAtDesc;

  const query = {};

  // Search theo title hoặc nameChannel
  if (keyword) {
    const matchedChannels = await Channel.find({
      nameChannel: { $regex: keyword, $options: "i" },
    }).select("_id");

    query.$or = [
      { title: { $regex: keyword, $options: "i" } },
      { uploader: { $in: matchedChannels.map((c) => c._id) } },
    ];
  }

  // Filter theo visibilityStatus (hiển thị)
  if (visibilityStatus === "public") {
    query.isPrivate = false;
  } else if (visibilityStatus === "private") {
    query.isPrivate = true;
  }

  // Filter theo banStatus
  if (banStatus === "banned") {
    query.isBanned = true;
  } else if (banStatus === "notBanned") {
    query.isBanned = false;
  }

  // Filter theo violationStatus
  if (["normal", "warning", "banned"].includes(violationStatus)) {
    query.violationStatus = violationStatus;
  }

  const totalVideos = await Video.countDocuments(query);

  const videos = await Video.find(query)
    .populate({
      path: "uploader",
      select: "nameChannel avatarChannel",
    })
    .sort(sortCondition)
    .skip(skip)
    .limit(limit)
    .lean();

  const result = videos.map((video) => ({
    id: video._id,
    title: video.title,
    thumbnail: video.thumbnail,
    views: video.views,
    like: video.statusTotal?.like || 0,
    // dislike: video.statusTotal?.dislike || 0,
    commentTotal: video.commentTotal,
    reportReviewCount: video.reportReviewCount,
    isPrivate: video.isPrivate,
    violationStatus: video.violationStatus,
    isBanned: video.isBanned,
    createdAt: video.createdAt,
    channelName: video.uploader?.nameChannel || "Unknown",
    channelAvatar: video.uploader?.avatarChannel || "",
  }));

  res.status(200).json({
    videos: result,
    totalVideos,
    hasMore: skip + limit < totalVideos,
    page: pageNum,
    limit,
    keyword,
    visibilityStatus,
    banStatus,
    violationStatus,
    sort,
  });
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  // Kiểm tra ID hợp lệ
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(400).json({ message: "Invalid video ID" });
  }

  const video = await Video.findById(videoId)
    .populate({
      path: "uploader",
      select: "nameChannel avatarChannel subscribersCount violationStatus owner",
    })
    .lean();

  if (!video) {
    return res.status(404).json({ message: "Video not found" });
  }

  res.status(200).json({
    id: video._id,
    title: video.title,
    description: video.description,
    thumbnail: video.thumbnail,
    url: video.url,
    duration: video.duration,
    views: video.views,
    like: video.statusTotal?.like || 0,
    dislike: video.statusTotal?.dislike || 0,
    commentTotal: video.commentTotal,
    reportReviewCount: video.reportReviewCount,
    reportCount: video.reportCount,
    isPrivate: video.isPrivate,
    category: video.category,
    createdAt: video.createdAt,
    violationStatus: video.violationStatus,
    isBanned: video.isBanned,
    channelName: video.uploader?.nameChannel || "Unknown",
    channelAvatar: video.uploader?.avatarChannel || "",
    channelSubscribersCount: video.uploader?.subscribersCount || 0,
    channelViolationStatus: video.uploader?.violationStatus || "normal",
    channelOwner: video.uploader?.owner || false,
  });
});

const getReportsByVideoId = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { resolvedResult = "all", page = 1 } = req.query;

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(400).json({ message: "Invalid video ID" });
  }

  const pageNum = parseInt(page);
  const limit = 5;
  const skip = (pageNum - 1) * limit;

  // Tạo điều kiện truy vấn
  const query = {
    contentId: videoId,
    contentType: "Video",
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
      videoId,
      totalReports: 0,
      hasMore: false,
      page: pageNum,
      limit,
      resolvedResult: resolvedResult || "all",
      reports: [],
      message: "Không có report nào cho video này",
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
    videoId,
    totalReports,
    hasMore: skip + limit < totalReports,
    page: pageNum,
    limit,
    resolvedResult: resolvedResult || "all",
    reports: formattedReports,
  });
});

const deleteVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(400).json({ message: "Invalid video ID" });
  }

  const video = await Video.findById(videoId);
  if (!video) {
    return res.status(404).json({ message: "Video không tồn tại" });
  }

  await deleteFromCloudinary(video.url, "video");
  await deleteFromCloudinary([video.thumbnail], "image");

  // Gỡ video khỏi tất cả playlist chứa nó
  await Playlist.updateMany(
    { "videos.video": video._id },
    { $pull: { videos: { video: video._id } } }
  );

  // Cập nhật Channel: xoá video khỏi danh sách và giảm videoTotal
  await Channel.updateOne(
    { _id: video.uploader },
    {
      $pull: { videos: video._id },
      $inc: { videoTotal: -1 },
    }
  );

  await video.deleteOne();

  res.status(200).json({
    videoId: video._id,
    message: `Đã xóa video "${video.title}" thành công`,
  });
});

module.exports = {
  getVideoStats,
  getAllVideos,
  getVideoById,
  getReportsByVideoId,
  deleteVideoById,
};
