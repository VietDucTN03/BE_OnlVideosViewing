const Channel = require("../../models/user/channel");
const User = require("../../models/user/user");
const Video = require("../../models/content/video");
const Blog = require("../../models/content/blog");
const ShortVideo = require("../../models/content/shortVideo");
const Comment = require("../../models/interactions/comment");
const ReportReview = require("../../models/interactions/reportReview");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const sendMail = require("../../utils/sendMail/sendMail");

//* GET
const getAccountSummary = asyncHandler(async (req, res) => {
  const totalAccounts = await Channel.countDocuments();
  const normalAccounts = await Channel.countDocuments({
    violationStatus: "normal",
  });
  const warningAccounts = await Channel.countDocuments({
    violationStatus: "warning",
  });
  const bannedAccounts = await Channel.countDocuments({
    violationStatus: "banned",
  });

  res.status(200).json([
    { key: "total", value: totalAccounts, title: "Total Accounts" },
    { key: "normal", value: normalAccounts, title: "Normal" },
    { key: "warning", value: warningAccounts, title: "Warning" },
    { key: "banned", value: bannedAccounts, title: "Banned" },
  ]);
});

const getAllAccounts = asyncHandler(async (req, res) => {
  const { page = 1, sort = "createdAtDesc", status, keyword = "" } = req.query;

  const pageNum = parseInt(page);
  const limit = 2;
  const skip = (pageNum - 1) * limit;

  const sortOptions = {
    createdAtDesc: { createdAt: -1 },
    createdAtAsc: { createdAt: 1 },
    contentTotalDesc: { "contentTotal.total": -1 },
    viewTotalDesc: { viewTotal: -1 },
    reportCountDesc: { reportCount: -1 },
  };

  const sortCondition = sortOptions[sort] || sortOptions.createdAtDesc;

  const query = {};

  let totalAccounts = await Channel.countDocuments(query);

  if (keyword) {
    query.nameChannel = { $regex: keyword, $options: "i" };  // case-insensitive
  }

  if (["normal", "warning", "banned"].includes(status)) {
    query.violationStatus = status;
  }

  totalAccounts = await Channel.countDocuments(query);

  const totalPages = Math.ceil(totalAccounts / limit);

  try {
    const filteredTotal = await Channel.countDocuments(query);

    const channels = await Channel.find(query)
      .populate({
        path: "owner",
        select: "email typeLogin isBlocked",
      })
      .sort(sortCondition)
      .skip(skip)
      .limit(limit)
      .lean();

    const accounts = channels.map((channel) => ({
      id: channel._id,
      avatarChannel: channel.avatarChannel,
      nameChannel: channel.nameChannel,
      ownerId: channel.owner?._id,
      email: channel.owner?.email || "N/A",
      typeLogin: channel.owner?.typeLogin || "local",
      isBlocked: channel.owner?.isBlocked ?? false,
      violationStatus: channel.violationStatus,
      createdAt: channel.createdAt,
      contentTotal: channel.contentTotal.total,
      videoTotal: channel.contentTotal.videos,
      blogTotal: channel.contentTotal.blogs,
      shortVideoTotal: channel.contentTotal.shortVideos,
      viewTotal: channel.viewTotal,
      reportCount: channel.reportCount,
    }));

    const hasMore = skip + limit < totalAccounts;

    if (filteredTotal === 0 && keyword) {
      return res.status(200).json({
        accounts: [],
        totalAccounts,
        totalPages,
        hasMore: false,
        page: pageNum,
        limit,
        keyword,
        status: status || "all",
        message: `No accounts found matching the keyword "${keyword}".`,
      });
    }

    if (totalAccounts === 0) {
      return res.status(200).json({
        accounts: [],
        totalAccounts,
        totalPages,
        hasMore: false,
        page: pageNum,
        limit,
        keyword,
        status: status || "all",
        message: "No accounts found.",
      });
    }

    res.status(200).json({
      accounts,
      totalAccounts,
      totalPages,
      hasMore,
      page: pageNum,
      limit,
      keyword,
      status: status || "all",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

const getAccountDetailByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const user = await User.findById(userId).select("-avatar -createdAt");
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  // Find the corresponding channel (if any)
  const channel = await Channel.findOne({ owner: userId }).select(
    "-owner -bannerChannel -subscribers -channelsSubscribed"
  );
  if (!channel) {
    return res
      .status(404)
      .json({ message: "This user's channel was not found." });
  }

  res.status(200).json({
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      typeLogin: user.typeLogin,
      isBlocked: user.isBlocked,
      updatedAt: user.updatedAt,
      channel: channel,
    },
  });
});

const getAllVideosByChannelId = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const sortType = req.query.sort || "createdAtDesc";

  const sortOptions = {
    createdAtDesc: { createdAt: -1 },
    viewsDesc: { views: -1 },
    commentTotalDesc: { commentTotal: -1 },
    likeDesc: { "statusTotal.like": -1 },
    reportCountDesc: { reportCount: -1 },
  };

  const sort = sortOptions[sortType] || sortOptions.createdAtDesc;

  // Count total channel videos
  const totalVideos = await Video.countDocuments({ uploader: channelId });

  if (totalVideos === 0) {
    return res.status(200).json({
      message: "There are no videos.",
      videos: [],
      page,
      limit,
      totalVideos: 0,
      totalPages: 0,
      sort: sortType,
      hasMore: false,
    });
  }

  // Get videos by pagination and sort.
  const videos = await Video.find({ uploader: channelId })
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  const totalPages = Math.ceil(totalVideos / limit);

  res.status(200).json({
    videos,
    page,
    limit,
    totalVideos,
    totalPages,
    sort: sortType,
    hasMore: page < totalPages,
  });
});

