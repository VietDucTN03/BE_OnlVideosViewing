const Video = require("../../../models/content/video");
const Channel = require("../../../models/user/channel");
const Playlist = require("../../../models/content/playlist");
const asyncHandler = require("express-async-handler");
const seedrandom = require("seedrandom");

const deleteFromCloudinary = require("../../../utils/cloudinary/deleteFromCloudinary");

// const getVideosForViewingNoLogin = asyncHandler(async (req, res) => {
//   try {
//     const videos = await Video.find({ isPrivate: false }).populate(
//       "uploader",
//       "nameChannel avatarChannel"
//     );

//     if (videos.length === 0) {
//       return res.status(404).json({ message: "Không có video công khai nào" });
//     }

//     // res.status(200).json({
//     //   success: true,
//     //   videos,
//     // });

//     // 2. Lọc các video theo 4 tiêu chí
//     const highSub = [...videos].sort(
//       (a, b) =>
//         (b.uploader?.subscribersCount || 0) -
//         (a.uploader?.subscribersCount || 0)
//     );
//     const highViews = [...videos].sort(
//       (a, b) => (b.views || 0) - (a.views || 0)
//     );
//     const highLikes = [...videos].sort((a, b) => {
//       const likesA =
//         a.status?.filter((s) => s.statusLike === true)?.length || 0;
//       const likesB =
//         b.status?.filter((s) => s.statusLike === true)?.length || 0;
//       return likesB - likesA;
//     });
//     const highComments = [...videos].sort(
//       (a, b) => (b.commentTotal || 0) - (a.commentTotal || 0)
//     );

//     // 3. Chọn một số video hàng đầu từ từng tiêu chí (mỗi tiêu chí lấy 10 video hàng đầu)
//     const topVideos = new Set(
//       [
//         ...highSub.slice(0, 10),
//         ...highViews.slice(0, 10),
//         ...highLikes.slice(0, 10),
//         ...highComments.slice(0, 10),
//       ].map((video) => video._id.toString())
//     );

//     // 4. Lọc lại danh sách theo ID duy nhất
//     const selectedVideos = videos.filter((video) =>
//       topVideos.has(video._id.toString())
//     );

//     // 5. Shuffle (ngẫu nhiên)
//     let shuffledVideos = selectedVideos.sort(() => 0.5 - Math.random());

//     if (shuffledVideos.length < 12) {
//       const remainingVideos = videos.filter(
//         (v) => !topVideos.has(v._id.toString())
//       );
//       const extraVideos = remainingVideos
//         .sort(() => 0.5 - Math.random())
//         .slice(0, 12 - shuffledVideos.length);
//       shuffledVideos = [...shuffledVideos, ...extraVideos];
//     }

//     // 6. Chỉ lấy 5 video đầu tiên sau khi random
//     const top12Videos = shuffledVideos.slice(0, 12);

//     res.status(200).json({
//       success: true,
//       videos: top12Videos,
//       totalItems: top12Videos.length,
//     });
//   } catch (err) {
//     console.error("Lỗi khi lấy danh sách video công khai:", err);
//     res
//       .status(500)
//       .json({ message: "Lỗi server khi lấy video", error: err.message });
//   }
// });

// const getVideosForViewingNoLogin = asyncHandler(async (req, res) => {
//   try {
//     const { page = 1, limit = 12 } = req.query;
//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     const videos = await Video.find({ isPrivate: false })
//       .populate("uploader", "nameChannel avatarChannel")
//       .select("-url -reportReviewCount -reportCount -violationStatus -isBanned")
//       .lean();

//     if (videos.length === 0) {
//       return res.status(200).json({
//         success: true,
//         videos: [],
//         totalItems: 0,
//         currentPage: pageNum,
//         hasMore: false,
//         message: "There is no public video.",
//       });
//     }

