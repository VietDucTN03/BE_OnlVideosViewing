const Video = require("../../../models/content/video");
const Channel = require("../../../models/user/channel");
const VideoViewHistory = require("../../../models/userActivity/videoViewHistory");
const cloudinary = require("cloudinary").v2;
const asyncHandler = require("express-async-handler");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");
const execPromise = require("../../../utils/videoUtils/execPromise");
const getVideoDuration = require("../../../utils/videoUtils/getVideoDuration");

const { v4: uuidv4 } = require("uuid"); // Thêm dòng này đầu file nếu chưa có

//* Upload Video
const getVideo = asyncHandler(async (req, res) => {
  if (!req.files || !req.files.videoFile) {
    return res.status(400).json({ message: "No video file uploaded" });
  }

  const { videoFile } = req.files;
  const folder = req.body.folder || `${Date.now()}`;

  console.log("folder", folder);

  const tempFolderPath = path.join(__dirname, "../../../uploads", folder);

  try {
    await fs.mkdir(tempFolderPath, { recursive: true });

    // 👉 Tạo tên file duy nhất để lưu tạm
    const ext = path.extname(videoFile.name);
    const uniqueFileName = `${path.parse(videoFile.name).name
      }_${uuidv4()}${ext}`;
    const tempVideoPath = path.join(tempFolderPath, uniqueFileName);

    await videoFile.mv(tempVideoPath);

    res.status(200).json({
      tempVideoPath,
      videoName: videoFile.name,
      savedName: uniqueFileName,
      folder,
    });
  } catch (err) {
    console.error("❌ Lỗi khi xử lý video upload:", err);
    res
      .status(500)
      .json({ message: "Lỗi server khi lưu video tạm", error: err.message });
  }
});

const getListVideoSliced = asyncHandler(async (req, res) => {
  const { folder, savedName } = req.body;

  if (!folder || !savedName) {
    return res
      .status(400)
      .json({ message: "Thiếu thông tin folder hoặc savedName" });
  }

  const tempFolderPath = path.join(__dirname, "../../../uploads", folder);
  const videoPath = path.join(tempFolderPath, savedName);
  const videoBaseName = path.parse(savedName).name;

  try {
    await fs.access(videoPath);
  } catch (err) {
    return res.status(404).send("❌ Không tìm thấy file video");
  }

  const stat = await fs.stat(videoPath);
  const fileSize = stat.size;
  const CHUNK_SIZE = 50 * 1024 * 1024;
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
  const duration = await getVideoDuration(videoPath);
  const chunkDuration = duration / totalChunks;

  const videoParts = [];

  for (let i = 0; i < totalChunks; i++) {
    const startTime = i * chunkDuration;
    const roundedDuration = Math.round(chunkDuration);
    const outputFileName = `${videoBaseName}_part_${i + 1
      }_${roundedDuration}s.mp4`;
    const outputPath = path.join(tempFolderPath, outputFileName);

    const ffmpegCommand = `"${ffmpegPath}" -i "${videoPath}" -ss ${startTime} -t ${chunkDuration} -c copy "${outputPath}"`;

    try {
      await execPromise(ffmpegCommand);
      videoParts.push({
        filename: outputFileName,
        duration: roundedDuration,
        path: `/uploads/${folder}/${outputFileName}`,
      });
    } catch (err) {
      return res.status(500).json({
        message: `Lỗi khi cắt video tại part ${i + 1}`,
        error: err.message,
      });
    }
  }

  try {
    await fs.unlink(videoPath);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Không thể xóa video gốc", error: err.message });
  }

  res.json({
    message: "✅ Video đã được cắt và sẵn sàng để frontend upload",
    videoParts,
  });
});

