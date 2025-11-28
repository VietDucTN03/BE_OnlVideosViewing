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

const { v4: uuidv4 } = require("uuid");

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

    // Create a unique file name for temporary storage
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
    console.error("Error processing video upload:", err);
    res
      .status(500)
      .json({ message: "Server error when saving temporary video", error: err.message });
  }
});

const getListVideoSliced = asyncHandler(async (req, res) => {
  const { folder, savedName } = req.body;

  if (!folder || !savedName) {
    return res
      .status(400)
      .json({ message: "Missing folder or savedName information" });
  }

  const tempFolderPath = path.join(__dirname, "../../../uploads", folder);
  const videoPath = path.join(tempFolderPath, savedName);
  const videoBaseName = path.parse(savedName).name;

  try {
    await fs.access(videoPath);
  } catch (err) {
    return res.status(404).send("Video file not found");
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
        message: `Error when cutting video at part ${i + 1}`,
        error: err.message,
      });
    }
  }

  try {
    await fs.unlink(videoPath);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Cannot delete original video", error: err.message });
  }

  res.json({
    message: "Video is trimmed and ready for frontend upload",
    videoParts,
  });
});

const downloadVideoPart = asyncHandler(async (req, res) => {
  const { folder, name } = req.query;
  if (!name) return res.status(400).json({ message: "Missing file name" });

  const filePath = path.join(__dirname, "../../../uploads", folder, name);
  try {
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch {
    res.status(404).json({ message: "File not found" });
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

  // Validity check
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

    // console.log("Backend signing:", {
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
    return res.status(400).json({ message: "List of invalid files" });
  }

  const uploadsDir = path.join(__dirname, "../../../uploads", folder);

  try {
    await Promise.all(
      filenames.map(async (filename) => {
        const filePath = path.join(uploadsDir, filename);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.warn(`Unable to delete file ${filename}:`, err.message);
        }
      })
    );

    res.status(200).json({ message: "Deleted the cut videos successfully" });
  } catch (err) {
    console.error("Error when deleting file:", err);
    res.status(500).json({ message: "Server error when deleting file" });
  }
});

const cleanupFolder = asyncHandler(async (req, res) => {
  const { folder } = req.body;

  if (!folder) {
    return res.status(400).json({ message: "Missing folder information" });
  }

  const uploadsDir = path.join(__dirname, "../../../uploads");
  const folderPath = path.join(uploadsDir, folder);

  try {
    const folderFiles = await fs.readdir(folderPath);
    if (folderFiles.length === 0) {
      await fs.rmdir(folderPath);
      console.log(`Deleted empty folder: ${folder}`);
    }

    const remainingUploads = await fs.readdir(uploadsDir);
    if (remainingUploads.length === 0) {
      await fs.rmdir(uploadsDir);
      console.log("Deleted uploads folder because there is nothing left");
    }

    res.status(200).json({ message: "Folder cleanup successful" });
  } catch (err) {
    console.warn("Error while cleaning folder:", err);
    res
      .status(500)
      .json({ message: "Error while cleaning folder", error: err.message });
  }
});

//* Viewing Video
const combinePromises = {};
let inUse = {};
const cleanupTimeouts = {};

const updateVideoView = asyncHandler(async (req, res) => {
  const { videoId, userId } = req.body;

  if (!videoId || !userId) {
    return res.status(400).json({ message: "Missing videoId or userId" });
  }

  try {
    const now = Date.now();
    const THIRTY_SECONDS = 30 * 1000;

    // Find user viewing history
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
        // Update time
        viewHistory.listVideoId[videoIndex].lastViewedAt = now;
      } else {
        // Add new videos to the list
        viewHistory.listVideoId.push({ videoId, lastViewedAt: now });
      }

      await viewHistory.save();
    } else {
      // Create new history for user
      const newHistory = new VideoViewHistory({
        userId,
        listVideoId: [{ videoId, lastViewedAt: now }],
      });
      await newHistory.save();
    }

    const video = await Video.findById(videoId).select("uploader");

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });

    if (video.uploader) {
      await Channel.findByIdAndUpdate(video.uploader, {
        $inc: { viewTotal: 1 },
      });
    }

    res
      .status(200)
      .json({ message: "View increase successful", views: video.views });
  } catch (error) {
    console.error("Error when updating view:", error);
    res.status(500).json({ message: "Server error when updating view" });
  }
});

