const Channel = require("../../models/user/channel");
const ShortVideo = require("../../models/content/shortVideo");
const ShortVideoInteraction = require("../../models/userActivity/shortVideoInteraction");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const crypto = require("crypto");
const deleteFromCloudinary = require("../../utils/cloudinary/deleteFromCloudinary");

// Lấy 5 short video cho viewer (trừ Private) dành cho chưa Login.
const getShortVideoForViewing = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 5 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 1. Lấy danh sách video công khai
    const publicShortVideos = await ShortVideo.find({ isPrivate: false })
      .populate("uploader", "nameChannel")
      .select("-reportReviewCount -reportCount -violationStatus -isBanned")
      .lean();

    // console.log("publicShortVideos: ", publicShortVideos);

    // 2. Lọc các video theo 4 tiêu chí
    const highSub = [...publicShortVideos].sort(
      (a, b) =>
        (b.uploader?.subscribersCount || 0) -
        (a.uploader?.subscribersCount || 0)
    );
    const highViews = [...publicShortVideos].sort(
      (a, b) => (b.views || 0) - (a.views || 0)
    );
    const highLikes = [...publicShortVideos].sort((a, b) => {
      const likesA =
        a.status?.filter((s) => s.statusLike === true)?.length || 0;
      const likesB =
        b.status?.filter((s) => s.statusLike === true)?.length || 0;
      return likesB - likesA;
    });
    const highComments = [...publicShortVideos].sort(
      (a, b) => (b.commentTotal || 0) - (a.commentTotal || 0)
    );

    // 3. Chọn một số video hàng đầu từ từng tiêu chí (mỗi tiêu chí lấy 10 video hàng đầu)
    const topVideos = new Set(
      [
        ...highSub.slice(0, 10),
        ...highViews.slice(0, 10),
        ...highLikes.slice(0, 10),
        ...highComments.slice(0, 10),
      ].map((video) => video._id.toString())
    );

    // 4. Lọc lại danh sách theo ID duy nhất
    const selectedVideos = publicShortVideos.filter((video) =>
      topVideos.has(video._id.toString())
    );

    // 5. Shuffle (ngẫu nhiên)
    const shuffledVideos = selectedVideos.sort(() => 0.5 - Math.random());

    // 6. Phân trang
    const totalItems = shuffledVideos.length;
    const paginatedShorts = shuffledVideos.slice(skip, skip + limitNum);
    const hasMore = skip + limitNum < totalItems;

    res.status(200).json({
      success: true,
      shorts: paginatedShorts,
      totalItems,
      currentPage: pageNum,
      hasMore,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy short video ưu tiên:", error);
    res.status(500).json({ message: "Failed to fetch short videos" });
  }
});

const getAllShortVideosForChannel = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { page = 1, keyword = "", sort = "createdAtDesc" } = req.query;

  const pageNum = parseInt(page);
  const limit = 5;
  const skip = (pageNum - 1) * limit;

  if (!channelId) {
    return res.status(400).json({ message: "Thiếu channelId." });
  }

  const sortOptions = {
    createdAtDesc: { createdAt: -1 },
    createdAtAsc: { createdAt: 1 },
    viewsDesc: { views: -1 },
    likesDesc: { "statusTotal.like": -1 },
  };

  const sortCondition = sortOptions[sort] || sortOptions.createdAtDesc;

  const baseQuery = {
    uploader: channelId,
    isPrivate: false,
    isBanned: false,
  };

  let totalShorts = await ShortVideo.countDocuments(baseQuery);

  const query = { ...baseQuery };
  if (keyword) {
    query.$or = [{ title: { $regex: keyword, $options: "i" } }];
  }

  totalShorts = await ShortVideo.countDocuments(query);

  try {
    const filteredTotal = await ShortVideo.countDocuments(query);

    const shorts = await ShortVideo.find(query)
      .sort(sortCondition)
      .populate("uploader", "nameChannel avatarChannel")
      .select("-url -reportReviewCount -reportCount -violationStatus")
      .skip(skip)
      .limit(limit)
      .lean();

    const hasMore = skip + limit < filteredTotal;

    if (keyword && filteredTotal === 0) {
      return res.status(200).json({
        success: true,
        shorts: [],
        totalShorts: 0,
        page: 1,
        limit,
        hasMore: false,
        keyword,
        sort,
        message: `No shorts found matching the keyword "${keyword}".`,
      });
    }

    if (totalShorts === 0) {
      return res.status(200).json({
        success: true,
        shorts: [],
        totalShorts: 0,
        page: 1,
        limit,
        hasMore: false,
        keyword,
        sort,
        message: "Channel has no short video.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Get all short videos for channel successfully.",
      shorts,
      totalShorts: filteredTotal,
      page: pageNum,
      hasMore,
      keyword,
      sort,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy short videos theo channelId:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch channel short videos",
        error: error.message,
      });
  }
});