const downloadVideoPart = asyncHandler(async (req, res) => {
  const { folder, name } = req.query;
  if (!name) return res.status(400).json({ message: "Thiếu tên file" });

  const filePath = path.join(__dirname, "../../../uploads", folder, name);
  try {
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch {
    res.status(404).json({ message: "Không tìm thấy file" });
  }
});

const createVideo = asyncHandler(async (req, res, next) => {
  const {
    thumbnailUrl,
    videoUrls,
    title,
    description,
    categories,
    playlists,
    channelId,
    duration,
    isPrivate,
    isPremiumOnly,
  } = req.body;

  // Kiểm tra hợp lệ
  if (!thumbnailUrl || !Array.isArray(videoUrls) || videoUrls.length === 0) {
    return res.status(400).json({ message: "Missing or invalid inputs" });
  }

  try {
    const video = await Video.create({
      uploader: channelId,
      thumbnail: thumbnailUrl,
      url: videoUrls,
      title,
      description,
      duration,
      category: categories,
      playList: playlists,
      isPrivate,
      isPremiumOnly,
    });

    const channel = await Channel.findByIdAndUpdate(
      channelId,
      {
        $inc: {
          "contentTotal.videos": 1,
          "contentTotal.total": 1
        }
      },
      { new: true }
    );

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    res.status(201).json({
      success: true,
      message: `Video "${video.title}" created successfully.`,
      video,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error", error: err.message });
    next(err);
  }
});

const generateSignature = asyncHandler(async (req, res, next) => {
  const { folder } = req.body;

  if (!folder) {
    return res.status(400).json({ message: "Missing inputs" });
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      { timestamp: timestamp, folder: folder },
      process.env.CLOUDINARY_SECRET
    );

    // console.log("📦 Backend signing:", {
    //   folder,
    //   timestamp,
    //   signature,
    // });

    res.status(200).json({ success: true, timestamp, signature });
  } catch (err) {
    console.log(err);
    res.status(500);
    next(err);
  }
});

const deleteSlicedVideos = asyncHandler(async (req, res) => {
  const { folder, filenames } = req.body;

  if (!filenames || !Array.isArray(filenames)) {
    return res.status(400).json({ message: "Danh sách file không hợp lệ" });
  }

  const uploadsDir = path.join(__dirname, "../../../uploads", folder);

  try {
    await Promise.all(
      filenames.map(async (filename) => {
        const filePath = path.join(uploadsDir, filename);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.warn(`Không thể xoá file ${filename}:`, err.message);
        }
      })
    );

    res.status(200).json({ message: "Đã xoá các video đã cắt thành công" });
  } catch (err) {
    console.error("Lỗi khi xoá file:", err);
    res.status(500).json({ message: "Lỗi server khi xoá file" });
  }
});

const cleanupFolder = asyncHandler(async (req, res) => {
  const { folder } = req.body;

  if (!folder) {
    return res.status(400).json({ message: "Thiếu thông tin folder" });
  }

  const uploadsDir = path.join(__dirname, "../../../uploads");
  const folderPath = path.join(uploadsDir, folder);

  try {
    const folderFiles = await fs.readdir(folderPath);
    if (folderFiles.length === 0) {
      await fs.rmdir(folderPath);
      console.log(`🧹 Đã xoá folder rỗng: ${folder}`);
    }

    const remainingUploads = await fs.readdir(uploadsDir);
    if (remainingUploads.length === 0) {
      await fs.rmdir(uploadsDir);
      console.log("🧹 Đã xoá thư mục uploads vì không còn gì");
    }

    res.status(200).json({ message: "Dọn dẹp folder thành công" });
  } catch (err) {
    console.warn("Lỗi khi dọn dẹp folder:", err);
    res
      .status(500)
      .json({ message: "Lỗi khi dọn dẹp folder", error: err.message });
  }
});

//* Viewing Video
const combinePromises = {};
let inUse = {};
const cleanupTimeouts = {};

const updateVideoView = asyncHandler(async (req, res) => {
  const { videoId, userId } = req.body;

  if (!videoId || !userId) {
    return res.status(400).json({ message: "Thiếu videoId hoặc userId" });
  }

  try {
    const now = Date.now();
    const THIRTY_SECONDS = 30 * 1000;

    // Tìm lịch sử xem của user
    let viewHistory = await VideoViewHistory.findOne({ userId });

    if (viewHistory) {
      const videoIndex = viewHistory.listVideoId.findIndex(
        (entry) => entry.videoId.toString() === videoId
      );

      if (videoIndex !== -1) {
        const lastViewed = new Date(
          viewHistory.listVideoId[videoIndex].lastViewedAt
        ).getTime();
        if (now - lastViewed < THIRTY_SECONDS) {
          return res
            .status(200)
            .json({ message: "Watching recently, not increasing the view." });
        }
        // Cập nhật thời gian
        viewHistory.listVideoId[videoIndex].lastViewedAt = now;
      } else {
        // Thêm video mới vào danh sách
        viewHistory.listVideoId.push({ videoId, lastViewedAt: now });
      }

      await viewHistory.save();
    } else {
      // Tạo lịch sử mới cho user
      const newHistory = new VideoViewHistory({
        userId,
        listVideoId: [{ videoId, lastViewedAt: now }],
      });
      await newHistory.save();
    }

    const video = await Video.findById(videoId).select("uploader");

    if (!video) {
      return res.status(404).json({ message: "Không tìm thấy video" });
    }

    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });

    if (video.uploader) {
      await Channel.findByIdAndUpdate(video.uploader, {
        $inc: { viewTotal: 1 },
      });
    }

    res
      .status(200)
      .json({ message: "Tăng view thành công", views: video.views });
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật view:", error);
    res.status(500).json({ message: "Lỗi server khi cập nhật view" });
  }
});