//     // 1. Lọc theo 4 tiêu chí
//     const highSub = [...videos].sort(
//       (a, b) =>
//         (b.uploader?.subscribersCount || 0) -
//         (a.uploader?.subscribersCount || 0)
//     );
//     const highViews = [...videos].sort(
//       (a, b) => (b.views || 0) - (a.views || 0)
//     );
//     const highLikes = [...videos].sort((a, b) => {
//       const likesA =
//         a.status?.filter((s) => s.statusLike === true)?.length || 0;
//       const likesB =
//         b.status?.filter((s) => s.statusLike === true)?.length || 0;
//       return likesB - likesA;
//     });
//     const highComments = [...videos].sort(
//       (a, b) => (b.commentTotal || 0) - (a.commentTotal || 0)
//     );

//     // 2. Lấy top 10 từ mỗi tiêu chí, kết hợp bằng Set để loại trùng
//     const topVideos = new Set(
//       [
//         ...highSub.slice(0, 10),
//         ...highViews.slice(0, 10),
//         ...highLikes.slice(0, 10),
//         ...highComments.slice(0, 10),
//       ].map((video) => video._id.toString())
//     );

//     // 3. Lọc danh sách cuối cùng
//     const selectedVideos = videos.filter((video) =>
//       topVideos.has(video._id.toString())
//     );

//     // 4. Thêm video ngẫu nhiên nếu thiếu
//     let shuffledVideos = selectedVideos.sort(() => 0.5 - Math.random());
//     if (shuffledVideos.length < limitNum) {
//       const remainingVideos = videos.filter(
//         (v) => !topVideos.has(v._id.toString())
//       );
//       const extraVideos = remainingVideos
//         .sort(() => 0.5 - Math.random())
//         .slice(0, limitNum - shuffledVideos.length);
//       shuffledVideos = [...shuffledVideos, ...extraVideos];
//     }

//     // 5. Phân trang thủ công
//     const totalItems = shuffledVideos.length;
//     const paginatedVideos = shuffledVideos.slice(skip, skip + limitNum);
//     const hasMore = skip + limitNum < totalItems;

//     res.status(200).json({
//       success: true,
//       videos: paginatedVideos,
//       totalItems,
//       currentPage: pageNum,
//       hasMore,
//     });
//   } catch (err) {
//     console.error("Lỗi khi lấy danh sách video công khai:", err);
//     res
//       .status(500)
//       .json({ message: "Lỗi server khi lấy video", error: err.message });
//   }
// });

