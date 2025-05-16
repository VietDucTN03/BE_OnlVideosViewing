const Comment = require("../models/comment");
const Channel = require("../models/channel");
const Video = require("../models/video");
const Notification = require("../models/notification");
const asyncHandler = require("express-async-handler");
const { createNotification } = require("./notificationController");
const { io } = require("../utils/socket.io/socket");

const getAllCommentByVideoId = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({ message: "Missing videoId" });
  }

  const comments = await Comment.find({
    refId: videoId,
    refType: "Video",
    parentComment: null, // Chỉ lấy comment gốc
  })
    .sort({ createdAt: -1 }) // Mới nhất lên trước
    .populate("postedBy", "nameChannel avatarChannel") // Chỉ populate thông tin cần thiết
    .lean();

  res.status(200).json({ comments });
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
      .populate("postedBy", "nameChannel avatarChannel")
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
  const { videoId, content, userId } = req.body;

  if (!videoId || !content || !userId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const video = await Video.findById(videoId);
  const channelId = video.uploader;
  const sender = await Channel.findById(userId);
  if (!sender) {
    return res.status(404).json({ message: "Commenting user not found" });
  }

  const newComment = new Comment({
    refId: videoId,
    refType: "Video",
    content,
    postedBy: userId,
  });

  const populatedComment = await newComment.populate(
    "postedBy",
    "nameChannel avatarChannel"
  );

  console.log(populatedComment);

  await newComment.save();
  await Video.findByIdAndUpdate(videoId, { $inc: { commentTotal: 1 } });
  const updatedVideo = await Video.findById(videoId);
  const commentCount = updatedVideo.commentTotal;

  if (userId.toString() !== channelId.toString()) {
    if (commentCount < MAX_INDIVIDUAL_NOTIFICATIONS) {
      await createNotification({
        receiverId: channelId,
        senderId: userId,
        senderName: sender.nameChannel,
        senderAvatar: sender.avatarChannel,
        type: "comment",
        message: `${sender.nameChannel} đã bình luận về video của bạn 💬`,
        detailContent: `${content}`,
        createdAt: new Date(),
      });

      io.to(channelId.toString()).emit("comment-video", {
        receiverId: channelId,
        message: `${sender.nameChannel} đã bình luận về video của bạn 💬`,
      });
    } else {
      // const existingSummary = await Notification.findOne({
      //   receiverId: channelId,
      //   type: "comment_summary",
      //   groupId: videoId,
      // });

      // if (!existingSummary) {
      //   await sendReplySummary({
      //     receiverId: channelId,
      //     groupId: videoId,
      //     type: "comment_summary",
      //     message: `Đã có ${commentCount} bình luận về video của bạn 💬`,
      //     counter: commentCount,
      //   });

      //   io.to(channelId.toString()).emit("comment-video", {
      //     receiverId: channelId,
      //     message: `Đã có ${commentCount} bình luận về video của bạn 💬`,
      //   });
      // }

      await sendReplySummary({
        receiverId: channelId,
        groupId: videoId,
        type: "comment_summary",
        message: `Đã có ${commentCount} bình luận về video của bạn 💬`,
        counter: commentCount,
      });

      io.to(channelId.toString()).emit("comment-video", {
        receiverId: channelId,
        message: `Đã có ${commentCount} bình luận về video của bạn 💬`,
      });
    }
  }

  res.status(201).json({
    message: "Comment posted successfully",
    comment: populatedComment,
  });
});

const replyComment = asyncHandler(async (req, res) => {
  const { videoId, parentCommentId, content, userId } = req.body;

  if (!videoId || !parentCommentId || !content || !userId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const sender = await Channel.findById(userId);
  const parentComment = await Comment.findById(parentCommentId).populate(
    "postedBy",
    "nameChannel avatarChannel"
  );
  const video = await Video.findById(videoId);

  if (!sender || !parentComment || !video) {
    return res
      .status(404)
      .json({ message: "User, comment, or video not found" });
  }

  const reply = new Comment({
    refId: videoId,
    refType: "Video",
    parentComment: parentCommentId,
    content,
    postedBy: userId,
  });

  console.log(reply);

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

  console.log("populatedReply: ", populatedReply);

  await Video.findByIdAndUpdate(videoId, { $inc: { commentTotal: 1 } });
  await Comment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });

  const updatedVideo = await Video.findById(videoId);
  const totalComments = updatedVideo.commentTotal;

  const parentOwnerId = String(parentComment.postedBy._id);
  const videoOwnerId = String(video.uploader._id);
  const senderIdStr = userId.toString();

  // Gửi thông báo cho người viết comment gốc
  if (parentOwnerId !== senderIdStr) {
    const existingReplySummary = await Notification.findOne({
      receiverId: parentOwnerId,
      type: "reply_summary",
      groupId: parentCommentId,
    });

    const replyCount = await Comment.countDocuments({
      parentComment: parentCommentId,
    });

    if (!existingReplySummary && replyCount < MAX_INDIVIDUAL_NOTIFICATIONS) {
      await createNotification({
        receiverId: parentOwnerId,
        senderId: userId,
        senderName: sender.nameChannel,
        senderAvatar: sender.avatarChannel,
        type: "reply",
        groupId: parentCommentId,
        message: `${sender.nameChannel} đã phản hồi bình luận của bạn 💬`,
        detailContent: content,
        createdAt: new Date(),
      });

      io.to(parentOwnerId.toString()).emit("reply-comment", {
        receiverId: parentOwnerId,
        message: `${sender.nameChannel} đã phản hồi bình luận của bạn 💬`,
      });
    } else {
      await sendReplySummary({
        receiverId: parentOwnerId,
        groupId: parentCommentId,
        type: "reply_summary",
        message: `Đã có ${replyCount} phản hồi về bình luận của bạn 💬`,
        counter: replyCount,
      });

      io.to(parentOwnerId.toString()).emit("reply-comment", {
        receiverId: parentOwnerId,
        message: `Đã có ${replyCount} phản hồi về bình luận của bạn 💬`,
      });
    }
  }

  // Gửi thông báo cho chủ video
  if (videoOwnerId !== senderIdStr) {
    const existingCommentSummary = await Notification.findOne({
      receiverId: videoOwnerId,
      type: "comment_summary",
      groupId: videoId,
    });

    if (
      !existingCommentSummary &&
      totalComments < MAX_INDIVIDUAL_NOTIFICATIONS
    ) {
      await createNotification({
        receiverId: videoOwnerId,
        senderId: userId,
        senderName: sender.nameChannel,
        senderAvatar: sender.avatarChannel,
        type: "comment",
        groupId: videoId,
        message: `${sender.nameChannel} đã bình luận về video của bạn 💬`,
        detailContent: content,
        createdAt: new Date(),
      });

      io.to(videoOwnerId.toString()).emit("comment-video", {
        receiverId: videoOwnerId,
        message: `${sender.nameChannel} đã bình luận về video của bạn 💬`,
      });
    } else {
      await sendReplySummary({
        receiverId: videoOwnerId,
        groupId: videoId,
        type: "comment_summary",
        message: `Đã có ${totalComments} bình luận về video của bạn 💬`,
        counter: totalComments,
      });

      io.to(videoOwnerId.toString()).emit("comment-video", {
        receiverId: videoOwnerId,
        message: `Đã có ${totalComments} bình luận về video của bạn 💬`,
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
  getCommentRepliesByParentId,
  postComment,
  replyComment,
};
