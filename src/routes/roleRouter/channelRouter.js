const express = require("express");

const channelRouter = express.Router();

const channelController = require("../../controllers/userController/channelController");

const verifyChannelOwnership = require("../../middlewares/verifyChannelOwnership");

channelRouter.put("/edit-profile/:channelId", verifyChannelOwnership, channelController.editChannel);

channelRouter.post("/subscribe/:channelId", channelController.subscribeToChannel);

channelRouter.delete("/unsubscribe/:channelId", channelController.unsubscribeFromChannel);

channelRouter.get("/get-channel-by-name/:nameChannel", channelController.getChannelByNameChannel);

channelRouter.get("/get-subscribed-channels/:channelId", channelController.getListOfChannelSubscribers);

channelRouter.get("/get-subscribed-channels-by-userId/:userId", channelController.getSubscribedChannelsByUserId);

module.exports = channelRouter;
