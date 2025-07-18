const Search = require("../models/search");
const Channel = require("../models/user/channel");
const Video = require("../models/content/video");
const Blog = require("../models/content/blog");
const ShortVideo = require("../models/content/shortVideo");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const getListOfSearchSuggestions = asyncHandler(async (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ message: "Keyword is required." });
  }

  const regex = new RegExp(keyword, "i");

  const [videoResults, shortVideoResults, channelResults, blogResults] =
    await Promise.all([
      Video.find({ title: regex, isPrivate: false })
        .sort({
          views: -1,
          commentTotal: -1,
          "statusTotal.like": -1,
        })
        .limit(10)
        .select("title views commentTotal statusTotal"),

      ShortVideo.find({ title: regex, isPrivate: false })
        .sort({
          views: -1,
          commentTotal: -1,
          "statusTotal.like": -1,
        })
        .limit(10)
        .select("title views commentTotal statusTotal"),

      Channel.find({ nameChannel: regex })
        .sort({ subscribersCount: -1 })
        .limit(10)
        .select("nameChannel subscribersCount"),

      Blog.find({ title: regex, isPrivate: false })
        .sort({
          commentTotal: -1,
          "statusTotal.like": -1,
        })
        .limit(10)
        .select("title commentTotal statusTotal"),
    ]);

  // Gán nhãn type cho từng loại kết quả
  const formattedResults = [
    ...videoResults.map((item) => ({
      type: "Video",
      keyword: item.title,
    })),
    ...shortVideoResults.map((item) => ({
      type: "ShortVideo",
      keyword: item.title,
    })),
    ...channelResults.map((item) => ({
      type: "Channel",
      keyword: item.nameChannel,
    })),
    ...blogResults.map((item) => ({
      type: "Blog",
      keyword: item.title,
    })),
  ];

  // Loại bỏ trùng lặp theo `keyword`
  const uniqueResults = [];
  const seen = new Set();

  for (const item of formattedResults) {
    const key = item.keyword.toLowerCase();
    if (!seen.has(key)) {
      uniqueResults.push(item);
      seen.add(key);
    }
    if (uniqueResults.length >= 10) break;
  }

  res.json({ suggestions: uniqueResults });
});

const buildLooseRegex = (keyword) => {
  const cleaned = keyword.toLowerCase().replace(/[^a-z0-9]/gi, "");
  return new RegExp(
    cleaned
      .split("")
      .map((c) => `${c}[^a-zA-Z0-9]*`)
      .join(""),
    "i"
  );
};

const getSearchResults = asyncHandler(async (req, res) => {
  const { keyword, page = 1 } = req.query;

  if (!keyword) {
    return res.status(400).json({ message: "Keyword is required." });
  }

  // === Ghi lịch sử tìm kiếm ===
  try {
    await Search.create({
      keyword: keyword.trim(),
      userId: req.user?._id || null,
    });
  } catch (err) {
    console.error("Failed to save search history:", err.message);
  }

  // === Chuẩn hóa keyword ===
  const looseRegex = buildLooseRegex(keyword);
  const perPage = 5;
  const skip = (parseInt(page) - 1) * perPage;

  // === Truy vấn dữ liệu ===
  const [videos, shorts, channels, blogs] = await Promise.all([
    Video.find({ title: { $regex: looseRegex }, isPrivate: false })
      .sort({ views: -1, commentTotal: -1, "statusTotal.like": -1 })
      .select("-violationStatus -reportReviewCount -reportCount -isBanned")
      .populate("uploader", "nameChannel avatarChannel subscribersCount")
      .lean(),

    ShortVideo.find({ title: { $regex: looseRegex }, isPrivate: false })
      .sort({ views: -1, commentTotal: -1, "statusTotal.like": -1 })
      .select("-violationStatus -reportReviewCount -reportCount -isBanned")
      .populate("uploader", "nameChannel avatarChannel subscribersCount")
      .lean(),

    Channel.find({ nameChannel: { $regex: looseRegex } })
      .sort({ subscribersCount: -1 })
      .select("-violationStatus -reportCount")
      .lean(),

    Blog.find({ title: { $regex: looseRegex }, isPrivate: false })
      .sort({ commentTotal: -1, "statusTotal.like": -1 })
      .select("-violationStatus -reportReviewCount -reportCount -isBanned")
      .populate("author", "nameChannel avatarChannel subscribersCount")
      .lean(),
  ]);

  // === Lấy 2 video top mỗi channel ===
  const channelsWithVideos = await Promise.all(
    channels.map(async (channel) => {
      const topVideos = await Video.find({
        uploader: channel._id,
        isPrivate: false,
      })
        .sort({ views: -1 })
        .limit(2)
        .select("-violationStatus -reportReviewCount -reportCount -isBanned")
        .populate("uploader", "nameChannel avatarChannel description subscribersCount")
        .lean();

      return {
        ...channel,
        topVideos,
      };
    })
  );

  // === Trộn + tính độ phù hợp ===
  const sanitizeString = (str) => str.toLowerCase().replace(/[^a-z0-9]/gi, "");
  const normalizedKeyword = sanitizeString(keyword);

  const allResults = [
    ...videos.map((item) => ({ type: "Video", data: item })),
    ...channelsWithVideos.map((item) => ({ type: "Channel", data: item })),
    ...blogs.map((item) => ({ type: "Blog", data: item })),
    ...shorts.map((item) => ({ type: "ShortVideo", data: item })),
  ];

  const scoredResults = allResults.map((item) => {
    const source =
      item.type === "Channel" ? item.data.nameChannel : item.data.title || "";
    const score = sanitizeString(source).includes(normalizedKeyword) ? 1 : 0;
    return { ...item, score };
  });

  scoredResults.sort((a, b) => b.score - a.score);
  const paginated = scoredResults.slice(skip, skip + perPage);

  const hasMore = skip + paginated.length < scoredResults.length;

  // === Lấy channelId nếu user đăng nhập ===
  let currentUserChannelId = null;
  if (req.user?._id) {
    const myChannel = await Channel.findOne({ owner: req.user._id }).select("_id");
    if (myChannel) {
      currentUserChannelId = myChannel._id;
    }
  }

  // === Trả về kết quả ===
  res.json({
    results: paginated,
    total: scoredResults.length,
    currentPage: parseInt(page),
    totalPages: Math.ceil(scoredResults.length / perPage),
    hasMore,
    channelId: currentUserChannelId, // ✅ Thêm channelId tại đây
  });
});

module.exports = {
  getListOfSearchSuggestions,
  getSearchResults,
};
