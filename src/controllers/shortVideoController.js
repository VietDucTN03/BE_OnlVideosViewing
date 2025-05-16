const Channel = require("../models/channel");
const Video = require("../models/shortVideo");
const asyncHandler = require("express-async-handler");

// Lấy tất cả short videos trong DB
const getAllShortVideos = asyncHandler(async (req, res) => {
  try {
    const allShorts = await Video.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, shorts: allShorts });
  } catch (error) {
    console.error("❌ Lỗi khi lấy tất cả short videos:", error);
    res.status(500).json({ message: "Failed to fetch short videos" });
  }
});

// Lấy tất cả short videos theo channelId 
const getAllShortVideosForChannel = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  try {
    const shorts = await Video.find({
      uploader: channelId,
      isPrivate: false,
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, shorts });
  } catch (error) {
    console.error("❌ Lỗi khi lấy short videos theo channelId:", error);
    res.status(500).json({ message: "Failed to fetch channel short videos" });
  }
});

// Lấy tất cả short videos theo userId
const getAllShortVideosForUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    const shorts = await Video.find({ uploader: userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, shorts });
  } catch (error) {
    console.error("❌ Lỗi khi lấy short videos theo userId:", error);
    res.status(500).json({ message: "Failed to fetch user's short videos" });
  }
});

const createShortVideo = asyncHandler(async (req, res, next) => {
    const { title, description, thumbnailUrl, shortUrl, categories, playlists, duration, isPrivate, channelId } = req.body;

    if (!title || !description || !thumbnailUrl || !shortUrl || !categories || !channelId) {
        return res.status(400).json({ message: "Missing or invalid inputs" });
    }

    try {
        const shortVideo = await Video.create({
            uploader: channelId,
            thumbnail: thumbnailUrl,
            url: shortUrl,
            title,
            description,
            duration,
            category: categories,
            playList: playlists,
            isPrivate,
        });

        const channel = await Channel.findById(channelId);

        if (!channel) {
            return res.status(404).json({ message: "Channel not found" });
        }

        channel.videoTotal += 1;
        await channel.save();

        res.status(201).json({
            success: true,
            shortVideo
        });
    } catch (error) {
        console.error("❌ Lỗi khi tạo video short:", error);
        next(error);
    }
});

module.exports = { 
    getAllShortVideos,
    getAllShortVideosForChannel,
    getAllShortVideosForUser,
    createShortVideo 
};