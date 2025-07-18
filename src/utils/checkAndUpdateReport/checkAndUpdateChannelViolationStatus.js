const Channel = require("../../models/user/channel");
const Notification = require("../../models/interactions/notification");
const { io } = require("../socket.io/socket");

const checkAndUpdateChannelViolationStatus = async (channelId) => {
  const channel = await Channel.findById(channelId);
  if (!channel) return;

  let update = {};
  let messageType = null;
  let messageText = "";

  if (channel.reportCount === 1 && channel.violationStatus === "normal") {
    update.violationStatus = "warning";
    messageType = "warning";
    messageText = `Kênh của bạn đã bị cảnh báo do có 1 lượt báo cáo ⚠️`;
  } else if (channel.reportCount === 2 && channel.violationStatus === "warning") {
    update.violationStatus = "banned";
    messageType = "ban";
    messageText = `Kênh của bạn đã bị khóa do có 2 lượt báo cáo 🚫`;
  }

  if (Object.keys(update).length > 0) {
    await Channel.updateOne({ _id: channelId }, { $set: update });

    // Gửi notification cho chủ kênh
    await new Notification({
      receiverId: channel.owner,
      type: messageType,
      message: messageText,
      detailContent: `Kênh: ${channel.nameChannel}`,
    }).save();

    io.to(channel.owner.toString()).emit(messageType, {
      receiverId: channel.owner,
      message: messageText,
    });
  }
};

module.exports = checkAndUpdateChannelViolationStatus;