const Status = require("../../models/interactions/status");
const Comment = require("../../models/interactions/comment");
const Channel = require("../../models/user/channel");
const Video = require("../../models/content/video");
const ShortVideo = require("../../models/content/shortVideo");
const Blog = require("../../models/content/blog");
const Notification = require("../../models/interactions/notification");
const asyncHandler = require("express-async-handler");
const { createNotification } = require("../interactionsController/notificationController");
const { io } = require("../../utils/socket.io/socket");
const mongoose = require("mongoose");

// const getAllStatusByVideoId = asyncHandler(async (req, res) => {
//   const { videoId } = req.params;

//   if (!mongoose.Types.ObjectId.isValid(videoId)) {
//     return res.status(400).json({ message: "Invalid videoId" });
//   }

//   const statuses = await Status.find({ refId: videoId, refType: "Video" });

//   const like = statuses.filter((s) => s.statusLike === true).length;
//   const dislike = statuses.filter((s) => s.statusLike === false).length;

//   res.status(200).json({ videoId, like, dislike });
// });

const getAllStatusByVideoId = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(400).json({ message: "Invalid videoId" });
  }

  const statusList = await Status.find({ refId: videoId, refType: "Video" })
    .select("_id postedBy statusLike")
    .populate({
      path: "postedBy",
      select: "nameChannel avatarChannel", // Chỉ lấy thông tin cơ bản của người đăng
    })
    .lean();

  const like = statusList.filter((s) => s.statusLike === true).length;
  const dislike = statusList.filter((s) => s.statusLike === false).length;

  res.status(200).json({
    videoId,
    like,
    dislike,
    statusList,
  });
});

const getAllStatusByShortVideoId = asyncHandler(async (req, res) => {
  const { shortVideoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(shortVideoId)) {
    return res.status(400).json({ message: "Invalid shortVideoId" });
  }

  const statusList = await Status.find({
    refId: shortVideoId,
    refType: "ShortVideo",
  })
    .select("_id postedBy statusLike")
    .populate({
      path: "postedBy",
      select: "nameChannel avatarChannel", // Chỉ lấy thông tin cơ bản của người đăng
    })
    .lean();

  const like = statusList.filter((s) => s.statusLike === true).length;
  const dislike = statusList.filter((s) => s.statusLike === false).length;

  res.status(200).json({
    shortVideoId,
    like,
    dislike,
    statusList,
  });
});

const getAllStatusByBlogId = asyncHandler(async (req, res) => {
  const { blogId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(blogId)) {
    return res.status(400).json({ message: "Invalid blogId" });
  }

  const statusList = await Status.find({ refId: blogId, refType: "Blog" })
    .select("_id postedBy statusLike")
    .populate({
      path: "postedBy",
      select: "nameChannel avatarChannel", // Chỉ lấy thông tin cơ bản của người đăng
    })
    .lean();

  const like = statusList.filter((s) => s.statusLike === true).length;
  const dislike = statusList.filter((s) => s.statusLike === false).length;

  res.status(200).json({ blogId, like, dislike, statusList });
});

// const getAllStatusByCommentId = asyncHandler(async (req, res) => {
//   const { commentId } = req.params;

//   if (!mongoose.Types.ObjectId.isValid(commentId)) {
//     return res.status(400).json({ message: "Invalid commentId" });
//   }

//   const statusList = await Status.find({ refId: commentId, refType: "Comment" })
//     .select("_id postedBy statusLike")
//     .populate({
//       path: "postedBy",
//       select: "nameChannel avatarChannel",
//     });

//   res.status(200).json({ commentId, statusList });
// });

// const getAllStatusByCommentId = asyncHandler(async (req, res) => {
//   const { commentId } = req.params;

//   if (!mongoose.Types.ObjectId.isValid(commentId)) {
//     return res.status(400).json({ message: "Invalid commentId" });
//   }

//   const statusList = await Status.find({ refId: commentId, refType: "Comment" })
//     .select("_id postedBy statusLike")
//     .populate({
//       path: "postedBy",
//       select: "nameChannel avatarChannel", // Chỉ lấy thông tin cơ bản của người đăng
//     });

//   const like = statusList.filter((s) => s.statusLike === true).length;
//   const dislike = statusList.filter((s) => s.statusLike === false).length;

//   res.status(200).json({
//     commentId,
//     like,
//     dislike,
//     statusList,
//   });
// });

const MAX_INDIVIDUAL_NOTIFICATIONS = 3;

const sendLikeSummary = async ({
  receiverId,
  groupId,
  message,
  type = "summary",
  counter = null,
}) => {
  const existingSummary = await Notification.findOne({
    receiverId,
    type,
    groupId,
  });

  if (!existingSummary) {
    await Notification.create({
      receiverId,
      type,
      groupId,
      message: message.replace("${counter}", counter || 1),
      counter: counter || 1,
      createdAt: new Date(),
    });
  } else {
    existingSummary.counter = counter || existingSummary.counter + 1;
    existingSummary.message = message.replace(
      "${counter}",
      existingSummary.counter
    );
    existingSummary.updatedAt = new Date();
    await existingSummary.save();
  }
};

