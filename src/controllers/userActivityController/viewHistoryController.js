const VideoViewHistory = require("../../models/userActivity/videoViewHistory");
const asyncHandler = require("express-async-handler");

const getViewHistoryByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;

  if (!userId) {
    return res.status(400).json({ message: "Thiếu userId." });
  }

  const viewHistory = await VideoViewHistory.findOne({ userId })
    .populate({
      path: "listVideoId.videoId",
      select: "uploader title thumbnail views duration updatedAt",
      populate: {
        path: "uploader",
        select: "nameChannel avatarChannel",
      },
    })
    .lean();

  // Kiểm tra nếu không có lịch sử xem thì trả về status 200 và danh sách rỗng
  if (!viewHistory || !viewHistory.listVideoId || viewHistory.listVideoId.length === 0) {
    return res.status(200).json({
      message: "There is no history.",
      total: 0,
      page,
      limit,
      history: [],
    });
  }

  // Sắp xếp theo lastViewedAt giảm dần
  const sortedHistory = viewHistory.listVideoId.sort(
    (a, b) => new Date(b.lastViewedAt) - new Date(a.lastViewedAt)
  );

  // Phân trang
  const startIndex = (page - 1) * limit;
  const paginatedHistory = sortedHistory.slice(startIndex, startIndex + limit);

  res.status(200).json({
    message: "Get view history successfully.",
    total: sortedHistory.length,
    page,
    limit,
    history: paginatedHistory,
  });
});

module.exports = {
  getViewHistoryByUserId,
};