const getRecommendedVideos = asyncHandler(async (req, res) => {
  try {
    const {
      isLoggedIn = false,
      userId = null,
      sortCategory = "all",
      page = 1,
      seed = null, // <-- seed nhận từ FE
    } = req.query;

    // console.log("seed: ", seed);

    const pageNum = parseInt(page);
    const limit = 9;
    const skip = (pageNum - 1) * limit;

    const baseQuery = {
      isPrivate: false,
      isBanned: false,
    };

    if (sortCategory && sortCategory !== "all") {
      baseQuery.category = { $in: [sortCategory] };
    }

    let videos = [];

    if (isLoggedIn === "true" && userId) {
      const userChannel = await Channel.findById(userId).lean();
      if (!userChannel) {
        return res.status(404).json({ message: "Channel not found." });
      }

      const subscribedIds = userChannel.channelsSubscribed || [];
      const priorityChannels = [...subscribedIds, userChannel._id];

      const priorityVideos = await Video.find({
        ...baseQuery,
        uploader: { $in: priorityChannels },
      })
        .populate("uploader", "nameChannel avatarChannel subscribersCount")
        .select(
          "-description -url -reportReviewCount -reportCount -violationStatus -isBanned"
        )
        .lean();

      const otherVideos = await Video.find({
        ...baseQuery,
        uploader: { $nin: priorityChannels },
      })
        .populate("uploader", "nameChannel avatarChannel subscribersCount")
        .select(
          "-description -url -reportReviewCount -reportCount -violationStatus -isBanned"
        )
        .lean();

      videos = [...priorityVideos, ...otherVideos];
    } else {
      videos = await Video.find(baseQuery)
        .populate("uploader", "nameChannel avatarChannel subscribersCount")
        .select(
          "-description -url -reportReviewCount -reportCount -violationStatus -isBanned"
        )
        .lean();
    }

    if (!videos.length) {
      return res.status(200).json({
        success: true,
        videos: [],
        totalItems: 0,
        currentPage: pageNum,
        hasMore: false,
        sortCategory,
        message: "There is no video to display.",
      });
    }

    // Tính toán top videos
    const highSub = [...videos].sort(
      (a, b) =>
        (b.uploader?.subscribersCount || 0) -
        (a.uploader?.subscribersCount || 0)
    );
    const highViews = [...videos].sort(
      (a, b) => (b.views || 0) - (a.views || 0)
    );
    const highComments = [...videos].sort(
      (a, b) => (b.commentTotal || 0) - (a.commentTotal || 0)
    );

    const topVideosSet = new Set(
      [
        ...highSub.slice(0, 10),
        ...highViews.slice(0, 10),
        ...highComments.slice(0, 10),
      ].map((video) => video._id.toString())
    );

    const selectedVideos = videos.filter((video) =>
      topVideosSet.has(video._id.toString())
    );

    const remainingVideos = videos.filter(
      (v) => !topVideosSet.has(v._id.toString())
    );

    // Shuffle phần còn lại theo seed
    const rng = seedrandom(seed || "default");

    const allVideos = [...videos].map((video) => {
      const isTop = topVideosSet.has(video._id.toString());
      return {
        video,
        sort: rng() + (isTop ? -0.5 : 0),
      };
    });

    const finalVideos = allVideos
      .sort((a, b) => a.sort - b.sort)
      .map(({ video }) => video);

    const totalItems = finalVideos.length;
    const paginatedVideos = finalVideos.slice(skip, skip + limit);
    const hasMore = skip + limit < totalItems;

    return res.status(200).json({
      success: true,
      message: "Get a list of video.",
      videos: paginatedVideos,
      totalItems,
      currentPage: pageNum,
      hasMore,
      sortCategory,
      seed: seed || Date.now().toString(),
    });
  } catch (err) {
    console.error("Lỗi khi lấy video:", err);
    res.status(500).json({
      message: "Lỗi server khi lấy video",
      error: err.message,
    });
  }
});

const getAllChannelVideos = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { page = 1, keyword = "", sort = "createdAtDesc" } = req.query;

  const pageNum = parseInt(page);
  const limit = 5;
  const skip = (pageNum - 1) * limit;

  if (!channelId) {
    return res.status(400).json({ message: "Missing channelId." });
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
    isBanned: false,
    isPrivate: false,
  };

  let totalPublicVideos = await Video.countDocuments(baseQuery);

  const query = { ...baseQuery };
  if (keyword) {
    query.$or = [{ title: { $regex: keyword, $options: "i" } }];
  }

  totalPublicVideos = await Video.countDocuments(query);

  try {
    const filteredTotal = await Video.countDocuments(query);

    const videos = await Video.find(query)
      .populate("uploader", "nameChannel avatarChannel")
      .select("-url -reportReviewCount -reportCount -violationStatus")
      .sort(sortCondition)
      .skip(skip)
      .limit(limit)
      .lean();

    const hasMore = skip + videos.length < filteredTotal;

    if (keyword && filteredTotal === 0) {
      return res.status(200).json({
        success: true,
        videos: [],
        totalVideos: 0,
        page: 1,
        limit,
        hasMore: false,
        keyword,
        sort,
        message: `No videos found matching the keyword "${keyword}".`,
      });
    }

    // if (videos.length === 0) {
    //   return res.status(200).json({
    //     success: true,
    //     videos: [],
    //     totalVideos: 0,
    //     page: 1,
    //     limit,
    //     hasMore: false,
    //     keyword,
    //     sort,
    //     message: "You've reached the end. No more videos to display.",
    //   });
    // }

    if (totalPublicVideos === 0) {
      return res.status(200).json({
        success: true,
        videos: [],
        totalVideos: 0,
        page: 1,
        limit,
        hasMore: false,
        keyword,
        sort,
        message: "This channel has no public videos yet.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Fetched channel videos successfully.",
      videos,
      totalVideos: filteredTotal,
      page: pageNum,
      hasMore,
      keyword,
      sort,
    });
  } catch (err) {
    console.error("❌ Error fetching public videos by channelId:", err);
    res.status(500).json({
      message: "Server error while fetching channel videos.",
      error: err.message,
    });
  }
});

