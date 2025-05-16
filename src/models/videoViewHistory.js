const mongoose = require("mongoose");

const videoViewSubSchema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: true,
    },
    lastViewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const videoViewHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Channel",
    required: true,
    unique: true,
  },
  listVideoId: [videoViewSubSchema],
});

const VideoViewHistory = mongoose.model(
  "VideoViewHistory",
  videoViewHistorySchema
);

module.exports = VideoViewHistory;