const getAllShortVideosByChannelId = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const sortType = req.query.sort || "createdAtDesc";

  const sortOptions = {
    createdAtDesc: { createdAt: -1 },
    viewsDesc: { views: -1 },
    commentTotalDesc: { commentTotal: -1 },
    likeDesc: { "statusTotal.like": -1 },
    reportCountDesc: { reportCount: -1 },
  };

  const sort = sortOptions[sortType] || sortOptions.createdAtDesc;

  const totalShorts = await ShortVideo.countDocuments({ uploader: channelId });

  if (totalShorts === 0) {
    return res.status(200).json({
      message: "There are no short videos.",
      shorts: [],
      page,
      limit,
      totalShorts: 0,
      totalPages: 0,
      sort: sortType,
      hasMore: false,
    });
  }

  const shorts = await ShortVideo.find({ uploader: channelId })
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  const totalPages = Math.ceil(totalShorts / limit);

  res.status(200).json({
    shorts,
    page,
    limit,
    totalShorts,
    totalPages,
    sort: sortType,
    hasMore: page < totalPages,
  });
});

const getAllBlogsByChannelId = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const sortType = req.query.sort || "createdAtDesc";

  const sortOptions = {
    createdAtDesc: { createdAt: -1 },
    commentTotalDesc: { commentTotal: -1 },
    likeDesc: { "statusTotal.like": -1 },
    reportCountDesc: { reportCount: -1 },
  };

  const sort = sortOptions[sortType] || sortOptions.createdAtDesc;

  const totalBlogs = await Blog.countDocuments({ author: channelId });

  if (totalBlogs === 0) {
    return res.status(200).json({
      message: "There is no blog.",
      blogs: [],
      page,
      limit,
      totalBlogs: 0,
      totalPages: 0,
      sort: sortType,
      hasMore: false,
    });
  }

  const blogs = await Blog.find({ author: channelId })
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  const totalPages = Math.ceil(totalBlogs / limit);

  res.status(200).json({
    blogs,
    page,
    limit,
    totalBlogs,
    totalPages,
    sort: sortType,
    hasMore: page < totalPages,
  });
});

const getReportReviewsByChannel = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const {
    page = 1,
    contentType,
    status,
    sort = "newest",
    resolved
  } = req.query;

  if (!channelId || !mongoose.Types.ObjectId.isValid(channelId)) {
    return res.status(400).json({ message: "Invalid or missing channel id" });
  }

  const pageNum = parseInt(page);
  const limit = 5;
  const skip = (pageNum - 1) * limit;

  const query = {
    reportedChannel: channelId,
  };

  if (contentType && ["Video", "ShortVideo", "Blog"].includes(contentType)) {
    query.contentType = contentType;
  }

  if (status && ["valid", "invalid", "pending"].includes(status)) {
    query.resolvedResult = status;
  }

  if (resolved === "resolved") {
    query.isResolved = true;
  } else if (resolved === "unresolved") {
    query.isResolved = false;
  }

  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    // resolved: { isResolved: 1, createdAt: -1 },
  };
  const sortCondition = sortOptions[sort] || sortOptions.newest;

  const totalReports = await ReportReview.countDocuments(query);

  const reports = await ReportReview.find(query)
    .sort(sortCondition)
    .skip(skip)
    .limit(limit)
    .populate("reporters", "nameChannel avatarChannel")
    .lean();

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
  });
});

