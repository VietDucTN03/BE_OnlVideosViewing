const Channel = require("../../models/user/channel");
const Notification = require("../../models/interactions/notification");
const { io } = require("../socket.io/socket");

const checkAndUpdateChannelViolationStatus = require("./checkAndUpdateChannelViolationStatus");

const checkAndUpdateContentViolationStatus = async ({ content, Model, uploaderField }) => {

  // console.log("Model:", Model.modelName);

  let updateContent = {};

  // Fetch uploader
  const uploaderId = content[uploaderField];

  if (Number(content.reportCount) === 1 && content.violationStatus === "normal") {
    updateContent.violationStatus = "warning";

    // Send warning violation notice
    await new Notification({
      receiverId: uploaderId,
      type: "warning",
      message: `Your content (${Model.modelName}): ${content.title || content._id} violated the policy and was warned!`,
      detailContent: `Nội dung (${Model.modelName}): ${content.title || content._id}`,
    }).save();

    io.to(uploaderId.toString()).emit("warning", {
      receiverId: uploaderId,
      message: `Your content (${Model.modelName}): ${content.title || content._id} violated the policy and was warned!`,
    });

  } else if (Number(content.reportCount) === 2 && content.violationStatus === "warning") {
    updateContent.violationStatus = "banned";
    updateContent.isBanned = true;

    // Increase reportCount on Channel uploader
    await Channel.updateOne(
      { _id: uploaderId },
      { $inc: { reportCount: 1 } }
    );

    // Send notification of banned content
    await new Notification({
      receiverId: uploaderId,
      type: "banned",
      message: `Content (${Model.modelName}): ${content.title || content._id} has been removed from the system due to serious violations!`,
      detailContent: `Nội dung (${Model.modelName}): ${content.title || content._id}`,
    }).save();

    io.to(uploaderId.toString()).emit("banned", {
      receiverId: uploaderId,
      message: `Content (${Model.modelName}): ${content.title || content._id} has been removed from the system due to serious violations!`,
    });

    await checkAndUpdateChannelViolationStatus(uploaderId);
  }
  
  console.log("content:", content);

  // Update content if there are changes
  if (Object.keys(updateContent).length > 0) {
    await Model.updateOne(
      { _id: content._id },
      { $set: updateContent }
    );
  }
};

module.exports = checkAndUpdateContentViolationStatus;