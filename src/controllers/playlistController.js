const asyncHandler = require("express-async-handler");
const Playlist = require("../models/playlist");
const Video = require("../models/video");
const Channel = require("../models/channel");

const getPlaylistsByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId." });
  }

  const user = await Channel.findById(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const playlists = await Playlist.find({ owner: userId })
    .sort({ createdAt: -1 })
    .populate({
      path: "videos.video",
      select: "title thumbnail",
    });

  res.status(200).json({ playlists });
});

const getPlaylistsByChannelId = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId) {
    return res.status(400).json({ error: "Missing channelId." });
  }

  const channel = await Channel.findById(channelId);
  if (!channel) {
    return res.status(404).json({ error: "Channel not found." });
  }

  const playlists = await Playlist.find({ owner: channelId, isPrivate: false })
    .sort({ createdAt: -1 })
    .populate({
      path: "videos.video",
      select: "title thumbnail",
    });

  res.status(200).json({ playlists });
});

const getPlaylistInfo = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!playlistId) {
    return res.status(400).json({ error: "Missing playlistId." });
  }

  const playlist = await Playlist.findById(playlistId).populate({
    path: "videos.video",
    select: "title description thumbnail",
  });

  if (!playlist) {
    return res.status(404).json({ error: "Playlist not found." });
  }

  res.status(200).json({ playlist });
});

const editPlaylistInVideoInfo = asyncHandler(async ({ videoId, playlistId, action }) => {
  if (!videoId || !playlistId || !["add", "remove"].includes(action)) {
    throw new Error("Missing or invalid videoId, playlistId, or action.");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new Error("Video not found.");
  }

  const playlistIdStr = playlistId.toString();

  if (action === "add") {
    const exists = video.playList.some(id => id.toString() === playlistIdStr);
    if (!exists) {
      video.playList.push(playlistId);
    }
  }

  if (action === "remove") {
    video.playList = video.playList.filter(id => id.toString() !== playlistIdStr);
  }

  await video.save();
});

const createPlaylist = asyncHandler(async (req, res) => {
  const { title, description, isPrivate, videoId, userId } = req.body;

  if (!title || !description || !userId) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const user = await Channel.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found." });

  let videos = [];
  if (videoId) {
    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ error: "Video not found." });

    videos.push({
      video: video._id,
      addedAt: new Date(),
    });
  }

  const newPlaylist = new Playlist({
    titlePlaylist: title,
    description,
    isPrivate,
    owner: user._id,
    videos,
  });

  if (videoId) {
    await editPlaylistInVideoInfo({ videoId, playlistId: newPlaylist._id, action: "add" });
  }  

  await newPlaylist.save();
  res.status(201).json({ message: "Playlist created", playlist: newPlaylist });
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.body;

  if (!playlistId || !videoId) {
    return res.status(400).json({ error: "Missing playlistId or videoId." });
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) return res.status(404).json({ error: "Playlist not found." });

  const video = await Video.findById(videoId);
  if (!video) return res.status(404).json({ error: "Video not found." });

  const alreadyExists = playlist.videos.some(
    (item) => item.video.toString() === videoId
  );
  if (alreadyExists) {
    return res
      .status(200)
      .json({ message: "Video already in playlist", playlist });
  }

  playlist.videos.push({ video: video._id, addedAt: new Date() });

  await editPlaylistInVideoInfo({ videoId, playlistId, action: "add" });

  await playlist.save();

  res.status(200).json({ message: "Video added to playlist", playlist });
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.body;

  if (!playlistId || !videoId) {
    return res.status(400).json({ error: "Missing playlistId or videoId." });
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    return res.status(404).json({ error: "Playlist not found." });
  }

  const originalLength = playlist.videos.length;

  playlist.videos = playlist.videos.filter(
    (item) => item.video.toString() !== videoId
  );

  // if (playlist.videos.length === originalLength) {
  //   return res.status(404).json({ error: "Video not found in playlist." });
  // }

  await editPlaylistInVideoInfo({ videoId, playlistId, action: "remove" });

  await playlist.save();

  res.status(200).json({
    message: "Video removed from playlist successfully.",
    playlist,
  });
});

const editPlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { title, description, isPrivate } = req.body;

  if (!playlistId) {
    return res.status(400).json({ error: "Missing playlistId." });
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    return res.status(404).json({ error: "Playlist not found." });
  }

  if (title !== undefined) playlist.titlePlaylist = title;
  if (description !== undefined) playlist.description = description;
  if (isPrivate !== undefined) playlist.isPrivate = isPrivate;

  await playlist.save();

  res.status(200).json({
    message: "Playlist updated successfully.",
    playlist,
  });
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!playlistId) {
    return res.status(400).json({ error: "Missing playlistId." });
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    return res.status(404).json({ error: "Playlist not found." });
  }

  await Playlist.findByIdAndDelete(playlistId);

  await Video.updateMany(
    { playList: playlistId },
    { $pull: { playList: playlistId } }
  );

  res.status(200).json({ playlist, message: `Playlist ${playlist.titlePlaylist} deleted successfully and removed from videos.` });
});

module.exports = {
  getPlaylistsByUserId,
  getPlaylistsByChannelId,
  getPlaylistInfo,
  createPlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  editPlaylist,
  deletePlaylist,
};
