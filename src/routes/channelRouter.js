const express = require("express");

const channelRouter = express.Router();

const channelController = require("../controllers/channelController");

const verifyChannelOwnership = require("../middlewares/verifyChannelOwnership");

channelRouter.put("/edit-profile/:channelId", verifyChannelOwnership, channelController.editChannel);

channelRouter.post("/subscribe/:channelId", channelController.subscribeToChannel);

channelRouter.delete("/unsubscribe/:channelId", channelController.unsubscribeFromChannel);

channelRouter.get("/get-channel-by-name/:nameChannel", channelController.getChannelByNameChannel);

module.exports = channelRouter;