const combineCloudVideosById = asyncHandler(async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ message: "Thiếu videoId" });

  try {
    const videoData = await Video.findById(videoId);
    if (!videoData || !Array.isArray(videoData.url) || videoData.url.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy video hoặc URL không hợp lệ" });
    }

    // * Tạo thư mục cho môi video.
    const folderName = `combine_${videoId}`;
    const tempFolder = path.join(__dirname, "../../../saves", folderName);
    const listFilePath = path.join(tempFolder, "input.txt");
    const outputFileName = `combined_${videoId}.mp4`;
    const outputFilePath = path.join(tempFolder, outputFileName);

    // * Nếu đầu ra đã tồn tại, trả về ngay lập tức.
    if (fsSync.existsSync(outputFilePath)) {
      return res.status(200).json({
        message: "Gộp video sẵn sàng (reused)",
        videoPath: outputFilePath,
        folderName,
        fileName: outputFileName,
      });
    }

    if (combinePromises[videoId]) {
      try {
        await combinePromises[videoId];
        if (fsSync.existsSync(outputFilePath)) {
          return res.status(200).json({
            message: "Gộp video sẵn sàng (await reused)",
            videoPath: outputFilePath,
            folderName,
            fileName: outputFileName,
          });
        } else {
          return res.status(500).json({ message: "Gộp video thất bại ở tiến trình trước" });
        }
      } catch (err) {
        return res.status(500).json({ message: "Gộp video thất bại", error: err.message });
      }
    }

    // * Tạo một promise cho cùng videoId và lưu trữ nó để các yêu cầu đồng thời chia sẻ cùng một công việc.
    const runCombineJob = async () => {
      await fs.mkdir(tempFolder, { recursive: true });
      const fileListContent = videoData.url.map((url) => `file '${url}'`).join("\n");
      await fs.writeFile(listFilePath, fileListContent);

      const ffmpegCommand = `"${ffmpegPath}" -f concat -safe 0 -protocol_whitelist "file,http,https,tcp,tls" -i "${listFilePath}" -c copy "${outputFilePath}"`;

      await execPromise(ffmpegCommand);

      if (!fsSync.existsSync(outputFilePath)) {
        throw new Error("Tệp video chưa được tạo thành công.");
      }

      try { await fs.unlink(listFilePath); } catch (_) { }
    }

    combinePromises[videoId] = runCombineJob();

    try {
      await combinePromises[videoId];
      return res.status(200).json({
        message: "Gộp video thành công",
        videoPath: outputFilePath,
        folderName,
        fileName: outputFileName,
      });
    } catch (err) {
      return res.status(500).json({ message: "Lỗi khi nối video", error: err.message });
    } finally {
      delete combinePromises[videoId];
    }

  } catch (err) {
    console.error("❌ Lỗi khi nối video từ URL:", err);
    res.status(500).json({ message: "Lỗi khi nối video", error: err.message });
  }
});