const handleLikeNotification = async ({
  userId,
  refId,
  refType,
  statusTotal,
  targetUser,
}) => {
  if (targetUser._id.toString() === userId.toString()) return;

  const senderChannel = await Channel.findById(userId);
  const message = `${senderChannel.nameChannel} just release 👍 for your ${refType}! 👏`;

  if (statusTotal.like > MAX_INDIVIDUAL_NOTIFICATIONS) {
    await sendLikeSummary({
      receiverId: targetUser._id,
      groupId: refId,
      type: "like_summary",
      message: `Your ${refType} has attracted ${statusTotal.like} likes! 👏`,
      counter: statusTotal.like,
    });

    io.to(targetUser._id.toString()).emit(`status-${refType.toLowerCase()}`, {
      message: `Your ${refType} has attracted ${statusTotal.like} likes! 👏`,
    });
  } else {
    await createNotification({
      receiverId: targetUser._id,
      senderId: senderChannel._id,
      senderName: senderChannel.nameChannel,
      senderAvatar: senderChannel.avatarChannel,
      type: "like",
      message,
      detailContent: refId,
    });

    io.to(targetUser._id.toString()).emit(`status-${refType.toLowerCase()}`, {
      message,
    });
  }
};

const handleStatusChange = async ({ refId, refType, userId, statusLike }) => {
  const existingStatus = await Status.findOne({
    refId,
    refType,
    postedBy: userId,
  });
  let action = "";
  let oldStatus = null;

  if (!existingStatus) {
    await Status.create({ refId, refType, postedBy: userId, statusLike });
    action = "create";
  } else {
    if (existingStatus.statusLike === statusLike) {
      await Status.deleteOne({ _id: existingStatus._id });
      action = "cancel";
      oldStatus = statusLike;
    } else {
      oldStatus = existingStatus.statusLike;
      existingStatus.statusLike = statusLike;
      await existingStatus.save();
      action = "update";
    }
  }

  return { action, oldStatus };
};

const interactionsStatus = asyncHandler(async (req, res) => {
  const { refId, refType, statusLike, userId } = req.body;

  if (!userId) return res.status(401).json({ message: "Bạn cần đăng nhập." });
  if (!mongoose.Types.ObjectId.isValid(refId))
    return res.status(400).json({ message: "Invalid refId" });
  if (!["Video", "ShortVideo", "Blog", "Comment"].includes(refType))
    return res.status(400).json({ message: "Invalid refType" });

  const { action, oldStatus } = await handleStatusChange({
    refId,
    refType,
    userId,
    statusLike,
  });

  const Model =
    refType === "Video"
      ? Video
      : refType === "ShortVideo"
      ? ShortVideo
      : refType === "Blog"
      ? Blog
      : Comment;
  const field =
    refType === "Video"
      ? "uploader"
      : refType === "ShortVideo"
      ? "uploader"
      : refType === "Blog"
      ? "author"
      : "postedBy";

  const refDoc = await Model.findById(refId).populate(
    field,
    "nameChannel avatarChannel"
  );
  if (!refDoc)
    return res.status(404).json({ message: `${refType} does not exist.` });

  const statusList = await Status.find({ refId, refType });

  let statusTotal;

  if (refType === "Comment") {
    const likeIds = statusList
      .filter((s) => s.statusLike === true)
      .map((s) => s.postedBy);
    const dislikeIds = statusList
      .filter((s) => s.statusLike === false)
      .map((s) => s.postedBy);

    statusTotal = {
      like: likeIds.length,
      dislike: dislikeIds.length,
      likedBy: likeIds,
      dislikedBy: dislikeIds,
    };
  } else {
    statusTotal = {
      like: statusList.filter((s) => s.statusLike === true).length,
      dislike: statusList.filter((s) => s.statusLike === false).length,
    };
  }

  refDoc.statusTotal = statusTotal;
  await refDoc.save();

  io.to(refId.toString()).emit("statusTotal-update", {
    refId,
    refType,
    statusTotal,
  });

  const targetUser = refDoc[field];
  if (action === "create" && statusLike) {
    await handleLikeNotification({
      userId,
      refId,
      refType,
      statusTotal,
      targetUser,
    });
  }

  res.status(200).json({
    message: `Status ${refType} ${action} successfully.`,
    statusTotal,
    action,
  });
});

module.exports = {
  getAllStatusByVideoId,
  getAllStatusByShortVideoId,
  getAllStatusByBlogId,
  // getAllStatusByCommentId,
  interactionsStatus,
};
