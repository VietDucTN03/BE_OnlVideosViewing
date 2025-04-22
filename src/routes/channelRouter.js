const express = require("express");

const channelRouter = express.Router();

const channelController = require("../controllers/channelController");

const verifyChannelOwnership = require("../middlewares/verifyChannelOwnership");

channelRouter.put("/edit-profile/:channelId", verifyChannelOwnership, channelController.editChannel);

module.exports = channelRouter;