const getAllUserVideos = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, keyword = "", sort = "createdAtDesc" } = req.query;

  if (!userId) {
    return res.status(400).json({ message: "Thiếu userId" });
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

  let totalVideos = await Video.countDocuments(baseQuery);

  const query = { ...baseQuery };
  if (keyword) {
    query.$or = [{ title: { $regex: keyword, $options: "i" } }];
  }

  totalVideos = await Video.countDocuments(query);

  const totalPages = Math.ceil(totalVideos / limit);

  try {
    const filteredTotal = await Video.countDocuments(query);

    const videos = await Video.find(query)
      // .sort({ createdAt: -1 })
      .populate("uploader", "nameChannel avatarChannel")
      .select("-url -reportReviewCount -reportCount -violationStatus")
      .sort(sortCondition)
      .skip(skip)
      .limit(limit)
      .lean();

    const hasMore = skip + limit < totalVideos;

    if (keyword && filteredTotal === 0) {
      return res.status(200).json({
        success: true,
        videos: [],
        page: 1,
        limit,
        totalVideos: 0,
        totalPages: 0,
        hasMore: false,
        keyword,
        sort,
        message: `No videos found matching the keyword "${keyword}".`,
      });
    }

    if (totalVideos === 0) {
      return res.status(200).json({
        message: "Users do not have any video.",
        videos: [],
        totalVideos,
        totalPages: 0,
        hasMore: false,
        page: 1,
        limit,
        keyword,
        sort,
      });
    }

    res.status(200).json({
      success: true,
      message: "Fetched channel videos successfully.",
      videos,
      page: pageNum,
      limit,
      totalVideos: filteredTotal,
      totalPages,
      hasMore,
      keyword,
      sort,
    });
  } catch (err) {
    console.error("❌ Error fetching public videos by channelId:", err);
    res.status(500).json({
      message: "Server error while fetching channel videos.",
      error: err.message,
    });
  }
});

// Get Video Relate
const getRelatedVideos = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10, userId, isLoggedIn } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // 1. Lấy video hiện tại
  const currentVideo = await Video.findById(videoId)
    .populate(
      "uploader",
      "nameChannel subscribersCount contentTotal.videos viewTotal"
    )
    .select(
      "-description -url -reportReviewCount -reportCount -violationStatus -isBanned"
    )
    .lean();

  // console.log("currentVideo: ", currentVideo);

  if (!currentVideo) {
    return res
      .status(404)
      .json({ success: false, message: "Video not found." });
  }

  const queryBase = {
    _id: { $ne: videoId }, // 👈 TRỪ video đang xem
    isPrivate: false, // 👈 CHỈ lấy video công khai
  };

  // 2. Video liên quan theo category, title, uploader
  const relatedByCategoryOrTitleOrUploader = await Video.find({
    ...queryBase,
    $or: [
      { category: { $in: currentVideo.category } },
      {
        title: {
          $regex: currentVideo.title.split(" ").slice(0, 3).join("|"),
          $options: "i",
        },
      },
      { uploader: currentVideo.uploader._id },
    ],
  });

  // 3. Video top view/like/comment (công khai)
  const publicVideos = await Video.find(queryBase)
    .populate("uploader", "subscribersCount")
    .select(
      "-description -url -reportReviewCount -reportCount -violationStatus -isBanned"
    )
    .lean();

  const topByViews = [...publicVideos]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
  const topByLikes = [...publicVideos]
    .sort((a, b) => (b.statusTotal?.like || 0) - (a.statusTotal?.like || 0))
    .slice(0, 10);
  const topByComments = [...publicVideos]
    .sort((a, b) => (b.commentTotal || 0) - (a.commentTotal || 0))
    .slice(0, 10);

  // 4. Gộp các video liên quan
  const relatedSet = new Set([
    ...relatedByCategoryOrTitleOrUploader.map((v) => v._id.toString()),
    ...topByViews.map((v) => v._id.toString()),
    ...topByLikes.map((v) => v._id.toString()),
    ...topByComments.map((v) => v._id.toString()),
  ]);

  // 5. Nếu đã đăng nhập và có userId hợp lệ → thêm video từ channel đã sub
  if (isLoggedIn === "true" && userId) {
    const userChannel = await Channel.findOne({ owner: userId });
    if (userChannel) {
      const subscribedVideos = await Video.find({
        ...queryBase,
        uploader: { $in: userChannel.channelsSubscribed },
      });
      subscribedVideos.forEach((v) => relatedSet.add(v._id.toString()));
    }
  }

  // 6. Lấy danh sách đầy đủ
  const finalRelated = await Video.find({
    _id: { $in: Array.from(relatedSet) },
  })
    .populate("uploader", "nameChannel avatarChannel")
    .select(
      "-description -url -reportReviewCount -reportCount -violationStatus -isBanned"
    )
    .lean();

  // console.log("finalRelated: ", finalRelated);

  // 7. Random và phân trang
  const shuffled = finalRelated.sort(() => 0.5 - Math.random());
  const paginated = shuffled.slice(skip, skip + limitNum);

  res.status(200).json({
    success: true,
    videos: paginated,
    totalItems: shuffled.length,
    currentPage: pageNum,
    hasMore: skip + limitNum < shuffled.length,
  });
});

