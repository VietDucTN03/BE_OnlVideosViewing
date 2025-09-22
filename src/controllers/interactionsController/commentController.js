const Comment = require("../../models/interactions/comment");
const Channel = require("../../models/user/channel");
const Video = require("../../models/content/video");
const Blog = require("../../models/content/blog");
const ShortVideo = require("../../models/content/shortVideo");
const Notification = require("../../models/interactions/notification");
const asyncHandler = require("express-async-handler");
const { createNotification } = require("../interactionsController/notificationController");
const { io } = require("../../utils/socket.io/socket");
const mongoose = require("mongoose");

const getAllCommentByVideoId = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, sortBy = "date" } = req.query;

  if (!videoId) {
    return res.status(400).json({ message: "Missing videoId" });
  }

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(400).json({ message: "Invalid videoId format" });
  }

  const pageNum = parseInt(page);
  const limit = 10;
  const skip = (pageNum - 1) * limit;

  let sortCondition = { createdAt: -1 };

  if (sortBy === "like") {
    sortCondition = { "statusTotal.like": -1 };
  }

  const comments = await Comment.find({
    refId: videoId,
    refType: "Video",
    parentComment: null, // chỉ lấy comment gốc
  })
    .sort(sortCondition)
    .skip(skip)
    .limit(limit)
    .populate("postedBy", "nameChannel avatarChannel isPremium")
    .lean();

  // console.log("comments: ", comments);

  const totalComments = await Comment.countDocuments({
    refId: videoId,
    refType: "Video",
    parentComment: null,
  });

  const hasMore = skip + limit < totalComments;

  res.status(200).json({
    comments,
    totalComments,
    hasMore,
  });
});

const getAllCommentByBlogId = asyncHandler(async (req, res) => {
  const { blogId } = req.params;
  const { page = 1, sortBy = "date" } = req.query;

  if (!blogId) {
    return res.status(400).json({ message: "Missing blogId" });
  }

  if (!mongoose.Types.ObjectId.isValid(blogId)) {
    return res.status(400).json({ message: "Invalid blogId format" });
  }

  const pageNum = parseInt(page);
  const limit = 5;
  const skip = (pageNum - 1) * limit;

  let sortCondition = { createdAt: -1 };

  if (sortBy === "like") {
    sortCondition = { "statusTotal.like": -1 };
  }

  const comments = await Comment.find({
    refId: blogId,
    refType: "Blog",
    parentComment: null,
  })
    .sort(sortCondition)
    .skip(skip)
    .limit(limit)
    .populate("postedBy", "nameChannel avatarChannel isPremium")
    .lean();

  const totalComments = await Comment.countDocuments({
    refId: blogId,
    refType: "Blog",
    parentComment: null,
  });

  const hasMore = skip + limit < totalComments;

  res.status(200).json({ comments, totalComments, hasMore });
});

const getAllCommentByShortVideoId = asyncHandler(async (req, res) => {
  const { shortVideoId } = req.params;
  const { page = 1 } = req.query;

  if (!shortVideoId) {
    return res.status(400).json({ message: "Missing shortVideoId" });
  }

  if (!mongoose.Types.ObjectId.isValid(shortVideoId)) {
    return res.status(400).json({ message: "Invalid shortVideoId format" });
  }

  const pageNum = parseInt(page);
  const limit = 10;
  const skip = (pageNum - 1) * limit;

  const comments = await Comment.find({
    refId: shortVideoId,
    refType: "ShortVideo",
    parentComment: null, // chỉ lấy comment gốc
  })
    .sort({ createdAt: -1 }) // Mới nhất trước
    .skip(skip)
    .limit(limit)
    .populate("postedBy", "nameChannel avatarChannel isPremium")
    .lean();

  const totalComments = await Comment.countDocuments({
    refId: shortVideoId,
    refType: "ShortVideo",
    parentComment: null,
  });

  const hasMore = skip + limit < totalComments;

  res.status(200).json({
    comments,
    totalComments,
    hasMore,
  });
});

const getCommentRepliesByParentId = asyncHandler(async (req, res) => {
  const { parentCommentId } = req.params;
  const { page = 1 } = req.query;

  // console.log(parentCommentId);

  if (!parentCommentId) {
    return res.status(400).json({ message: "Missing parentCommentId" });
  }

  const allReplies = [];
  const queue = [{ id: parentCommentId, level: 0 }];

  while (queue.length > 0) {
    const { id: currentParentId, level } = queue.shift();

    const replies = await Comment.find({ parentComment: currentParentId })
      .populate("postedBy", "nameChannel avatarChannel isPremium")
      .populate({
        path: "parentComment",
        populate: {
          path: "postedBy",
          select: "nameChannel",
        },
      })
      .lean();

    for (const reply of replies) {
      reply.level = level + 1;
      allReplies.push(reply);
      queue.push({ id: reply._id.toString(), level: level + 1 });
    }
  }

  // Sort theo mới nhất
  // allReplies.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Sort theo cũ nhất
  allReplies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // Phân trang
  const pageNum = parseInt(page);
  const limit = pageNum === 1 ? 5 : 10;
  const skip = pageNum === 1 ? 0 : 5 + (pageNum - 2) * 10;
  const paginatedReplies = allReplies.slice(skip, skip + limit);

  res.status(200).json({
    replies: paginatedReplies,
    totalReplies: allReplies.length,
    hasMore: skip + limit < allReplies.length,
  });
});

