const axios = require("axios");
const Video = require("../models/video");
const Channel = require("../models/channel");
const Playlist = require("../models/playlist");
const VideoViewHistory = require("../models/videoViewHistory");
const cloudinary = require("cloudinary").v2;
const asyncHandler = require("express-async-handler");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");
const execPromise = require("../utils/videoUtils/execPromise");
const getVideoDuration = require("../utils/videoUtils/getVideoDuration");

const { v4: uuidv4 } = require("uuid"); // Thêm dòng này đầu file nếu chưa có
const deleteFromCloudinary = require("../utils/cloudinary/deleteFromCloudinary");

const getVideo = asyncHandler(async (req, res) => {
  if (!req.files || !req.files.videoFile) {
    return res.status(400).json({ message: "No video file uploaded" });
  }

  const { videoFile } = req.files;
  const folder = req.body.folder || `${Date.now()}`;

  console.log("folder", folder);

  const tempFolderPath = path.join(__dirname, "../uploads", folder);

  try {
    await fs.mkdir(tempFolderPath, { recursive: true });

    // 👉 Tạo tên file duy nhất để lưu tạm
    const ext = path.extname(videoFile.name);
    const uniqueFileName = `${
      path.parse(videoFile.name).name
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

  const tempFolderPath = path.join(__dirname, "../uploads", folder);
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
    const outputFileName = `${videoBaseName}_part_${
      i + 1
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

  const filePath = path.join(__dirname, "../uploads", folder, name);
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
    });

    const channel = await Channel.findById(channelId);

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    channel.videoTotal += 1;

    await channel.save();

    res.status(201).json({
      success: true,
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

  const uploadsDir = path.join(__dirname, "../uploads", folder);

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

  const uploadsDir = path.join(__dirname, "../uploads");
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

// GET video

// Hàm lấy tất cả video từ cơ sở dữ liệu
const getAllVideos = asyncHandler(async (req, res) => {
  try {
    const videos = await Video.find({ isPrivate: false }).populate(
      "uploader",
      "nameChannel avatarChannel"
    );

    if (videos.length === 0) {
      return res.status(404).json({ message: "Không có video công khai nào" });
    }

    res.status(200).json({
      success: true,
      videos,
    });
  } catch (err) {
    console.error("Lỗi khi lấy danh sách video công khai:", err);
    res
      .status(500)
      .json({ message: "Lỗi server khi lấy video", error: err.message });
  }
});

const getAllChannelVideos = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId) {
    return res.status(400).json({ message: "Thiếu channelId" });
  }

  try {
    const videos = await Video.find({
      uploader: channelId,
      isPrivate: false,
    }).populate("uploader", "nameChannel avatarChannel");

    if (videos.length === 0) {
      return res
        .status(404)
        .json({ message: "Không có video công khai nào cho kênh này" });
    }

    res.status(200).json({
      success: true,
      videos,
    });
  } catch (err) {
    console.error("❌ Lỗi khi lấy video công khai theo channelId:", err);
    res.status(500).json({
      message: "Lỗi server khi lấy video từ kênh",
      error: err.message,
    });
  }
});

const getAllUserVideos = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "Thiếu userId" });
  }

  try {
    const userVideos = await Video.find({ uploader: userId }).populate(
      "uploader",
      "nameChannel avatarChannel"
    );

    if (userVideos.length === 0) {
      return res.status(404).json({ message: "Người dùng chưa tạo video nào" });
    }

    res.status(200).json({
      success: true,
      videos: userVideos,
    });
  } catch (err) {
    console.error("❌ Lỗi khi lấy video của user:", err);
    res.status(500).json({ message: "Lỗi server khi lấy video người dùng" });
  }
});

let inUse = {};
const cleanupTimeouts = {};

