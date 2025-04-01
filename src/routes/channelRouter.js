const express = require("express");

const channelRouter = express.Router();

const channelController = require("../controllers/channelController");

channelRouter.post("/", channelController.editChannel);

module.exports = channelRouter;