//* Mô hình cây
// const getCommentRepliesByParentId = asyncHandler(async (req, res) => {
//   const { parentCommentId } = req.params;

//   if (!parentCommentId) {
//     return res.status(400).json({ message: "Missing parentCommentId" });
//   }

//   const getAllRepliesRecursive = async (parentId) => {
//     const directReplies = await Comment.find({ parentComment: parentId })
//       .sort({ createdAt: 1 })
//       .populate("postedBy", "nameChannel avatarChannel")
//       .lean();

//     for (let reply of directReplies) {
//       // Đệ quy lấy replies con của mỗi reply
//       reply.replies = await getAllRepliesRecursive(reply._id);
//     }

//     return directReplies;
//   };

//   const allReplies = await getAllRepliesRecursive(parentCommentId);

//   res.status(200).json({ replies: allReplies });
// });

const MAX_INDIVIDUAL_NOTIFICATIONS = 4;

const sendReplySummary = async ({
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

const postComment = asyncHandler(async (req, res) => {
  const { refId, refType, content, userId } = req.body;

  if (!refId || !refType || !content || !userId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  let refDoc;
  if (refType === "Video") {
    refDoc = await Video.findById(refId);
  } else if (refType === "Blog") {
    refDoc = await Blog.findById(refId);
  } else if (refType === "ShortVideo") {
    refDoc = await ShortVideo.findById(refId);
  } else {
    return res.status(400).json({ message: "Invalid refType" });
  }

  if (!refDoc) {
    return res.status(404).json({ message: `${refType} not found` });
  }

  const channelId = refDoc.uploader || refDoc.author;
  const sender = await Channel.findById(userId);
  if (!sender) {
    return res.status(404).json({ message: "Commenting user not found" });
  }

  const newComment = new Comment({
    refId,
    refType,
    content,
    postedBy: userId,
  });

  await newComment.save();
  const populatedComment = await newComment.populate(
    "postedBy",
    "nameChannel avatarChannel"
  );

  // * Tăng comment count
  await refDoc.constructor.findByIdAndUpdate(refId, {
    $inc: { commentTotal: 1 },
  });

  const updatedRefDoc = await refDoc.constructor.findById(refId);
  const commentCount = updatedRefDoc.commentTotal;

  if (userId.toString() !== channelId.toString()) {
    if (commentCount < MAX_INDIVIDUAL_NOTIFICATIONS) {
      await createNotification({
        receiverId: channelId,
        senderId: userId,
        senderName: sender.nameChannel,
        senderAvatar: sender.avatarChannel,
        type: "comment",
        message: `${sender.nameChannel} đã bình luận về ${refType.toLowerCase()} của bạn 💬`,
        detailContent: content,
        createdAt: new Date(),
      });

      io.to(channelId.toString()).emit(`comment-${refType.toLowerCase()}`, {
        receiverId: channelId,
        message: `${sender.nameChannel} đã bình luận về ${refType.toLowerCase()} của bạn 💬`,
      });
    } else {
      await sendReplySummary({
        receiverId: channelId,
        groupId: refId,
        type: "comment_summary",
        message: `Đã có ${commentCount} bình luận về ${refType.toLowerCase()} của bạn 💬`,
        counter: commentCount,
      });

      io.to(channelId.toString()).emit(`comment-${refType.toLowerCase()}`, {
        receiverId: channelId,
        message: `Đã có ${commentCount} bình luận về ${refType.toLowerCase()} của bạn 💬`,
      });
    }
  }

  res.status(201).json({
    message: "Comment posted successfully",
    comment: populatedComment,
  });
}); 

const replyComment = asyncHandler(async (req, res) => {
  const { refId, refType, parentCommentId, content, userId } = req.body;

  if (!refId || !refType || !parentCommentId || !content || !userId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const sender = await Channel.findById(userId);
  const parentComment = await Comment.findById(parentCommentId).populate(
    "postedBy",
    "nameChannel avatarChannel"
  );

  let refDoc;
  if (refType === "Video") {
    refDoc = await Video.findById(refId);
  } else if (refType === "Blog") {
    refDoc = await Blog.findById(refId);
  } else if (refType === "ShortVideo") {
    refDoc = await ShortVideo.findById(refId);
  } else {
    return res.status(400).json({ message: "Invalid refType" });
  }

  if (!sender || !parentComment || !refDoc) {
    return res
      .status(404)
      .json({ message: `User, comment, or ${refType} not found` });
  }

  const reply = new Comment({
    refId,
    refType,
    parentComment: parentCommentId,
    content,
    postedBy: userId,
  });

  await reply.save();

  const populatedReply = await Comment.findById(reply._id)
    .populate("postedBy", "nameChannel avatarChannel")
    .populate({
      path: "parentComment",
      populate: {
        path: "postedBy",
        select: "nameChannel",
      },
    });

  // * Tăng tổng comment trong nội dung
  await refDoc.constructor.findByIdAndUpdate(refId, { $inc: { commentTotal: 1 } });

  // * Tăng tổng reply trong comment cha
  await Comment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });

  const updatedComment = await refDoc.constructor.findById(refId);
  const totalComments = updatedComment.commentTotal;

  const parentOwnerId = String(parentComment.postedBy._id);
  const infoOwnerId = String(refDoc.uploader || refDoc.author);  // xử lý cho cả Video, ShortVideo, Blog
  const senderIdStr = userId.toString();

  // * Gửi thông báo cho người viết comment gốc
  if (parentOwnerId !== senderIdStr) {
    const replyCount = await Comment.countDocuments({
      parentComment: parentCommentId,
    });

    const existingReplySummary = await Notification.findOne({
      receiverId: parentOwnerId,
      type: "reply_summary",
      groupId: parentCommentId,
    });

    if (!existingReplySummary && replyCount < MAX_INDIVIDUAL_NOTIFICATIONS) {
      await createNotification({
        receiverId: parentOwnerId,
        senderId: userId,
        senderName: sender.nameChannel,
        senderAvatar: sender.avatarChannel,
        type: "reply",
        groupId: parentCommentId,
        message: `${sender.nameChannel} has responded to your comments 💬`,
        detailContent: content,
        createdAt: new Date(),
      });

      io.to(parentOwnerId.toString()).emit("reply-comment", {
        receiverId: parentOwnerId,
        message: `${sender.nameChannel} has responded to your comments 💬`,
      });
    } else {
      await sendReplySummary({
        receiverId: parentOwnerId,
        groupId: parentCommentId,
        type: "reply_summary",
        message: `There have been ${replyCount} feedback on your comments 💬`,
        counter: replyCount,
      });

      io.to(parentOwnerId.toString()).emit("reply-comment", {
        receiverId: parentOwnerId,
        message: `There have been ${replyCount} feedback on your comments 💬`,
      });
    }
  }

  // * Gửi thông báo cho chủ sở hữu nội dung (video, short video, blog)
  if (infoOwnerId !== senderIdStr) {
    const existingCommentSummary = await Notification.findOne({
      receiverId: infoOwnerId,
      type: "comment_summary",
      groupId: refId,
    });

    if (
      !existingCommentSummary &&
      totalComments < MAX_INDIVIDUAL_NOTIFICATIONS
    ) {
      await createNotification({
        receiverId: infoOwnerId,
        senderId: userId,
        senderName: sender.nameChannel,
        senderAvatar: sender.avatarChannel,
        type: "comment",
        groupId: refId,
        message: `${sender.nameChannel} đã bình luận về ${refType.toLowerCase()} của bạn 💬`,
        detailContent: content,
        createdAt: new Date(),
      });

      io.to(infoOwnerId.toString()).emit(`comment-${refType.toLowerCase()}`, {
        receiverId: infoOwnerId,
        message: `${sender.nameChannel} đã bình luận về ${refType.toLowerCase()} của bạn 💬`,
      });
    } else {
      await sendReplySummary({
        receiverId: infoOwnerId,
        groupId: refId,
        type: "comment_summary",
        message: `Đã có ${totalComments} bình luận về ${refType.toLowerCase()} của bạn 💬`,
        counter: totalComments,
      });

      io.to(infoOwnerId.toString()).emit(`comment-${refType.toLowerCase()}`, {
        receiverId: infoOwnerId,
        message: `Đã có ${totalComments} bình luận về ${refType.toLowerCase()} của bạn 💬`,
      });
    }
  }

  res.status(201).json({
    message: "Reply posted successfully",
    comment: populatedReply,
  });
});

module.exports = {
  getAllCommentByVideoId,
  getAllCommentByBlogId,
  getAllCommentByShortVideoId,
  getCommentRepliesByParentId,
  postComment,
  replyComment,
};
