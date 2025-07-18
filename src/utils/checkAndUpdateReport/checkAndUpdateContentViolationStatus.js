const Channel = require("../../models/user/channel");
const Notification = require("../../models/interactions/notification");
const { io } = require("../socket.io/socket");

const { checkAndUpdateChannelViolationStatus } = require("./checkAndUpdateChannelViolationStatus");

const checkAndUpdateContentViolationStatus = async ({ content, Model, uploaderField }) => {

  // console.log("Model:", Model.modelName);

  let updateContent = {};

  // Fetch uploader
  const uploaderId = content[uploaderField];

  if (Number(content.reportCount) === 1 && content.violationStatus === "normal") {
    updateContent.violationStatus = "warning";

    // Gửi thông báo vi phạm cảnh báo
    await new Notification({
      receiverId: uploaderId,
      type: "warning",
      message: `Nội dung (${Model.modelName}): ${content.title || content._id} của bạn đã vi phạm chính sách và bị cảnh báo ⚠️`,
      detailContent: `Nội dung (${Model.modelName}): ${content.title || content._id}`,
    }).save();

    io.to(uploaderId.toString()).emit("warning", {
      receiverId: uploaderId,
      message: `Nội dung (${Model.modelName}): ${content.title || content._id} của bạn đã vi phạm chính sách và bị cảnh báo ⚠️`,
    });

  } else if (Number(content.reportCount) === 2 && content.violationStatus === "warning") {
    updateContent.violationStatus = "banned";
    updateContent.isBanned = true;

    // Tăng reportCount trên Channel uploader
    await Channel.updateOne(
      { _id: uploaderId },
      { $inc: { reportCount: 1 } }
    );

    await checkAndUpdateChannelViolationStatus(uploaderId);
  }
  
  console.log("content:", content);

  // Cập nhật content nếu có thay đổi
  if (Object.keys(updateContent).length > 0) {
    await Model.updateOne(
      { _id: content._id },
      { $set: updateContent }
    );
  }
};

module.exports = checkAndUpdateContentViolationStatus;