const getVideoInfo = asyncHandler(async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId).populate(
      "uploader",
      "nameChannel avatarChannel subscribers subscribersCount"
    );

    if (!video)
      return res.status(404).json({ message: "Không tìm thấy video" });
    res.json(video);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

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
            .json({ message: "Đã xem gần đây, không tăng view" });
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
    if (!videoData || !Array.isArray(videoData.url)) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy video hoặc URL không hợp lệ" });
    }

    const timestamp = Date.now();
    const folderName = `combine_${videoId}_${timestamp}`;
    const tempFolder = path.join(__dirname, "../saves", folderName);
    const listFilePath = path.join(tempFolder, "input.txt");
    const outputFilePath = path.join(tempFolder, `combined_${videoId}.mp4`);

    await fs.mkdir(tempFolder, { recursive: true });

    const fileListContent = videoData.url
      .map((url) => `file '${url}'`)
      .join("\n");
    await fs.writeFile(listFilePath, fileListContent);

    const ffmpegCommand = `"${ffmpegPath}" -f concat -safe 0 -protocol_whitelist "file,http,https,tcp,tls" -i "${listFilePath}" -c copy "${outputFilePath}"`;
    await execPromise(ffmpegCommand);

    if (!fsSync.existsSync(outputFilePath)) {
      return res
        .status(500)
        .json({ message: "Tệp video chưa được tạo thành công." });
    }

    // ✅ Trả về đường dẫn tạm để FE gọi tiếp để stream
    return res.status(200).json({
      message: "Gộp video thành công",
      videoPath: outputFilePath,
      folderName,
      fileName: `combined_${videoId}.mp4`,
    });
  } catch (err) {
    console.error("❌ Lỗi khi nối video từ URL:", err);
    res.status(500).json({ message: "Lỗi khi nối video", error: err.message });
  }
});

const handleCleanup = async (videoPath) => {
  try {
    global.gc?.();

    await fs.access(videoPath);

    await new Promise((res) => setTimeout(res, 1000)); // Chờ 1s

    await fs.rm(videoPath, { force: true });
    console.log("🧹 Đã xoá file:", videoPath);

    const folderPath = path.dirname(videoPath);
    const files = await fs.readdir(folderPath);

    const inputFilePath = path.join(folderPath, "input.txt");

    try {
      await fs.access(inputFilePath); // kiểm tra tồn tại
      await fs.unlink(inputFilePath);
      console.log("🧹 Đã xoá input.txt");

      if (files.length === 0) {
        try {
          await fs.rmdir(folderPath);
          console.log("🧹 Đã xoá thư mục:", folderPath);
        } catch (err) {
          console.warn("⚠️ Không thể xoá thư mục:", err.message);
        }
      }
    } catch (err) {
      console.warn("⚠️ Lỗi khi xoá input.txt hoặc thư mục:", err.message);
    }
  } catch (err) {
    console.warn("⚠️ Lỗi khi xoá file:", err.message);
  }

  delete cleanupTimeouts[videoPath];
};