// Lấy tất cả short videos theo userId
const getAllShortVideosForUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, keyword = "", sort = "createdAtDesc" } = req.query;

  if (!userId) {
    return res.status(400).json({ message: "Thiếu userId." });
  }

  const pageNum = parseInt(page, 10);
  const limit = 5;
  const skip = (pageNum - 1) * limit;

  const sortOptions = {
    createdAtDesc: { createdAt: -1 },
    createdAtAsc: { createdAt: 1 },
    viewsDesc: { views: -1 },
    likesDesc: { "statusTotal.like": -1 },
    dislikesDesc: { "statusTotal.dislike": -1 },
    commentsDesc: { commentTotal: -1 },
  };

  const sortCondition = sortOptions[sort] || sortOptions.createdAtDesc;

  const baseQuery = {
    uploader: userId,
    isBanned: false,
  };

  let totalShorts = await ShortVideo.countDocuments(baseQuery);

  const query = { ...baseQuery };
  if (keyword) {
    query.$or = [{ title: { $regex: keyword, $options: "i" } }];
  }

  totalShorts = await ShortVideo.countDocuments(query);

  const totalPages = Math.ceil(totalShorts / limit);

  try {
    const filteredTotal = await ShortVideo.countDocuments(query);

    const shorts = await ShortVideo.find(query)
      .sort(sortCondition)
      .populate("uploader", "nameChannel avatarChannel")
      .select("-url -reportReviewCount -reportCount -violationStatus")
      .skip(skip)
      .limit(limit)
      .lean();

    const hasMore = skip + limit < filteredTotal;

    if (keyword && filteredTotal === 0) {
      return res.status(200).json({
        success: true,
        shorts: [],
        totalShorts: 0,
        totalPages: 0,
        page: 1,
        limit,
        hasMore: false,
        keyword,
        sort,
        message: `No shorts found matching the keyword "${keyword}".`,
      });
    }

    if (totalShorts === 0) {
      return res.status(200).json({
        success: true,
        shorts: [],
        totalShorts: 0,
        totalPages: 0,
        page: 1,
        limit,
        hasMore: false,
        keyword,
        sort,
        message: "User has no short video.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Get all short videos for user successfully.",
      shorts,
      totalShorts: filteredTotal,
      totalPages,
      limit,
      page: pageNum,
      hasMore,
      keyword,
      sort,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy short videos theo userId:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch user short videos",
        error: error.message,
      });
  }
});

