const mongoose = require("mongoose");

const shortVideoInteractionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Channel",
    required: true,
  },
  shortVideoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ShortVideo",
    required: true,
  },
  isWatchedToEnd: {
    type: Boolean,
    // required: true,
    default: false,
  },
  isStatused: {
    type: Boolean,
    // required: true,
    default: false,
  },
  isCommented: {
    type: Boolean,
    // required: true,
    default: false,
  },
}, { timestamps: true });

shortVideoInteractionSchema.index({ userId: 1, shortVideoId: 1 }, { unique: true });

module.exports = mongoose.model("ShortVideoInteraction", shortVideoInteractionSchema);