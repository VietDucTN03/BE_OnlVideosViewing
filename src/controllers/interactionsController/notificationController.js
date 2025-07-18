const Notification = require("../../models/interactions/notification");
const asyncHandler = require("express-async-handler");

const getNotificationsByReceiverId = asyncHandler(async (req, res) => {
  const { receiverId } = req.params;

  if (!receiverId) {
    return res.status(400).json({ message: "Receiver ID is required" });
  }

  const notifications = await Notification.find({ receiverId }).sort({
    createdAt: -1,
  });

  // console.log("Notifications:", notifications);

  res.status(200).json({ 
    message: "Notifications fetched successfully",
    notifications 
  });
});

const createNotification = async ({ receiverId, senderId, senderName, senderAvatar, type, message, detailContent, createdAt }) => {
  const notification = new Notification({
    receiverId,
    senderId,
    senderName,
    senderAvatar,
    type,
    message,
    detailContent,
    createdAt,
  });

  await notification.save();

  // res.status(200).json({ message: "Notification saved successfully" });
};

const markNotificationAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);

  if (!notification) {
    return res.status(404).json({ message: "Notification not found" });
  }

  notification.isRead = true;
  await notification.save();

  res.status(200).json({ message: "Notification marked as read" });
});

const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);

  if (!notification) {
    return res.status(404).json({ message: "Notification not found" });
  }

  await notification.deleteOne();

  res.status(200).json({ message: "Notification deleted successfully" });
});

module.exports = {
  getNotificationsByReceiverId,
  createNotification,
  markNotificationAsRead,
  deleteNotification,
};
