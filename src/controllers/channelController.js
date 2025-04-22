const Channel = require("../models/channel");
const asyncHandler = require("express-async-handler");

const editChannel = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { nameChannel, description, avatarUrl, bannerUrl } = req.body;

  console.log("👉 Body received from client:", req.body);

  const channel = await Channel.findById(channelId);

  if (!channel) {
    return res.status(404).json({ message: "Channel not found" });
  }

  if (nameChannel !== undefined) channel.nameChannel = nameChannel;
  if (description !== undefined) channel.description = description;
  if (avatarUrl !== undefined) channel.avatarChannel = avatarUrl || null;
  if (bannerUrl !== undefined) channel.bannerChannel = bannerUrl || null;

  await channel.save();

  res.status(200).json({
    message: "Channel profile updated successfully",
    channel,
  });
});

module.exports = {
  editChannel,
};
