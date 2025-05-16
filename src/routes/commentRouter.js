const express = require("express");

const commentRouter = express.Router();

const commentController = require("../controllers/commentController");

commentRouter.get("/get-all-comments-by-video-id/:videoId", commentController.getAllCommentByVideoId);

commentRouter.get("/get-comment-replies-by-parent-id/:parentCommentId", commentController.getCommentRepliesByParentId);

commentRouter.post("/post-comment", commentController.postComment);

commentRouter.post("/reply-comment", commentController.replyComment);

module.exports = commentRouter;