const cleaningPaths = new Set();  // * Tạo danh sách các videoPath đang được cleanup để tránh xử lý trùng.

const handleCleanup = async (videoPath) => {

  // ** Tránh chạy đồng thời cho cùng videoPath
  if (cleaningPaths.has(videoPath)) return;
  cleaningPaths.add(videoPath);

  try {
    // ? Hàm ép Node.js chạy Garbage Collector thủ công (thu gom bộ nhớ).
    global.gc?.();

    // ? Chờ một chút để các luồng đóng lại (tùy chọn).
    await new Promise((res) => setTimeout(res, 1000));

    // * Thực hiện lệnh xóa (force là bắt buộc).
    try {
      await fs.rm(videoPath, { force: true });
      console.log("🧹 Đã xoá file (if existed):", videoPath);
    } catch (err) {
      console.warn("⚠️ Lỗi khi xoá file (rm):", err.message);
    }

    const folderPath = path.dirname(videoPath);
    const inputFilePath = path.join(folderPath, "input.txt");

    try {
      // * Kiểm tra xem input.txt có tồn tại không = existsSync.
      if (fsSync.existsSync(inputFilePath)) {
        await fs.unlink(inputFilePath);
        console.log("🧹 Đã xoá input.txt");
      }
    } catch (err) {
      console.warn("⚠️ Lỗi khi xoá input.txt:", err.message);
    }

    try {
      const files = await fs.readdir(folderPath);   // * Đọc danh sách file và thư mục con bên trong một thư mục.

      if (!files || files.length === 0) {
        await fs.rmdir(folderPath);
        console.log("🧹 Đã xoá thư mục rỗng:", folderPath);
      } else {
        console.log("Thư mục vẫn còn file, không xóa:", folderPath);
      }
    } catch (err) {
      // * ENOENT = Error NO ENTry (không có mục nhập).
      if (err.code && err.code === "ENOENT") {
        console.log("Thư mục bị xóa rồi, bỏ qua:", folderPath);
      } else {
        console.warn("⚠️ Lỗi khi xử lý folder:", err.message);
      }
    }
  } catch (err) {
    console.warn("⚠️ Lỗi xử lý cleanup tổng quát:", err.message);
  } finally {
    // * Đảm bảo luôn dọn dẹp
    cleaningPaths.delete(videoPath);
    if (cleanupTimeouts[videoPath]) {
      clearTimeout(cleanupTimeouts[videoPath]);
      delete cleanupTimeouts[videoPath];
    }
  }
};

const increaseRef = (videoPath) => {
  inUse[videoPath] = (inUse[videoPath] || 0) + 1;

  // ** Hủy bỏ việc dọn dẹp theo lịch trình nếu có.
  if (cleanupTimeouts[videoPath]) {
    clearTimeout(cleanupTimeouts[videoPath]);
    delete cleanupTimeouts[videoPath];
  }
};

const decreaseRef = (videoPath) => {
  inUse[videoPath] = Math.max(0, (inUse[videoPath] || 1) - 1);
  if (inUse[videoPath] === 0 && !cleanupTimeouts[videoPath]) {
    cleanupTimeouts[videoPath] = setTimeout(() => {
      if (!inUse[videoPath] || inUse[videoPath] === 0) {
        handleCleanup(videoPath);
      }
    }, 150 * 1000);
  }
};

