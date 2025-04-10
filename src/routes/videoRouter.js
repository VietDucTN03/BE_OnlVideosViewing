const express = require("express");

const { uploadCloud } = require("../config/cloudinary.config");

const videoRouter = express.Router();

const videoController = require("../controllers/videoController");

videoRouter.post("/get-video", videoController.getVideo);

videoRouter.post("/get-list-video-sliced", videoController.getListVideoSliced);

videoRouter.get("/get-part", videoController.downloadVideoPart);

videoRouter.post("/upload-video", videoController.createVideo);

videoRouter.post("/generate-signature", videoController.generateSignature);

videoRouter.post("/delete-sliced-videos", videoController.deleteSlicedVideos);

videoRouter.post("/cleanup-folder", videoController.cleanupFolder);

module.exports = videoRouter;