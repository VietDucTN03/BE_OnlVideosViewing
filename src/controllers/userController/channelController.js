const Channel = require("../../models/user/channel");
const asyncHandler = require("express-async-handler");
const { io } = require("../../utils/socket.io/socket");
const { createNotification } = require("../interactionsController/notificationController");

const editChannel = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { nameChannel, description, avatarUrl, bannerUrl } = req.body;

  console.log("👉 Body received from client:", req.body);

  const channel = await Channel.findById(channelId);

  if (!channel) {
    return res.status(404).json({ message: "Channel not found, please try again." });
  }

  // Kiểm tra nameChannel đã tồn tại chưa (ngoại trừ chính channel hiện tại)
  if (nameChannel && nameChannel !== channel.nameChannel) {
    const existingChannel = await Channel.findOne({
      nameChannel: nameChannel,
      _id: { $ne: channelId },
    });

    if (existingChannel) {
      return res.status(400).json({
        message: "The username has existed, please enter another name!!",
        errorField: "nameChannel",
      });
    }

    channel.nameChannel = nameChannel;
  }

  if (description !== undefined) channel.description = description;
  if (avatarUrl !== undefined) channel.avatarChannel = avatarUrl || null;
  if (bannerUrl !== undefined) channel.bannerChannel = bannerUrl || null;

  await channel.save();

  res.status(200).json({
    message: "Channel profile updated successfully.",
    channel,
  });
});

const subscribeToChannel = async (req, res) => {
  const { channelId } = req.params;
  const { userId } = req.body;

  try {
    const channel = await Channel.findById(channelId);
    const sender = await Channel.findById(userId);

    if (!channel) {
      return res.status(404).json({ message: "Channel not found." });
    }

    // Initialize subscribers array if it's not defined
    if (!channel.subscribers) {
      channel.subscribers = [];
    }

    if (channel.subscribers.includes(userId)) {
      return res
        .status(400)
        .json({ message: "User already subscribed to this channel." });
    }

    channel.subscribers.push(userId);
    channel.subscribersCount += 1;

    if (!sender.channelsSubscribed.includes(channelId)) {
      sender.channelsSubscribed.push(channelId);
    }

    await channel.save();
    await sender.save();

    const senderName = sender.nameChannel;

    const avatarSender = sender.avatarChannel;

    // console.log(avatarSender);

    if (userId.toString() !== channelId.toString()) {
      await createNotification({
        receiverId: channelId,
        senderId: userId,
        senderName,
        senderAvatar: avatarSender,
        type: "subscribe",
        message: `${senderName} has subscribed to your channel 🎉`,
        createdAt: new Date(),
      });
    }

    console.log("👉 Successfully subscribed to the channel");

    return res.status(200).json({
      message: "Successfully subscribed to the channel.",
      channel,
    });
  } catch (error) {
    console.error("Error subscribing to channel:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const unsubscribeFromChannel = async (req, res) => {
  const { channelId } = req.params;
  const { userId } = req.body;

  try {
    const channel = await Channel.findById(channelId);
    const sender = await Channel.findById(userId);

    if (!channel) {
      return res.status(404).json({ message: "Channel not found, please try again." });
    }

    if (!channel.subscribers || !channel.subscribers.includes(userId)) {
      return res
        .status(400)
        .json({ message: "User is not subscribed to this channel." });
    }

    // Remove userId from subscribers array
    channel.subscribers = channel.subscribers.filter(
      (subscriber) => subscriber.toString() !== userId.toString()
    );
    channel.subscribersCount -= 1;

    sender.channelsSubscribed = sender.channelsSubscribed.filter(
      (id) => id.toString() !== channelId.toString()
    );

    await channel.save();
    await sender.save();

    console.log("👉 Successfully unsubscribed from the channel");

    return res.status(200).json({
      message: "Successfully unsubscribed from the channel.",
      channel,
    });
  } catch (error) {
    console.error("Error unsubscribing from channel:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getChannelByNameChannel = asyncHandler(async (req, res) => {
  const { nameChannel } = req.params;

  const channel = await Channel.findOne({ nameChannel });

  if (!channel) {
    return res.status(404).json({ message: "Channel not found, please try again." });
  }

  res.status(200).json({ channel });
});

//* Danh sách subsribe của channel
const getListOfChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  try {
    // Lấy channel hiện tại để truy xuất mảng subscribers
    const channel = await Channel.findById(channelId).select("subscribers");

    if (!channel) {
      return res.status(404).json({ message: "Channel not found, please try again." });
    }

    // Lấy thông tin của các channel nằm trong danh sách subscribers
    const subscriberChannels = await Channel.find(
      { _id: { $in: channel.subscribers } },
      "_id nameChannel avatarChannel"
    );

    res.status(200).json({ subscribers: subscriberChannels });
  } catch (error) {
    console.error("Error getting subscribers info:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

const getSubscribedChannelsByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    const channel = await Channel.findById(userId).populate(
      "channelsSubscribed",
      "_id nameChannel avatarChannel"
    );

    if (!channel) {
      return res.status(404).json({ message: "Channel not found, please try again." });
    }

    res.status(200).json({
      message: "List of channels you have subscribed to.",
      subscribedChannels: channel.channelsSubscribed,
    });
  } catch (error) {
    console.error("Error fetching subscribed channels:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = {
  editChannel,
  subscribeToChannel,
  unsubscribeFromChannel,
  getChannelByNameChannel,
  getListOfChannelSubscribers,
  getSubscribedChannelsByUserId,
};
