const Channel = require("../../models/user/channel");
const ShortVideo = require("../../models/content/shortVideo");
const ShortVideoInteraction = require("../../models/userActivity/shortVideoInteraction");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const crypto = require("crypto");

// Lấy tất cả short videos trong DB (Admin)
const getAllShortVideos = asyncHandler(async (req, res) => {
  try {
    const allShorts = await ShortVideo.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, shorts: allShorts });
  } catch (error) {
    console.error("❌ Lỗi khi lấy tất cả short videos:", error);
    res.status(500).json({ message: "Failed to fetch short videos" });
  }
});

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

// Lấy tất cả short videos theo channelId
// const getAllShortVideosForChannel = asyncHandler(async (req, res) => {
//   const { channelId } = req.params;

//   try {
//     const shorts = await ShortVideo.find({
//       uploader: channelId,
//       isPrivate: false,
//     }).sort({ createdAt: -1 });

//     res.status(200).json({ success: true, shorts });
//   } catch (error) {
//     console.error("❌ Lỗi khi lấy short videos theo channelId:", error);
//     res.status(500).json({ message: "Failed to fetch channel short videos" });
//   }
// });

const getAllShortVideosForChannel = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const skip = (page - 1) * limit;

  if (!channelId) {
    return res.status(400).json({ message: "Thiếu channelId." });
  }

  const totalShorts = await ShortVideo.countDocuments({
    uploader: channelId,
    isPrivate: false,
  });

  const shorts = await ShortVideo.find({
    uploader: channelId,
    isPrivate: false,
  })
    .sort({ createdAt: -1 })
    .populate("uploader", "nameChannel avatarChannel")
    .select("-reportReviewCount -reportCount -violationStatus -isBanned")
    .skip(skip)
    .limit(limit);

  const hasMore = skip + shorts.length < totalShorts;

  if (totalShorts === 0) {
    return res.status(200).json({
      message: "Channel chưa có short video nào.",
      shorts: [],
      totalShorts,
      hasMore: false,
    });
  }

  if (shorts.length === 0) {
    return res.status(200).json({
      message: "Không còn short video nào để tải thêm.",
      shorts: [],
      totalShorts,
      hasMore: false,
    });
  }

  res.status(200).json({
    message: "Lấy short video công khai của channel thành công.",
    shorts,
    totalShorts,
    hasMore,
  });
});

// Lấy tất cả short videos theo userId
const getAllShortVideosForUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1 } = req.query;

  if (!userId) {
    return res.status(400).json({ message: "Thiếu userId." });
  }

  const pageNum = parseInt(page, 10);
  const limit = 5;
  const skip = (pageNum - 1) * limit;

  const totalShorts = await ShortVideo.countDocuments({ uploader: userId });

  const totalPages = Math.ceil(totalShorts / limit);

  const shorts = await ShortVideo.find({ uploader: userId })
    .select("-reportReviewCount -reportCount -violationStatus -isBanned")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const hasMore = skip + shorts.length < totalShorts;

  // Không có short video nào trong toàn bộ hệ thống
  if (totalShorts === 0) {
    return res.status(200).json({
      message: "Người dùng chưa có short video nào.",
      shorts: [],
      totalShorts,
      totalPages: 0,
      hasMore: false,
    });
  }

  if (shorts.length === 0) {
    return res.status(200).json({
      message: "Không còn short video nào của người dùng nào.",
      shorts: [],
      totalShorts,
      totalPages,
      hasMore: false,
    });
  }

  res.status(200).json({
    message: "Lấy short video của người dùng.",
    shorts,
    limit,
    totalShorts,
    totalPages,
    hasMore,
  });
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
        message: "Hiện chưa có short video công khai nào.",
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
        message: "Không tìm thấy short video phù hợp.",
      });
    }

    res.status(200).json({
      success: true,
      shortVideoId: randomVideo._id,
      isRandom: true,
      message: "Lấy short video ngẫu nhiên thành công.",
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy short video ngẫu nhiên:", error);
    res.status(500).json({ message: "Lỗi server khi lấy short video" });
  }
});

// const getAllRandomShortVideoIDs = asyncHandler(async (req, res) => {
//   try {
//     const { isLoggedIn, userId, page = 1, limit = 3 } = req.query;
//     const loggedIn = isLoggedIn === "true";
//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     const allShortVideos = await ShortVideo.find({ isPrivate: false })
//       .populate("uploader", "subscribers nameChannel")
//       .select("_id uploader views commentTotal status")
//       .lean();

//     if (allShortVideos.length === 0) {
//       return res.status(200).json({
//         success: true,
//         shortVideoIds: [],
//         message: "Hiện chưa có short video công khai nào.",
//         currentPage: pageNum,
//         totalItems: 0,
//         hasMore: false,
//       });
//     }

