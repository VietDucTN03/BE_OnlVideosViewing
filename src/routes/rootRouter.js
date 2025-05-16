const express = require("express");

const rootRouter = express.Router();

rootRouter.use("/api/auth", require("./authRouter"));
rootRouter.use("/api/channel", require("./channelRouter"));
rootRouter.use("/api/video", require("./videoRouter"));
rootRouter.use("/api/short-video", require("./shortVideoRouter"));
rootRouter.use("/api/blog", require("./blogRouter"));
rootRouter.use("/api/comment", require("./commentRouter"));
rootRouter.use("/api/notifications", require("./notificationRouter"));
rootRouter.use("/api/playlist", require("./playlistRouter"));
rootRouter.use("/api/view-history", require("./viewHistoryRouter"));

module.exports = rootRouter;