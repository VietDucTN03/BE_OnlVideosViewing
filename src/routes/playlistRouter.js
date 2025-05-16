const express = require("express");

const playlistRouter = express.Router();

const playlistController = require("../controllers/playlistController");

playlistRouter.get("/get-playlist/:userId", playlistController.getPlaylistsByUserId);

playlistRouter.get("/get-playlist-of-channel/:channelId", playlistController.getPlaylistsByChannelId);

playlistRouter.get("/get-playlist-info/:playlistId", playlistController.getPlaylistInfo);

playlistRouter.post("/create-playlist", playlistController.createPlaylist);

playlistRouter.put("/:playlistId/add-video", playlistController.addVideoToPlaylist);

playlistRouter.put("/:playlistId/remove-video", playlistController.removeVideoFromPlaylist);

playlistRouter.put("/edit-playlist/:playlistId", playlistController.editPlaylist);

playlistRouter.delete("/delete-playlist/:playlistId", playlistController.deletePlaylist);

module.exports = playlistRouter;