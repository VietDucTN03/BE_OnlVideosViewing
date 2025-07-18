const express = require("express");

const statusRouter = express.Router();

const statusController = require("../../controllers/interactionsController/statusController");

statusRouter.get("/get-all-status-by-video-id/:videoId", statusController.getAllStatusByVideoId);

statusRouter.get("/get-all-status-by-short-video-id/:shortVideoId", statusController.getAllStatusByShortVideoId);

statusRouter.get("/get-all-status-by-blog-id/:blogId", statusController.getAllStatusByBlogId);

// statusRouter.get("/get-all-status-by-comment-id/:commentId", statusController.getAllStatusByCommentId);

statusRouter.post("/interactions-status", statusController.interactionsStatus);

module.exports = statusRouter;