//* POST, PUT
const blockUserIfChannelBanned = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const channel = await Channel.findOne({ owner: userId });
  if (!channel) {
    return res.status(404).json({ message: "Không tìm thấy channel của user này." });
  }

  if (channel.violationStatus !== "banned") {
    console.log("Channel chưa bị banned. Không block user.");
    return res.status(400).json({ message: "Channel chưa bị banned. Không thể block user." });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "Không tìm thấy user." });
  }

  if (user.isBlocked) {
    console.log("User đã bị block từ trước.");
    return res.status(400).json({ message: "User đã bị block từ trước." });
  }

  user.isBlocked = true;
  await user.save();

  await sendMail({
    from: `"Admin Metube" <${process.env.EMAIL_NAME}>`,
    email: user.email,
    subject: "Your account has been locked",
    html: `
      <div style="max-width:600px;margin:auto;font-family:sans-serif;border-radius:8px;overflow:hidden;background:#f0fdfa;">
        <div style="background:linear-gradient(90deg,#14b8a6,#06b6d4);color:white;padding:24px;text-align:center;">
          <h2 style="margin:0;font-size:24px;">Metube</h2>
        </div>
        <div style="padding:24px;">
          <h3 style="color:#0f172a;margin-top:0;">Hello ${user.username},</h3>
          <p style="color:#334155;line-height:1.6;">
            We regret to inform you that your account has been 
            <b style="color:#b91c1c;">locked</b> because your channel violated our policies and has been <b>banned</b>.
          </p>
          <p style="color:#334155;line-height:1.6;">
            If you believe this is an error, please contact support for review.
          </p>
          <div style="text-align:center;margin:30px 0;">
            <a href="mailto:${process.env.EMAIL_NAME}" style="background:#14b8a6;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;">
              Contact support
            </a>
          </div>
          <p style="color:#64748b;font-size:14px;">
            Thank you for trusting and using our services.
          </p>
        </div>
        <div style="background:#e0f2fe;color:#334155;padding:18px;text-align:center;font-size:13px;">
          &copy; ${new Date().getFullYear()} Your Platform Name. All rights reserved.
        </div>
      </div>
    `,
  });

  console.log(`Blocked user ${user.username} and sent notification email.`);
  return res.status(200).json({ message: `Blocked user ${user.username} and sent notification email.` });
});

const unblockUserIfChannelUnbanned = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (!user.isBlocked) {
    return res.status(400).json({ message: "This user is not currently blocked." });
  }

  user.isBlocked = false;
  await user.save();

  const channel = await Channel.findOne({ owner: userId });
  if (channel) {
    if (channel.violationStatus === "banned") {
      channel.violationStatus = "warning";
      await channel.save();
    }
  }

  await sendMail({
    from: `"Admin Metube" <${process.env.EMAIL_NAME}>`,
    email: user.email,
    subject: "Your account has been unlocked",
    html: `
      <div style="max-width:600px;margin:auto;font-family:sans-serif;border-radius:8px;overflow:hidden;background:#ecfdf5;">
        <div style="background:linear-gradient(90deg,#22c55e,#10b981);color:white;padding:24px;text-align:center;">
          <h2 style="margin:0;font-size:24px;">Metube</h2>
        </div>
        <div style="padding:24px;">
          <h3 style="color:#0f172a;margin-top:0;">Xin chào ${user.username},</h3>
          <p style="color:#334155;line-height:1.6;">
            We would like to inform you that your account has been  
            <b style="color:#15803d;">unlocked</b> and you can continue to use our services.
          </p>
          <p style="color:#334155;line-height:1.6;">
            Thank you for your cooperation and compliance with community policies.
          </p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${process.env.CLIENT_URL}" style="background:#22c55e;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;">
              Sign in now
            </a>
          </div>
          <p style="color:#64748b;font-size:14px;">
            We hope you have a great experience on our platform.
          </p>
        </div>
        <div style="background:#d1fae5;color:#065f46;padding:18px;text-align:center;font-size:13px;">
          &copy; ${new Date().getFullYear()} Your Platform Name. All rights reserved.
        </div>
      </div>
    `,
  });

  console.log(`Unblocked user ${user.username} and sent notification email.`);
  return res.status(200).json({ message: `Unblocked user ${user.username} and sent notification email.` });
});

module.exports = {
  getAccountSummary,
  getAllAccounts,
  getAccountDetailByUserId,
  getAllVideosByChannelId,
  getAllShortVideosByChannelId,
  getAllBlogsByChannelId,
  getReportReviewsByChannel,
  blockUserIfChannelBanned,
  unblockUserIfChannelUnbanned,
};
