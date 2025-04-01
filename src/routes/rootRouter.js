const express = require("express");

const rootRouter = express.Router();

rootRouter.use("/api/auth", require("./authRouter"));
rootRouter.use("/api/channel", require("./channelRouter"));

module.exports = rootRouter;