const getRandomShortVideoId = asyncHandler(async (req, res) => {
  try {
    const { isLoggedIn, userId } = req.query;
    const loggedIn = isLoggedIn === "true";

    const allShortVideos = await ShortVideo.find({ isPrivate: false })
      .populate("uploader", "subscribers nameChannel")
      .select("-reportReviewCount -reportCount -violationStatus -isBanned")
      .lean();

    if (allShortVideos.length === 0) {
      return res.status(200).json({
        success: true,
        shortVideoId: null,
        isRandom: true,
        message: "There is no public video short.",
      });
    }

    let selectedShortVideos = [];

    if (loggedIn && userId) {
      const subscribedChannels = await Channel.find({ subscribers: userId })
        .select("_id")
        .lean();
      const subscribedIds = subscribedChannels.map((c) => c._id.toString());

      const fromSubscribed = allShortVideos.filter((video) =>
        subscribedIds.includes(video.uploader?._id?.toString())
      );

      const remainingVideos = allShortVideos.filter(
        (video) => !subscribedIds.includes(video.uploader?._id?.toString())
      );

      const sortedByPopularity = [...remainingVideos].sort((a, b) => {
        const viewsDiff = (b.views || 0) - (a.views || 0);
        if (viewsDiff !== 0) return viewsDiff;

        const likesA = a.status?.filter((s) => s.statusLike)?.length || 0;
        const likesB = b.status?.filter((s) => s.statusLike)?.length || 0;
        const likesDiff = likesB - likesA;
        if (likesDiff !== 0) return likesDiff;

        return (b.commentTotal || 0) - (a.commentTotal || 0);
      });

      selectedShortVideos = [...fromSubscribed, ...sortedByPopularity];
    } else {
      selectedShortVideos = [...allShortVideos].sort((a, b) => {
        const viewsDiff = (b.views || 0) - (a.views || 0);
        if (viewsDiff !== 0) return viewsDiff;

        const likesA = a.status?.filter((s) => s.statusLike)?.length || 0;
        const likesB = b.status?.filter((s) => s.statusLike)?.length || 0;
        const likesDiff = likesB - likesA;
        if (likesDiff !== 0) return likesDiff;

        return (b.commentTotal || 0) - (a.commentTotal || 0);
      });
    }

    const randomIndex = Math.floor(Math.random() * selectedShortVideos.length);
    const randomVideo = selectedShortVideos[randomIndex];

    if (!randomVideo) {
      return res.status(200).json({
        success: true,
        shortVideoId: null,
        isRandom: true,
        message: "Short videos are not found.",
      });
    }

    res.status(200).json({
      success: true,
      shortVideoId: randomVideo._id,
      isRandom: true,
      message: "Take a successful random video short.",
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy short video ngẫu nhiên:", error);
    res.status(500).json({ message: "Lỗi server khi lấy short video" });
  }
});

/**
 * Tạo chuỗi ngẫu nhiên ổn định (deterministic) từ seed
 * Giúp shuffle cố định giữa các lần phân trang.
 */
const deterministicShuffle = (ids, seed) => {
  return ids
    .map((id) => ({
      id,
      // SHA‑1 cho khoá sắp xếp giả‑ngẫu‑nhiên nhưng ổn định
      sortKey: crypto
        .createHash("sha1")
        .update(id + seed)
        .digest("hex"),
    }))
    .sort((a, b) => (a.sortKey > b.sortKey ? 1 : -1))
    .map((item) => item.id);
};

const getFilteredShortVideoIds = asyncHandler(async (req, res) => {
  const {
    shortVideoIdByParams,
    userId,
    isLoggedIn,
    shouldAppend = false,
    appendCount = 0,
  } = req.query;

  if (!shortVideoIdByParams) {
    return res.status(400).json({ message: "Thiếu shortVideoIdByParams" });
  }

  if (!mongoose.Types.ObjectId.isValid(shortVideoIdByParams)) {
    return res
      .status(400)
      .json({ message: "Shortvideoidbyparams is invalid." });
  }

  const loggedIn = isLoggedIn === "true";

  const referenceVideo = await ShortVideo.findOne({
    _id: shortVideoIdByParams,
    isPrivate: false,
  }).lean();

  if (!referenceVideo) {
    return res
      .status(404)
      .json({ message: "Shortvideoidbyparams does not exist or privacy." });
  }

  const [topCommented, topLiked, topViewed] = await Promise.all([
    ShortVideo.find({ isPrivate: false })
      .sort({ commentTotal: -1 })
      .limit(50)
      .select("_id"),
    ShortVideo.find({ isPrivate: false })
      .sort({ "statusTotal.like": -1 })
      .limit(50)
      .select("_id"),
    ShortVideo.find({ isPrivate: false })
      .sort({ views: -1 })
      .limit(50)
      .select("_id"),
  ]);

  const sameTagCatWithRef = await ShortVideo.find({
    isPrivate: false,
    _id: { $ne: referenceVideo._id },
    $or: [
      { tags: { $in: referenceVideo.tags } },
      { category: { $in: referenceVideo.category } },
    ],
  }).select("_id");

  let sameTagCatWithInteraction = [];
  let videosFromSubscribedChannels = [];

  if (loggedIn && userId && mongoose.Types.ObjectId.isValid(userId)) {
    const interactions = await ShortVideoInteraction.find({ userId }).select(
      "shortVideoId"
    );
    const interactionIds = interactions.map((i) => i.shortVideoId);

    if (interactionIds.length) {
      const interactedVideos = await ShortVideo.find({
        _id: { $in: interactionIds },
      }).select("tags category");

      const tagsOfUser = new Set();
      const catOfUser = new Set();
      interactedVideos.forEach((v) => {
        v.tags.forEach((t) => tagsOfUser.add(t));
        v.category.forEach((c) => catOfUser.add(c));
      });

      sameTagCatWithInteraction = await ShortVideo.find({
        isPrivate: false,
        _id: { $nin: interactionIds },
        $or: [
          { tags: { $in: [...tagsOfUser] } },
          { category: { $in: [...catOfUser] } },
        ],
      }).select("_id");
    }

    const userChannel = await Channel.findById(userId).select(
      "channelsSubscribed"
    );
    if (userChannel && userChannel.channelsSubscribed.length) {
      videosFromSubscribedChannels = await ShortVideo.find({
        isPrivate: false,
        uploader: { $in: userChannel.channelsSubscribed },
      }).select("_id");
    }
  }

  const allIds = [
    referenceVideo._id.toString(),
    ...topCommented.map((d) => d._id.toString()),
    ...topLiked.map((d) => d._id.toString()),
    ...topViewed.map((d) => d._id.toString()),
    ...sameTagCatWithRef.map((d) => d._id.toString()),
    ...sameTagCatWithInteraction.map((d) => d._id.toString()),
    ...videosFromSubscribedChannels.map((d) => d._id.toString()),
  ];

  const seen = new Set();
  const deduped = [];
  allIds.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      deduped.push(id);
    }
  });

  const seed = shortVideoIdByParams;
  const shuffled = [
    deduped[0],
    ...deterministicShuffle(deduped.slice(1), seed),
  ];

  const baseCount = 5;
  let shortVideoIds = [];

  if (shouldAppend === true || shouldAppend === "true") {
    const appendIndex = parseInt(appendCount);
    const count = baseCount + (appendIndex + 1) * 5;

    // ✅ Nếu đã lấy hết ID
    if (count >= shuffled.length) {
      return res.status(200).json({
        success: true,
        shortVideoIds: shuffled, // hoặc shuffled.slice(0, shuffled.length)
        totalItems: deduped.length,
        isEnd: true,
        message: "The short video is over.",
      });
    }

    shortVideoIds = shuffled.slice(0, count);
  } else {
    shortVideoIds = shuffled.slice(0, baseCount);
  }

  return res.status(200).json({
    success: true,
    shortVideoIds,
    totalItems: deduped.length,
    isEnd: false,
    message:
      shouldAppend === true || shouldAppend === "true"
        ? "Add a successful shortVideoIds."
        : "Get a successful shortVideoIds.",
  });
});

