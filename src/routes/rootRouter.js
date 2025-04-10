const express = require("express");

const rootRouter = express.Router();

rootRouter.use("/api/auth", require("./authRouter"));
rootRouter.use("/api/channel", require("./channelRouter"));
rootRouter.use("/api/video", require("./videoRouter"));

module.exports = rootRouter;