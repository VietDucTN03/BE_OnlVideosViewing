const express = require("express");

const { uploadCloud } = require("../config/cloudinary.config");

const videoRouter = express.Router();

const videoController = require("../controllers/videoController");

// Upload Video 
videoRouter.post("/get-video", videoController.getVideo);

videoRouter.post("/get-list-video-sliced", videoController.getListVideoSliced);

videoRouter.get("/get-part", videoController.downloadVideoPart);

videoRouter.post("/upload-video", videoController.createVideo);

videoRouter.post("/generate-signature", videoController.generateSignature);

videoRouter.post("/delete-sliced-videos", videoController.deleteSlicedVideos);

videoRouter.post("/cleanup-folder", videoController.cleanupFolder);

// Get Video
videoRouter.get("/get-all-videos", videoController.getAllVideos);

videoRouter.get("/get-all-videos-of-channel/:channelId", videoController.getAllChannelVideos);

videoRouter.get("/get-all-videos-of-user/:userId", videoController.getAllUserVideos);

videoRouter.get("/get-video-info/:videoId", videoController.getVideoInfo);

videoRouter.post("/update-view", videoController.updateVideoView);

videoRouter.post("/combine-video", videoController.combineCloudVideosById);

videoRouter.get("/stream-video", videoController.videoStreaming);

videoRouter.delete("/delete-video/:videoId", videoController.deleteVideo);

module.exports = videoRouter;