const getShortVideoInfo = asyncHandler(async (req, res) => {
  const { shortVideoId } = req.params;

  try {
    const shortVideo = await ShortVideo.findById(shortVideoId)
      .populate(
        "uploader",
        "nameChannel avatarChannel subscribers subscribersCount"
      )
      .select("-reportReviewCount -reportCount -violationStatus")
      .populate("playList", "titlePlaylist");

    if (!shortVideo) {
      return res.status(404).json({ message: "Short video not found" });
    }

    res.status(200).json({
      success: true,
      shortVideo,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy thông tin short video:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch short video information" });
  }
});

const createShortVideo = asyncHandler(async (req, res, next) => {
  const {
    title,
    description,
    thumbnailUrl,
    shortUrl,
    tags,
    categories,
    // playlists,
    duration,
    isPrivate,
    channelId,
  } = req.body;

  if (
    !title ||
    !description ||
    !thumbnailUrl ||
    !shortUrl ||
    !tags ||
    !categories ||
    !channelId
  ) {
    return res.status(400).json({ message: "Missing or invalid inputs" });
  }

  try {
    const shortVideo = await ShortVideo.create({
      uploader: channelId,
      thumbnail: thumbnailUrl,
      url: shortUrl,
      title,
      description,
      duration,
      tags,
      category: categories,
      // playList: playlists,
      isPrivate,
    });

    const channel = await Channel.findByIdAndUpdate(
      channelId,
      {
        $inc: {
          "contentTotal.shortVideos": 1,
          "contentTotal.total": 1,
        },
      },
      { new: true }
    );

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    res.status(201).json({
      success: true,
      message: "Short video created successfully.",
      shortVideo,
    });
  } catch (error) {
    console.error("❌ Lỗi khi tạo video short:", error);
    next(error);
  }
});

const updateShortVideoView = asyncHandler(async (req, res) => {
  const { shortVideoId, userId } = req.body;

  if (!shortVideoId || !userId) {
    return res.status(400).json({ message: "Thiếu shortVideoId hoặc userId" });
  }

  try {
    const now = Date.now();
    const THIRTY_SECONDS = 30 * 1000;

    const existingInteraction = await ShortVideoInteraction.findOne({
      userId,
      shortVideoId,
    });

    if (existingInteraction?.isWatchedToEnd) {
      const lastUpdated = new Date(existingInteraction.updatedAt).getTime();
      if (now - lastUpdated < THIRTY_SECONDS) {
        return res
          .status(200)
          .json({ message: "Watching recently, not increasing the view." });
      }
    }

    // Cập nhật hoặc tạo mới interaction: chỉ set isWatchedToEnd: true
    await ShortVideoInteraction.findOneAndUpdate(
      { userId, shortVideoId },
      {
        $set: { isWatchedToEnd: true },
        $setOnInsert: { isStatused: false, isCommented: false },
      },
      { upsert: true, new: true }
    );

    // Tăng view short video
    const shortVideo = await ShortVideo.findByIdAndUpdate(
      shortVideoId,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (shortVideo?.uploader) {
      await Channel.findByIdAndUpdate(shortVideo.uploader, {
        $inc: { viewTotal: 1 },
      });
    }

    res.status(200).json({
      message: "Increase the view successfully.",
      views: shortVideo?.views,
    });
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật short video view:", error);
    res
      .status(500)
      .json({ message: "Lỗi server khi cập nhật short video view" });
  }
});

const editShortVideo = asyncHandler(async (req, res) => {
  const { shortVideoId } = req.params;
  const { title, description, thumbnailUrl, tags, categories, isPrivate } =
    req.body;

  try {
    const shortVideo = await ShortVideo.findById(shortVideoId);

    if (!shortVideo) {
      return res.status(404).json({ message: "Short video not found" });
    }

    if (thumbnailUrl && thumbnailUrl !== shortVideo.thumbnail) {
      // Xóa thumbnail cũ khỏi Cloudinary
      await deleteFromCloudinary([shortVideo.thumbnail], "image");
      shortVideo.thumbnail = thumbnailUrl;
    }

    if (title !== undefined) shortVideo.title = title;
    if (description !== undefined) shortVideo.description = description;
    if (tags !== undefined) shortVideo.tags = tags;
    if (Array.isArray(categories)) shortVideo.category = categories;
    if (isPrivate !== undefined) shortVideo.isPrivate = isPrivate;

    await shortVideo.save();

    res.status(200).json({
      success: true,
      message: "Short video updated successfully.",
      updatedShortVideo: shortVideo,
    });
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật short video:", error);
    res.status(500).json({
      message: "Lỗi server khi cập nhật short video",
      error: error.message,
    });
  }
});

const deleteShortVideo = asyncHandler(async (req, res) => {
  const { shortVideoId } = req.params;

  try {
    const shortVideo = await ShortVideo.findById(shortVideoId);

    if (!shortVideo) {
      return res.status(404).json({ message: "Short video not found" });
    }

    await deleteFromCloudinary([shortVideo.url], "video");
    await deleteFromCloudinary([shortVideo.thumbnail], "image");

    const channelUpdate = await Channel.findByIdAndUpdate(
      shortVideo.uploader,
      {
        $inc: {
          "contentTotal.shortVideos": -1,
          "contentTotal.total": -1,
        },
      },
      { new: true }
    );

    if (!channelUpdate) {
      return res.status(404).json({ message: "No channel found to update." });
    }

    await shortVideo.deleteOne();

    res.status(200).json({
      message: `Short video with Title "${shortVideo.title}" deleted successfully.`,
      shortVideo,
    });
  } catch (error) {
    console.error("❌ Lỗi khi xóa short video:", error);
    res.status(500).json({
      message: "Lỗi server khi xóa short video",
      error: error.message,
    });
  }
});

module.exports = {
  // getAllShortVideos,
  getShortVideoForViewing,
  getAllShortVideosForChannel,
  getAllShortVideosForUser,
  getRandomShortVideoId,
  // getAllRandomShortVideoIDs,
  getFilteredShortVideoIds,
  getShortVideoInfo,
  createShortVideo,
  updateShortVideoView,
  editShortVideo,
  deleteShortVideo,
};
