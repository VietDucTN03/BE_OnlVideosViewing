const express = require("express");

const rootRouter = express.Router();

rootRouter.use("/api/auth", require("./roleRouter/authRouter"));
rootRouter.use("/api/channel", require("./roleRouter/channelRouter"));
rootRouter.use("/api/video", require("./contentRouter/videoRouter"));
rootRouter.use("/api/short-video", require("./contentRouter/shortVideoRouter"));
rootRouter.use("/api/blog", require("./contentRouter/blogRouter"));
rootRouter.use("/api/status", require("./interactionsRouter/statusRouter"));
rootRouter.use("/api/comment", require("./interactionsRouter/commentRouter"));
rootRouter.use("/api/notifications", require("./interactionsRouter/notificationRouter"));
rootRouter.use("/api/playlist", require("./contentRouter/playlistRouter"));
rootRouter.use("/api/view-history", require("./userActivityRouter/viewHistoryRouter"));

rootRouter.use("/api/report", require("./interactionsRouter/reportRouter"));

rootRouter.use("/api/search", require("./searchRouter"));

rootRouter.use("/api/subscription", require("./paymentRouter/subscriptionRouter"));

//* Role Router
rootRouter.use("/api/admin", require("./roleRouter/adminRouter"));

module.exports = rootRouter;