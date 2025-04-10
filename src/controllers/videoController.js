// ""const jwt = require("jsonwebtoken");
const Video = require("../models/video");
const cloudinary = require("cloudinary").v2;
const asyncHandler = require("express-async-handler");
const fs = require("fs").promises;
const path = require("path");
const ffmpegPath = require('ffmpeg-static');
const execPromise = require("../utils/videoUtils/execPromise");
const getVideoDuration = require("../utils/videoUtils/getVideoDuration");

const { v4: uuidv4 } = require("uuid"); // Thêm dòng này đầu file nếu chưa có

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
    const uniqueFileName = `${path.parse(videoFile.name).name}_${uuidv4()}${ext}`;
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
    res.status(500).json({ message: "Lỗi server khi lưu video tạm", error: err.message });
  }
});

const getListVideoSliced = asyncHandler(async (req, res) => {
  const { folder, savedName } = req.body;

  if (!folder || !savedName) {
    return res.status(400).json({ message: "Thiếu thông tin folder hoặc savedName" });
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
    const outputFileName = `${videoBaseName}_part_${i + 1}_${roundedDuration}s.mp4`;
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
      return res.status(500).json({ message: `Lỗi khi cắt video tại part ${i + 1}`, error: err.message });
    }
  }

  try {
    await fs.unlink(videoPath);
  } catch (err) {
    return res.status(500).json({ message: "Không thể xóa video gốc", error: err.message });
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
  const { thumbnailUrl, videoUrls, title, description, categories, channelId } = req.body;

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
      categories,
      createdAt: new Date(),
    });

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
    res.status(500).json({ message: "Lỗi khi dọn dẹp folder", error: err.message });
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
};