const combineCloudVideosById = asyncHandler(async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ message: "Missing videoId" });

  try {
    const videoData = await Video.findById(videoId);
    if (!videoData || !Array.isArray(videoData.url) || videoData.url.length === 0) {
      return res.status(404).json({ message: "Video not found or invalid URL" });
    }

    // * Create a folder for each video.
    const folderName = `combine_${videoId}`;
    const tempFolder = path.join(__dirname, "../../../saves", folderName);
    const listFilePath = path.join(tempFolder, "input.txt");
    const outputFileName = `combined_${videoId}.mp4`;
    const outputFilePath = path.join(tempFolder, outputFileName);

    // * If output already exists, return immediately.
    if (fsSync.existsSync(outputFilePath)) {
      return res.status(200).json({
        message: "Merge ready-made (reused) videos",
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
            message: "Merge ready videos (await reused)",
            videoPath: outputFilePath,
            folderName,
            fileName: outputFileName,
          });
        } else {
          return res.status(500).json({ message: "Merge video failed in previous process" });
        }
      } catch (err) {
        return res.status(500).json({ message: "Merge video failed", error: err.message });
      }
    }

    // * Create a promise for the same videoId and cache it so that concurrent requests share the same work.
    const runCombineJob = async () => {
      await fs.mkdir(tempFolder, { recursive: true });
      const fileListContent = videoData.url.map((url) => `file '${url}'`).join("\n");
      await fs.writeFile(listFilePath, fileListContent);

      const ffmpegCommand = `"${ffmpegPath}" -f concat -safe 0 -protocol_whitelist "file,http,https,tcp,tls" -i "${listFilePath}" -c copy "${outputFilePath}"`;

      await execPromise(ffmpegCommand);

      if (!fsSync.existsSync(outputFilePath)) {
        throw new Error("The video file was not created successfully.");
      }

      try { await fs.unlink(listFilePath); } catch (_) { }
    }

    combinePromises[videoId] = runCombineJob();

    try {
      await combinePromises[videoId];
      return res.status(200).json({
        message: "Merge video successfully",
        videoPath: outputFilePath,
        folderName,
        fileName: outputFileName,
      });
    } catch (err) {
      return res.status(500).json({ message: "Error while connecting video", error: err.message });
    } finally {
      delete combinePromises[videoId];
    }

  } catch (err) {
    console.error("Error when joining video from URL:", err);
    res.status(500).json({ message: "Error while connecting video", error: err.message });
  }
});

const cleaningPaths = new Set();  // * Create a list of videoPaths being cleanup to avoid duplicate processing.

