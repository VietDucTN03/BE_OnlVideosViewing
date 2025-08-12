const express = require("express");

const videoRouter = express.Router();

const videoInformationController = require("../../controllers/contentController/videoController/videoInformationController");

const videoProcessingController = require("../../controllers/contentController/videoController/videoProcessingController");

//* Upload Video 
videoRouter.post("/get-video", videoProcessingController.getVideo);

videoRouter.post("/get-list-video-sliced", videoProcessingController.getListVideoSliced);

videoRouter.get("/get-part", videoProcessingController.downloadVideoPart);

videoRouter.post("/upload-video", videoProcessingController.createVideo);

videoRouter.post("/generate-signature", videoProcessingController.generateSignature);

videoRouter.post("/delete-sliced-videos", videoProcessingController.deleteSlicedVideos);

videoRouter.post("/cleanup-folder", videoProcessingController.cleanupFolder);

//* Viewing Video
videoRouter.post("/update-view", videoProcessingController.updateVideoView);

videoRouter.post("/combine-video", videoProcessingController.combineCloudVideosById);

videoRouter.get("/stream-video", videoProcessingController.videoStreaming);

//* Video Information
// videoRouter.get("/get-videos-for-viewing-no-login", videoInformationController.getVideosForViewingNoLogin);

videoRouter.get("/get-recommended-videos", videoInformationController.getRecommendedVideos);

videoRouter.get("/get-all-videos-of-channel/:channelId", videoInformationController.getAllChannelVideos);

videoRouter.get("/get-all-videos-of-user/:userId", videoInformationController.getAllUserVideos);

videoRouter.get("/get-related-videos/:videoId", videoInformationController.getRelatedVideos);

videoRouter.get("/get-video-info/:videoId", videoInformationController.getVideoInfo);

videoRouter.put("/edit-video/:videoId", videoInformationController.editVideo);

videoRouter.delete("/delete-video/:videoId", videoInformationController.deleteVideo);

module.exports = videoRouter;