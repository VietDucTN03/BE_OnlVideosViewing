const Channel = require("../../models/user/channel");
const ShortVideo = require("../../models/content/shortVideo");
const ReportReview = require("../../models/interactions/reportReview");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const deleteFromCloudinary = require("../../utils/cloudinary/deleteFromCloudinary");

const getShortVideoStats = asyncHandler(async (req, res) => {
  const totalShorts = await ShortVideo.countDocuments();
  const privateShorts = await ShortVideo.countDocuments({ isPrivate: true });
  const publicShorts = await ShortVideo.countDocuments({ isPrivate: false });

  res.status(200).json([
    { key: "total", value: totalShorts, title: "Total Shorts" },
    { key: "public", value: publicShorts, title: "Public" },
    { key: "private", value: privateShorts, title: "Private" },
  ]);
});

const getAllShortVideos = asyncHandler(async (req, res) => {
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
    viewsDesc: { views: -1 },
    likesDesc: { "statusTotal.like": -1 },
    // dislikesDesc: { "statusTotal.dislike": -1 },
    commentsDesc: { commentTotal: -1 },
    reportReviewsDesc: { reportReviewCount: -1 },
  };

  const sortCondition = sortOptions[sort] || sortOptions.createdAtDesc;

  const query = {};

  //* Search theo title hoặc nameChannel
  if (keyword) {
    const matchedChannels = await Channel.find({
      nameChannel: { $regex: keyword, $options: "i" },
    }).select("_id");

    query.$or = [
      { title: { $regex: keyword, $options: "i" } },
      { uploader: { $in: matchedChannels.map((channel) => channel._id) } },
    ];
  }

  //* visibilityStatus
  if (["public", "private"].includes(visibilityStatus)) {
    if (visibilityStatus === "public") {
      query.isPrivate = false;
    } else if (visibilityStatus === "private") {
      query.isPrivate = true;
    }
  }

  //* banStatus
  if (["banned", "notBanned"].includes(banStatus)) {
    if (banStatus === "banned") {
      query.isBanned = true;
    } else if (banStatus === "notBanned") {
      query.isBanned = false;
    }
  }

  //* violationStatus
  if (["normal", "warning", "banned"].includes(violationStatus)) {
    query.violationStatus = violationStatus;
  }

  const totalShorts = await ShortVideo.countDocuments(query);

  const shorts = await ShortVideo.find(query)
    .populate({
      path: "uploader",
      select: "nameChannel avatarChannel",
    })
    .sort(sortCondition)
    .skip(skip)
    .limit(limit)
    .lean();

  const result = shorts.map((short) => ({
    id: short._id,
    title: short.title,
    thumbnail: short.thumbnail,
    views: short.views,
    like: short.statusTotal?.like || 0,
    // dislike: short.statusTotal?.dislike || 0,
    comments: short.commentTotal,
    reportReviews: short.reportReviewCount,
    isPrivate: short.isPrivate,
    violationStatus: short.violationStatus,
    isBanned: short.isBanned,
    createdAt: short.createdAt,
    channelName: short.uploader?.nameChannel || "",
    channelAvatar: short.uploader?.avatarChannel || "",
  }));

  res.status(200).json({
    shorts: result,
    totalShorts,
    hasMore: skip + limit < totalShorts,
    // page: pageNum,
    limit,
    sort,
    keyword,
    visibilityStatus,
    banStatus,
    violationStatus,
  });
});

const getShortVideoById = asyncHandler(async (req, res) => {
  const { shortVideoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(shortVideoId)) {
    return res.status(400).json({ message: "Invalid video ID" });
  }

  const short = await ShortVideo.findById(shortVideoId)
    .populate({
      path: "uploader",
      select:
        "nameChannel avatarChannel subscribersCount violationStatus owner",
    })
    .lean();

  if (!short) {
    return res.status(404).json({ message: "Video not found" });
  }

  res.status(200).json({
    id: short._id,
    title: short.title,
    description: short.description,
    thumbnail: short.thumbnail,
    url: short.url,
    tags: short.tags,
    category: short.category,
    duration: short.duration,
    views: short.views,
    like: short.statusTotal?.like || 0,
    // dislike: short.statusTotal?.dislike || 0,
    commentTotal: short.commentTotal,
    reportReviewCount: short.reportReviewCount,
    isPrivate: short.isPrivate,
    violationStatus: short.violationStatus,
    isBanned: short.isBanned,
    createdAt: short.createdAt,
    channelName: short.uploader?.nameChannel || "",
    channelAvatar: short.uploader?.avatarChannel || "",
    channelSubscribersCount: short.uploader?.subscribersCount || 0,
    channelViolationStatus: short.uploader?.violationStatus || "normal",
    channelOwner: short.uploader?.owner || false,
  });
});

const getReportsByShortVideoId = asyncHandler(async (req, res) => {
  const { shortVideoId } = req.params;
  const { resolvedResult = "all", page = 1 } = req.query;

  if (!mongoose.Types.ObjectId.isValid(shortVideoId)) {
    return res.status(400).json({ message: "Invalid short video ID" });
  }

  const pageNum = parseInt(page);
  const limit = 5;
  const skip = (pageNum - 1) * limit;

  // Tạo điều kiện truy vấn
  const query = {
    contentId: shortVideoId,
    contentType: "ShortVideo",
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
      shortVideoId,
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
    shortVideoId,
    totalReports,
    hasMore: skip + limit < totalReports,
    page: pageNum,
    limit,
    resolvedResult: resolvedResult || "all",
    reports: formattedReports,
  });
});

const deleteShortVideoById = asyncHandler(async (req, res) => {
  const { shortVideoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(shortVideoId)) {
    return res.status(400).json({ message: "Invalid short video ID" });
  }

  const short = await ShortVideo.findById(shortVideoId);

  if (!short) {
    return res.status(404).json({ message: "Short Video not found" });
  }

  await deleteFromCloudinary([short.url], "video");
  await deleteFromCloudinary([short.thumbnail], "image");

  // Gỡ video khỏi tất cả playlist chứa nó
  // await Playlist.updateMany(
  //   { "videos.video": short._id },
  //   { $pull: { videos: { video: short._id } } }
  // );

  // Cập nhật Channel: xoá video khỏi danh sách và giảm videoTotal
  //   await Channel.updateOne(
  //     { _id: short.uploader },
  //     {
  //       $pull: { videos: short._id },
  //       $inc: { videoTotal: -1 },
  //     }
  //   );

  await ShortVideo.findByIdAndDelete(shortVideoId);

  res
    .status(200)
    .json({ message: `Short Video "${short.title}" deleted successfully` });
});

module.exports = {
  getShortVideoStats,
  getAllShortVideos,
  getShortVideoById,
  getReportsByShortVideoId,
  deleteShortVideoById,
};
