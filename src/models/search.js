const mongoose = require("mongoose");

const searchHistorySchema = new mongoose.Schema({
  keyword: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SearchHistory", searchHistorySchema);
