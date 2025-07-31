const express = require("express");

const adminRouter = express.Router();

const accountController = require("../../controllers/adminController/accountController");

const videoController = require("../../controllers/adminController/videoController");

const shortVideoController = require("../../controllers/adminController/shortVideoController");

const blogController = require("../../controllers/adminController/blogController");

const reportController = require("../../controllers/adminController/reportController");

const protect = require("../../middlewares/protect");

const isAdminOrSuperAdmin = require("../../middlewares/isAdminOrSuperAdmin");

const { adminLimiter } = require("../../middlewares/rateLimit");

// adminRouter.use(protect, isAdminOrSuperAdmin);

adminRouter.use(adminLimiter);

adminRouter.get("/get-account-summary", protect, isAdminOrSuperAdmin, accountController.getAccountSummary);

adminRouter.get("/get-all-accounts", protect, isAdminOrSuperAdmin, accountController.getAllAccounts);

adminRouter.get("/get-account-detail-by-user-id/:userId", protect, isAdminOrSuperAdmin, accountController.getAccountDetailByUserId);

adminRouter.get("/get-all-videos-of-channel/:channelId", protect, isAdminOrSuperAdmin, accountController.getAllVideosByChannelId);

adminRouter.get("/get-all-short-videos-of-channel/:channelId", protect, isAdminOrSuperAdmin, accountController.getAllShortVideosByChannelId);

adminRouter.get("/get-all-blogs-of-channel/:channelId", protect, isAdminOrSuperAdmin, accountController.getAllBlogsByChannelId);

adminRouter.get("/get-report-reviews-by-channel/:channelId", protect, isAdminOrSuperAdmin, accountController.getReportReviewsByChannel);

adminRouter.put("/block-user-if-channel-banned/:userId", protect, isAdminOrSuperAdmin, accountController.blockUserIfChannelBanned);

//* Video

adminRouter.get("/get-video-stats", protect, isAdminOrSuperAdmin, videoController.getVideoStats);

adminRouter.get("/get-all-videos", protect, isAdminOrSuperAdmin, videoController.getAllVideos);

adminRouter.get("/get-video-by-id/:videoId", protect, isAdminOrSuperAdmin, videoController.getVideoById);

adminRouter.get("/get-reports-by-video-id/:videoId", protect, isAdminOrSuperAdmin, videoController.getReportsByVideoId);

adminRouter.delete("/delete-video-by-id/:videoId", protect, isAdminOrSuperAdmin, videoController.deleteVideoById);

// * Short Video

adminRouter.get("/get-short-video-stats", protect, isAdminOrSuperAdmin, shortVideoController.getShortVideoStats);

adminRouter.get("/get-all-short-videos", protect, isAdminOrSuperAdmin, shortVideoController.getAllShortVideos);

adminRouter.get("/get-short-video-by-id/:shortVideoId", protect, isAdminOrSuperAdmin, shortVideoController.getShortVideoById);

adminRouter.get("/get-reports-by-short-video-id/:shortVideoId", protect, isAdminOrSuperAdmin, shortVideoController.getReportsByShortVideoId);

adminRouter.delete("/delete-short-video-by-id/:shortVideoId", protect, isAdminOrSuperAdmin, shortVideoController.deleteShortVideoById);

// * Blog

adminRouter.get("/get-blog-stats", protect, isAdminOrSuperAdmin, blogController.getBlogStats);

adminRouter.get("/get-all-blogs", protect, isAdminOrSuperAdmin, blogController.getAllBlogs);

adminRouter.get("/get-blog-by-id/:blogId", protect, isAdminOrSuperAdmin, blogController.getBlogById);

adminRouter.get("/get-reports-by-blog-id/:blogId", protect, isAdminOrSuperAdmin, blogController.getReportsByBlogId);

adminRouter.delete("/delete-blog-by-id/:blogId", protect, isAdminOrSuperAdmin, blogController.deleteBlogById);

// * Report

adminRouter.get("/get-report-review-stats", protect, isAdminOrSuperAdmin, reportController.getReportReviewStats);

adminRouter.get("/get-all-report-reviews", protect, isAdminOrSuperAdmin, reportController.getAllReportReviews);

adminRouter.get("/get-report-review-by-id/:reportId", protect, isAdminOrSuperAdmin, reportController.getReportReviewById);

// adminRouter.put("/resolve-video-report/:reportId", protect, isAdminOrSuperAdmin, reportController.resolveVideoReport);

adminRouter.put("/resolve-report-review/:reportId", protect, isAdminOrSuperAdmin, reportController.resolveReportReview);

module.exports = adminRouter;