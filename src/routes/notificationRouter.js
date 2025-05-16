const express = require("express");

const notificationRouter = express.Router();

const notificationController = require("../controllers/notificationController");

notificationRouter.get("/:receiverId", notificationController.getNotificationsByReceiverId);

notificationRouter.put("/:id/read", notificationController.markNotificationAsRead);

notificationRouter.delete("/:id", notificationController.deleteNotification);

module.exports = notificationRouter;