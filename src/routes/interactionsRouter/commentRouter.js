const express = require("express");

const commentRouter = express.Router();

const commentController = require("../../controllers/interactionsController/commentController");

commentRouter.get("/get-all-comments-by-video-id/:videoId", commentController.getAllCommentByVideoId);

commentRouter.get("/get-all-comments-by-blog-id/:blogId", commentController.getAllCommentByBlogId);

commentRouter.get("/get-all-comments-by-short-video-id/:shortVideoId", commentController.getAllCommentByShortVideoId);

commentRouter.get("/get-comment-replies-by-parent-id/:parentCommentId", commentController.getCommentRepliesByParentId);

commentRouter.post("/post-comment", commentController.postComment);

commentRouter.post("/reply-comment", commentController.replyComment);

module.exports = commentRouter;