//     let selectedShortVideos = [];

//     if (loggedIn && userId) {
//       const subscribedChannels = await Channel.find({ subscribers: userId })
//         .select("_id")
//         .lean();

//       const subscribedIds = subscribedChannels.map((c) => c._id.toString());

//       const fromSubscribed = allShortVideos.filter((video) =>
//         subscribedIds.includes(video.uploader?._id?.toString())
//       );

//       const remainingVideos = allShortVideos.filter(
//         (video) => !subscribedIds.includes(video.uploader?._id?.toString())
//       );

//       const sortedByPopularity = [...remainingVideos].sort((a, b) => {
//         const viewsDiff = (b.views || 0) - (a.views || 0);
//         if (viewsDiff !== 0) return viewsDiff;

//         const likesA = a.status?.filter((s) => s.statusLike)?.length || 0;
//         const likesB = b.status?.filter((s) => s.statusLike)?.length || 0;
//         const likesDiff = likesB - likesA;
//         if (likesDiff !== 0) return likesDiff;

//         return (b.commentTotal || 0) - (a.commentTotal || 0);
//       });

//       selectedShortVideos = [...fromSubscribed, ...sortedByPopularity];
//     } else {
//       selectedShortVideos = [...allShortVideos].sort((a, b) => {
//         const viewsDiff = (b.views || 0) - (a.views || 0);
//         if (viewsDiff !== 0) return viewsDiff;

//         const likesA = a.status?.filter((s) => s.statusLike)?.length || 0;
//         const likesB = b.status?.filter((s) => s.statusLike)?.length || 0;
//         const likesDiff = likesB - likesA;
//         if (likesDiff !== 0) return likesDiff;

//         return (b.commentTotal || 0) - (a.commentTotal || 0);
//       });
//     }

//     // Pagination
//     const totalItems = selectedShortVideos.length;
//     const paginatedVideos = selectedShortVideos.slice(skip, skip + limitNum);
//     const shortVideoIds = paginatedVideos.map((video) => video._id);
//     const hasMore = skip + limitNum < totalItems;

//     return res.status(200).json({
//       success: true,
//       shortVideoIds,
//       message: "Lấy danh sách short video thành công.",
//       currentPage: pageNum,
//       totalItems,
//       hasMore,
//     });
//   } catch (error) {
//     console.error("❌ Lỗi khi lấy danh sách short video:", error);
//     res.status(500).json({ message: "Lỗi server khi lấy short video" });
//   }
// });

/**
 * Tạo chuỗi ngẫu nhiên ổn định (deterministic) từ seed
 * Giúp shuffle cố định giữa các lần phân trang.
 */
const deterministicShuffle = (ids, seed) => {
  return ids
    .map((id) => ({
      id,
      // SHA‑1 cho khoá sắp xếp giả‑ngẫu‑nhiên nhưng ổn định
      sortKey: crypto.createHash("sha1").update(id + seed).digest("hex"),
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
    return res.status(400).json({ message: "shortVideoIdByParams không hợp lệ" });
  }

  const loggedIn = isLoggedIn === "true";

  const referenceVideo = await ShortVideo.findOne({
    _id: shortVideoIdByParams,
    isPrivate: false,
  }).lean();

  if (!referenceVideo) {
    return res.status(404).json({ message: "shortVideoIdByParams không tồn tại hoặc riêng tư" });
  }

  const [topCommented, topLiked, topViewed] = await Promise.all([
    ShortVideo.find({ isPrivate: false }).sort({ commentTotal: -1 }).limit(50).select("_id"),
    ShortVideo.find({ isPrivate: false }).sort({ "statusTotal.like": -1 }).limit(50).select("_id"),
    ShortVideo.find({ isPrivate: false }).sort({ views: -1 }).limit(50).select("_id"),
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
    const interactions = await ShortVideoInteraction.find({ userId }).select("shortVideoId");
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

    const userChannel = await Channel.findById(userId).select("channelsSubscribed");
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
        message: "Đã hết short video",
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
        ? "Thêm shortVideoIds thành công"
        : "Tải lại shortVideoIds mới thành công",
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
    playlists,
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
          .json({ message: "Đã xem gần đây, không tăng view" });
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
      message: "Tăng view thành công",
      views: shortVideo?.views,
    });
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật short video view:", error);
    res
      .status(500)
      .json({ message: "Lỗi server khi cập nhật short video view" });
  }
});

module.exports = {
  getAllShortVideos,
  getShortVideoForViewing,
  getAllShortVideosForChannel,
  getAllShortVideosForUser,
  getRandomShortVideoId,
  // getAllRandomShortVideoIDs,
  getFilteredShortVideoIds,
  getShortVideoInfo,
  createShortVideo,
  updateShortVideoView,
};