// * Đảm bảo đường dẫn đã giải quyết nằm bên trong baseDir
const isPathInside = (parent, child) => {
  // * Tính đường dẫn tương đối từ parent đến child
  const relative = path.relative(parent, child);

  // return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);

  // ? Nếu cùng một đường dẫn -> không tính là "nằm bên trong"
  if (relative === "") return false;

  // ? Nếu bắt đầu bằng ".." -> nghĩa là child nằm ngoài parent
  if (relative.startsWith("..")) return false;

  // ? Nếu là đường dẫn tuyệt đối -> cũng không hợp lệ
  if (path.isAbsolute(relative)) return false;

  // ? Ngược lại thì chắc chắn child nằm trong parent
  return true;
};

const videoStreaming = asyncHandler(async (req, res) => {
  const { folderName, fileName } = req.query;
  if (!folderName || !fileName) {
    return res.status(400).json({ message: "Thiếu folderName hoặc fileName" });
  }

  try {
    const savesDir = path.join(__dirname, "../../../saves");
    const videoPath = path.join(savesDir, folderName, fileName);

    const normalized = path.normalize(videoPath);
    if (!isPathInside(savesDir, normalized) && normalized !== path.join(savesDir, folderName, fileName)) {
      console.warn("⚠️ Attempted path traversal:", videoPath);
      return res.status(400).json({ message: "Invalid file path" });
    }

    if (!fsSync.existsSync(videoPath)) {
      return res.status(404).json({ message: "Không tìm thấy video" });
    }

    const stat = await fs.stat(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // * Tăng số lượng tham chiếu nếu có người xem.
    increaseRef(videoPath);

    // * Xử lý luồng toàn tập tin (không có phạm vi).
    if (!range) {
      const headers = {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
      };
      res.writeHead(200, headers);
      const stream = fsSync.createReadStream(videoPath);

      // * Dọn dẹp sự kiện.
      const cleanupAndDecrease = () => {
        try { stream.destroy(); } catch (e) { }
        decreaseRef(videoPath);
      };

      stream.pipe(res);

      req.on("abort", () => {
        console.log("🚨 Video stream aborted by client for:", videoPath);
        cleanupAndDecrease();
      });

      stream.on("end", () => {
        console.log("✅ Stream ended for:", videoPath);
        cleanupAndDecrease();
      });

      res.on("close", () => {
        // client closed the connection
        console.log("📤 Response closed for:", videoPath);
        cleanupAndDecrease();
      });

      return;
    }

    const CHUNK_SIZE = 10 ** 6; // 1MB
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + CHUNK_SIZE - 1, fileSize - 1);

    if (isNaN(start) || isNaN(end) || start > end || start >= fileSize) {
      // bad range: respond 416
      res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
      decreaseRef(videoPath);
      return res.end();
    }

    const contentLength = end - start + 1;
    const headers = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength,
      "Content-Type": "video/mp4",
    };

    res.writeHead(206, headers);
    const stream = fsSync.createReadStream(videoPath, { start, end });

    const cleanupAndDecreaseRange = () => {
      try { stream.destroy(); } catch (e) { }
      decreaseRef(videoPath);
    };

    stream.pipe(res);

    stream.on("end", () => {
      console.log("✅ Partial stream ended for:", videoPath, `range ${start}-${end}`);
      cleanupAndDecreaseRange();
    });

    res.on("close", () => {
      console.log("📤 Response closed for (partial):", videoPath);
      cleanupAndDecreaseRange();
    });

    req.on("abort", () => {
      console.log("🚨 Video stream aborted by client for (partial):", videoPath);
      cleanupAndDecreaseRange();
    });
  } catch (err) {
    console.error("❌ Lỗi streaming video:", err);
    try { decreaseRef && decreaseRef(); } catch (_) { }   // ? Không xài error.

    if (!res.headersSent) {
      res.status(500).json({ message: "Lỗi server khi streaming", error: err.message });
    } else {
      res.end();
    }
  }
});

module.exports = {
  getVideo,
  getListVideoSliced,
  downloadVideoPart,
  createVideo,
  generateSignature,
  deleteSlicedVideos,
  cleanupFolder,

  updateVideoView,
  combineCloudVideosById,
  videoStreaming,
};