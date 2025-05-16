const express = require("express");

const shortVideoRouter = express.Router();

const shortVideoController = require("../controllers/shortVideoController");

shortVideoRouter.get("/get-all-short-videos", shortVideoController.getAllShortVideos);

shortVideoRouter.get("/get-all-short-videos-for-channel/:channelId", shortVideoController.getAllShortVideosForChannel);

shortVideoRouter.get("/get-all-short-videos-for-user/:userId", shortVideoController.getAllShortVideosForUser);

shortVideoRouter.post("/create-short-video", shortVideoController.createShortVideo);

module.exports = shortVideoRouter;