const handleCleanup = async (videoPath) => {

  // ** Avoid concurrent runs for the same videoPath.
  if (cleaningPaths.has(videoPath)) return;
  cleaningPaths.add(videoPath);

  try {
    // ? A function that forces Node.js to run the Garbage Collector manually.
    global.gc?.();

    // ? Wait a moment for the streams to close (optional).
    await new Promise((res) => setTimeout(res, 1000));

    // * Execute the delete command (force is required).
    try {
      await fs.rm(videoPath, { force: true });
      console.log("Deleted file (if existed):", videoPath);
    } catch (err) {
      console.warn("Error when deleting file (rm):", err.message);
    }

    const folderPath = path.dirname(videoPath);
    const inputFilePath = path.join(folderPath, "input.txt");

    try {
      // * Check if input.txt exists = existsSync.
      if (fsSync.existsSync(inputFilePath)) {
        await fs.unlink(inputFilePath);
        console.log("Deleted input.txt");
      }
    } catch (err) {
      console.warn("Error while deleting input.txt:", err.message);
    }

    try {
      const files = await fs.readdir(folderPath);   // * Read list of files and subdirectories inside a directory.

      if (!files || files.length === 0) {
        await fs.rmdir(folderPath);
        console.log("Deleted empty folder:", folderPath);
      } else {
        console.log("Folder still has files, do not delete:", folderPath);
      }
    } catch (err) {
      // * ENOENT = Error NO ENTry.
      if (err.code && err.code === "ENOENT") {
        console.log("Folder deleted, skip:", folderPath);
      } else {
        console.warn("Error processing folder:", err.message);
      }
    }
  } catch (err) {
    console.warn("General cleanup processing error:", err.message);
  } finally {
    // * Make sure to always clean up
    cleaningPaths.delete(videoPath);
    if (cleanupTimeouts[videoPath]) {
      clearTimeout(cleanupTimeouts[videoPath]);
      delete cleanupTimeouts[videoPath];
    }
  }
};

const increaseRef = (videoPath) => {
  inUse[videoPath] = (inUse[videoPath] || 0) + 1;

  // ** Cancel scheduled cleaning if any.
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

// * Make sure the resolved path is inside baseDir
const isPathInside = (parent, child) => {
  // * Calculate relative path from parent to child
  const relative = path.relative(parent, child);

  // return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);

  // ? If same path -> not counted as "inside"
  if (relative === "") return false;

  // ? If it starts with ".." -> means the child is outside the parent
  if (relative.startsWith("..")) return false;

  // ? If it is an absolute path -> also invalid
  if (path.isAbsolute(relative)) return false;

  // ? Otherwise, child is definitely in parent.
  return true;
};

const videoStreaming = asyncHandler(async (req, res) => {
  const { folderName, fileName } = req.query;
  if (!folderName || !fileName) {
    return res.status(400).json({ message: "Missing folderName or fileName" });
  }

  try {
    const savesDir = path.join(__dirname, "../../../saves");
    const videoPath = path.join(savesDir, folderName, fileName);

    const normalized = path.normalize(videoPath);
    if (!isPathInside(savesDir, normalized) && normalized !== path.join(savesDir, folderName, fileName)) {
      console.warn("Attempted path traversal:", videoPath);
      return res.status(400).json({ message: "Invalid file path" });
    }

    if (!fsSync.existsSync(videoPath)) {
      return res.status(404).json({ message: "Video not found" });
    }

    const stat = await fs.stat(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // * Increase the number of references if there are viewers.
    increaseRef(videoPath);

    // * Process the entire file stream (no scope).
    if (!range) {
      const headers = {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
      };
      res.writeHead(200, headers);
      const stream = fsSync.createReadStream(videoPath);

      // * Clean up the event.
      const cleanupAndDecrease = () => {
        try { stream.destroy(); } catch (e) { }
        decreaseRef(videoPath);
      };

      stream.pipe(res);

      req.on("abort", () => {
        console.log("Video stream aborted by client for:", videoPath);
        cleanupAndDecrease();
      });

      stream.on("end", () => {
        console.log("Stream ended for:", videoPath);
        cleanupAndDecrease();
      });

      res.on("close", () => {
        // client closed the connection
        console.log("Response closed for:", videoPath);
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
      console.log("Partial stream ended for:", videoPath, `range ${start}-${end}`);
      cleanupAndDecreaseRange();
    });

    res.on("close", () => {
      console.log("Response closed for (partial):", videoPath);
      cleanupAndDecreaseRange();
    });

    req.on("abort", () => {
      console.log("Video stream aborted by client for (partial):", videoPath);
      cleanupAndDecreaseRange();
    });
  } catch (err) {
    console.error("Video streaming error:", err);
    try { decreaseRef && decreaseRef(); } catch (_) { }   // ? Do not use error.

    if (!res.headersSent) {
      res.status(500).json({ message: "Server error while streaming video", error: err.message });
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