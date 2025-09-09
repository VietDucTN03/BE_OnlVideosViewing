const express = require("express");

const adminRouter = express.Router();

const dashboardController = require("../../controllers/adminController/dashboardController");

const accountController = require("../../controllers/adminController/accountController");

const videoController = require("../../controllers/adminController/videoController");

const shortVideoController = require("../../controllers/adminController/shortVideoController");

const blogController = require("../../controllers/adminController/blogController");

const reportController = require("../../controllers/adminController/reportController");

// ** Payment

const subscriptionController = require("../../controllers/adminController/paymentController/subscriptionController");

const userSubscriptionController = require("../../controllers/adminController/paymentController/userSubscriptionController");

const protect = require("../../middlewares/protect");

const isAdminOrSuperAdmin = require("../../middlewares/isAdminOrSuperAdmin");

const { adminLimiter } = require("../../middlewares/rateLimit");

// adminRouter.use(protect, isAdminOrSuperAdmin);

adminRouter.use(adminLimiter);

//* Dashboard

adminRouter.get("/get-system-stats", protect, isAdminOrSuperAdmin, dashboardController.getSystemStats);

adminRouter.get("/get-user-stats-by-filter", protect, isAdminOrSuperAdmin, dashboardController.getUserStatsByFilter);

adminRouter.get("/get-content-stats-by-filter", protect, isAdminOrSuperAdmin, dashboardController.getContentStatsByFilter);

adminRouter.get("/get-view-stats-by-filter", protect, isAdminOrSuperAdmin, dashboardController.getViewStatsByFilter);

adminRouter.get("/get-comment-stats-by-filter", protect, isAdminOrSuperAdmin, dashboardController.getCommentStatsByFilter);

//* Account

adminRouter.get("/get-account-summary", protect, isAdminOrSuperAdmin, accountController.getAccountSummary);

adminRouter.get("/get-all-accounts", protect, isAdminOrSuperAdmin, accountController.getAllAccounts);

adminRouter.get("/get-account-detail-by-user-id/:userId", protect, isAdminOrSuperAdmin, accountController.getAccountDetailByUserId);

adminRouter.get("/get-all-videos-of-channel/:channelId", protect, isAdminOrSuperAdmin, accountController.getAllVideosByChannelId);

adminRouter.get("/get-all-short-videos-of-channel/:channelId", protect, isAdminOrSuperAdmin, accountController.getAllShortVideosByChannelId);

adminRouter.get("/get-all-blogs-of-channel/:channelId", protect, isAdminOrSuperAdmin, accountController.getAllBlogsByChannelId);

adminRouter.get("/get-report-reviews-by-channel/:channelId", protect, isAdminOrSuperAdmin, accountController.getReportReviewsByChannel);

adminRouter.put("/block-user-if-channel-banned/:userId", protect, isAdminOrSuperAdmin, accountController.blockUserIfChannelBanned);

adminRouter.put("/unblock-user-if-channel-unbanned/:userId", protect, isAdminOrSuperAdmin, accountController.unblockUserIfChannelUnbanned);

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

// ** Payment

// ? Subscription

adminRouter.get("/get-subscription-summary", protect, isAdminOrSuperAdmin, subscriptionController.getSubscriptionSummary);

adminRouter.get("/get-top-subscriptions", protect, isAdminOrSuperAdmin, subscriptionController.getTopSubscriptions);

adminRouter.get("/get-all-subscription-plans", protect, isAdminOrSuperAdmin, subscriptionController.getAllSubscriptionPlans);

adminRouter.post("/create-subscription-plan", protect, isAdminOrSuperAdmin, subscriptionController.createSubscriptionPlan);

adminRouter.get("/get-subscription-by-id/:subscriptionId", protect, isAdminOrSuperAdmin, subscriptionController.getSubscriptionById);

adminRouter.put("/update-subscription-plan/:subscriptionId", protect, isAdminOrSuperAdmin, subscriptionController.updateSubscriptionPlan);

adminRouter.delete("/delete-subscription-plan/:subscriptionId", protect, isAdminOrSuperAdmin, subscriptionController.deleteSubscriptionPlan);

// ? User Subscription

adminRouter.get("/get-user-subscription-history/:userId", protect, isAdminOrSuperAdmin, userSubscriptionController.getUserSubscriptionHistory);

adminRouter.get("/get-user-subscription/:userId/:userSubscriptionId", protect, isAdminOrSuperAdmin, userSubscriptionController.getUserSubscription);

adminRouter.put("/cancel-user-subscription/:userId/:userSubscriptionId", protect, isAdminOrSuperAdmin, userSubscriptionController.cancelUserSubscription);

module.exports = adminRouter;