const getVideoInfo = asyncHandler(async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId)
      .select("-reportReviewCount -reportCount -violationStatus")
      .populate(
        "uploader",
        "nameChannel avatarChannel subscribers subscribersCount"
      )
      .populate("playList", "titlePlaylist");

    console.log("video: ", video);

    if (!video) return res.status(404).json({ message: "Video not found." });
    res.json(video);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

const editVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { thumbnailUrl, title, description, categories, isPremiumOnly, isPrivate } =
    req.body;

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: "Video not found." });
    }

    // console.log("Thumbnail: ", video.thumbnail);
    // console.log("thumbnailUrl: ", thumbnailUrl);

    // Kiểm tra và cập nhật thumbnail
    if (thumbnailUrl && thumbnailUrl !== video.thumbnail) {
      // Xóa thumbnail cũ khỏi Cloudinary
      await deleteFromCloudinary([video.thumbnail], "image");
      video.thumbnail = thumbnailUrl;
    }

    // Cập nhật các trường khác nếu có
    if (title !== undefined) video.title = title;
    if (description !== undefined) video.description = description;
    if (Array.isArray(categories)) video.category = categories;
    if (isPremiumOnly !== undefined) video.isPremiumOnly = isPremiumOnly;
    if (isPrivate !== undefined) video.isPrivate = isPrivate;

    await video.save();

    res.status(200).json({
      success: true,
      message: `Video "${video.title}" updated successfully.`,
      updatedVideo: video,
    });
  } catch (err) {
    console.error("❌ Lỗi khi chỉnh sửa video:", err);
    res.status(500).json({
      message: "Lỗi server khi chỉnh sửa video",
      error: err.message,
    });
  }
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await Video.findById(videoId);
  if (!video) return res.status(404).json({ message: "Video not found." });

  await deleteFromCloudinary(video.url, "video");
  await deleteFromCloudinary([video.thumbnail], "image");

  await Playlist.updateMany(
    { "videos.video": video._id },
    { $pull: { videos: { video: video._id } } }
  );

  const channelUpdate = await Channel.findByIdAndUpdate(
    video.uploader,
    {
      $pull: { videos: video._id },
      $inc: {
        "contentTotal.videos": -1,
        "contentTotal.total": -1,
      },
    },
    { new: true }
  );

  if (!channelUpdate) {
    return res.status(404).json({ message: "No channel found to update." });
  }

  await video.deleteOne();

  res.status(200).json({
    message: `Video "${video.title}" deleted successfully.`,
    video,
  });
});

module.exports = {
  // getVideosForViewingNoLogin,
  getRecommendedVideos,
  getAllChannelVideos,
  getAllUserVideos,
  getRelatedVideos,
  getVideoInfo,
  editVideo,
  deleteVideo,
};
