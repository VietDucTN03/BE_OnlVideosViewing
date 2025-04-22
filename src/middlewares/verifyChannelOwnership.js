const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Channel = require("../models/channel");

const verifyChannelOwnership = async (req, res, next) => {
  try {
    console.log("⏩ Vào middleware verifyChannelOwnership");
    const token = req.cookies?.authToken;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Lấy user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Lấy channelId từ params, body hoặc query
    const channelId = req.params.channelId || req.query.channelId;

    if (!channelId) {
      return res.status(400).json({ message: "Channel ID is required" });
    }

    const channel = await Channel.findById(channelId);

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Kiểm tra quyền sở hữu
    if (!channel.owner.equals(user._id)) {
      return res.status(403).json({ message: "Not authorized to edit this channel" });
    }

    req.user = user;
    req.channel = channel;

    console.log("Check thành cộng tại middleware verifyChannelOwnership ✅, vào next");

    next();
  } catch (error) {
    console.error("Error in verifyChannelOwnership middleware:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = verifyChannelOwnership;