const videoStreaming = asyncHandler(async (req, res) => {
  const { folderName, fileName } = req.query;
  if (!folderName || !fileName) {
    return res.status(400).json({ message: "Thiếu folderName hoặc fileName" });
  }

  const videoPath = path.join(__dirname, "../saves", folderName, fileName);

  if (!fsSync.existsSync(videoPath)) {
    return res.status(404).json({ message: "Không tìm thấy video" });
  }

  const stat = await fs.stat(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (!range) {
    const headers = {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
    };
    res.writeHead(200, headers);
    const stream = fsSync.createReadStream(videoPath);
    stream.pipe(res);

    req.on("abort", () => {
      console.log("🚨 Video stream aborted by client for:", videoPath);
      stream.destroy();
      inUse[videoPath] = false;
      cleanupTimeouts[videoPath] = setTimeout(async () => {
        if (!inUse[videoPath]) {
          handleCleanup(videoPath);
        }
      }, 300 * 1000);
    });

    stream.on("end", () => {
      console.log("✅ Stream ended for:", videoPath);
      inUse[videoPath] = false;

      // Đảm bảo setTimeout không bị bỏ qua
      if (!cleanupTimeouts[videoPath]) {
        cleanupTimeouts[videoPath] = setTimeout(() => {
          if (!inUse[videoPath]) {
            handleCleanup(videoPath);
          }
        }, 150 * 1000); // Dọn sau 15s
      }
    });

    res.on("close", () => {
      console.log("📤 Response closed for:", videoPath);
      stream.destroy();
      inUse[videoPath] = false;

      if (!cleanupTimeouts[videoPath]) {
        cleanupTimeouts[videoPath] = setTimeout(() => {
          if (!inUse[videoPath]) {
            handleCleanup(videoPath);
          }
        }, 150 * 1000);
      }
    });

    return;
  }

  const CHUNK_SIZE = 10 ** 6;
  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1]
    ? parseInt(parts[1], 10)
    : Math.min(start + CHUNK_SIZE - 1, fileSize - 1);

  const contentLength = end - start + 1;

  const headers = {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": contentLength,
    "Content-Type": "video/mp4",
  };

  console.log(headers);

  inUse[videoPath] = true;

  if (cleanupTimeouts[videoPath]) {
    clearTimeout(cleanupTimeouts[videoPath]);
    delete cleanupTimeouts[videoPath];
  }

  res.writeHead(206, headers);
  const stream = fsSync.createReadStream(videoPath, { start, end });
  stream.pipe(res);

  stream.on("end", () => {
    console.log("✅ Stream ended for:", videoPath);
    inUse[videoPath] = false;

    // Đảm bảo setTimeout không bị bỏ qua
    if (!cleanupTimeouts[videoPath]) {
      cleanupTimeouts[videoPath] = setTimeout(() => {
        if (!inUse[videoPath]) {
          handleCleanup(videoPath);
        }
      }, 150 * 1000); // Dọn sau 15s
    }
  });

  res.on("close", () => {
    console.log("📤 Response closed for:", videoPath);
    stream.destroy();
    inUse[videoPath] = false;

    if (!cleanupTimeouts[videoPath]) {
      cleanupTimeouts[videoPath] = setTimeout(() => {
        if (!inUse[videoPath]) {
          handleCleanup(videoPath);
        }
      }, 150 * 1000);
    }
  });

  req.on("abort", () => {
    console.log("🚨 Video stream aborted by client for:", videoPath);
    stream.destroy();
    inUse[videoPath] = false;
    cleanupTimeouts[videoPath] = setTimeout(async () => {
      if (!inUse[videoPath]) {
        handleCleanup(videoPath);
      }
    }, 300 * 1000);
  });
});

// const deleteFromCloudinary = async (videoUrls) => {
//   if (!Array.isArray(videoUrls)) return;

//   await Promise.all(
//     videoUrls.map(async (url) => {
//       try {
//         // Lấy public_id bằng regex
//         const matches = url.match(/upload\/(?:v\d+\/)?([^\.]+)\.mp4/);
//         if (!matches || !matches[1]) {
//           console.warn("Không lấy được public_id từ URL:", url);
//           return;
//         }

//         const publicId = matches[1];

//         await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
//         console.log(`✅ Đã xóa Cloudinary video: ${publicId}`);
//       } catch (err) {
//         console.error("❌ Lỗi khi xóa video:", err.message);
//       }
//     })
//   );
// };

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await Video.findById(videoId);
  if (!video) return res.status(404).json({ message: "Video không tồn tại" });

  await deleteFromCloudinary(video.url);

  await Playlist.updateMany(
    { "videos.video": video._id },
    { $pull: { videos: { video: video._id } } }
  );

  await Channel.updateOne(
    { _id: video.uploader },
    { $pull: { videos: video._id }, $inc: { videoTotal: -1 } }
  );

  await video.deleteOne();
  res
    .status(200)
    .json({ video, message: `Đã xóa video ${video.title} thành công` });
});

module.exports = {
  getVideo,
  getListVideoSliced,
  downloadVideoPart,
  createVideo,
  generateSignature,
  deleteSlicedVideos,
  cleanupFolder,

  getAllVideos,
  getAllChannelVideos,
  getAllUserVideos,
  getVideoInfo,
  updateVideoView,
  combineCloudVideosById,
  videoStreaming,
  deleteVideo,
};
