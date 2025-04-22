const mongoose = require("mongoose");

const videoViewHistorySchema = new mongoose.Schema({
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Video",
    required: true,
  },
  channelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Channel",
    required: true,
  },
  lastViewedAt: {
    type: Date,
    default: Date.now,
  },
});

videoViewHistorySchema.index({ videoId: 1, channelId: 1 }, { unique: true });

const VideoViewHistory = mongoose.model(
  "VideoViewHistory",
  videoViewHistorySchema
);

module.exports = VideoViewHistory;
