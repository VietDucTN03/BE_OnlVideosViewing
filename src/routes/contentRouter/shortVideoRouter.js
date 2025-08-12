const express = require("express");

const shortVideoRouter = express.Router();

const shortVideoController = require("../../controllers/contentController/shortVideoController");

// shortVideoRouter.get("/get-all-short-videos", shortVideoController.getAllShortVideos);

shortVideoRouter.get("/get-short-videos-for-viewing", shortVideoController.getShortVideoForViewing);

shortVideoRouter.get("/get-all-short-videos-for-channel/:channelId", shortVideoController.getAllShortVideosForChannel);

shortVideoRouter.get("/get-all-short-videos-for-user/:userId", shortVideoController.getAllShortVideosForUser);

shortVideoRouter.get("/get-random-short-video-id", shortVideoController.getRandomShortVideoId);

// shortVideoRouter.get("/get-all-random-short-video-ids", shortVideoController.getAllRandomShortVideoIDs);

shortVideoRouter.get("/get-filtered-short-video-ids", shortVideoController.getFilteredShortVideoIds);

shortVideoRouter.get("/get-short-video-info/:shortVideoId", shortVideoController.getShortVideoInfo);

shortVideoRouter.post("/create-short-video", shortVideoController.createShortVideo);

shortVideoRouter.put("/update-short-video-view", shortVideoController.updateShortVideoView);

shortVideoRouter.put("/edit-short-video/:shortVideoId", shortVideoController.editShortVideo);

shortVideoRouter.delete("/delete-short-video/:shortVideoId", shortVideoController.deleteShortVideo);

module.exports = shortVideoRouter;