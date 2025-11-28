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
    messageText = `Your channel has been warned due to 1 report ⚠️`;
  } else if (channel.reportCount === 2 && channel.violationStatus === "warning") {
    update.violationStatus = "banned";
    messageType = "banned";
    messageText = `Your channel has been locked due to 2 reports 🚫`;
  }

  if (Object.keys(update).length > 0) {
    await Channel.updateOne({ _id: channelId }, { $set: update });

    // Send notification to channel owner
    await new Notification({
      receiverId: channel.owner,
      type: messageType,
      message: messageText,
      detailContent: `Channel: ${channel.nameChannel}`,
    }).save();

    io.to(channel.owner.toString()).emit(messageType, {
      receiverId: channel.owner,
      message: messageText,
    });
  }
};

module.exports = checkAndUpdateChannelViolationStatus;