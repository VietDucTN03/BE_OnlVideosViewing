const jwt = require("jsonwebtoken");
const User = require("../../models/user/user");
const Channel = require("../../models/user/channel");

const googleAuth = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication failed" });
  }

  try {
    const user = await User.findById(req.user._id).populate("channel");

    if (!user.channel) {
      const newChannel = await Channel.create({
        nameChannel: `${user.username}'s Channel`,
        owner: user._id,
      });

      user.channel = newChannel._id;
      await user.save();
    }

    const token = jwt.sign(
      { id: req.user._id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Lưu token vào HTTP-Only Cookie
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 24 * 60 * 60 * 1000, // 1 ngày
    });

    // res.redirect(`${process.env.URL_CLIENT}/${req.user.email}/profile`);

    if (user.role === "admin") {
      res.redirect(`${process.env.URL_CLIENT}/admin`);
    } else {
      res.redirect(`${process.env.URL_CLIENT}/${req.user.email}/profile`);
    }
  } catch (err) {
    console.error("Error in googleAuth:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const loginSuccess = async (req, res) => {
  try {
    const token = req.cookies.authToken;
    if (!token) {
      return res.status(401).json({ error: "No authentication token found" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired. Please log in again." });
      }
      throw err;
    }

    const user = await User.findById(decoded.id).populate("channel");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        typeLogin: user.typeLogin,
        channel: {
          _id: user.channel?._id,
          nameChannel: user.channel?.nameChannel,
          description: user.channel?.description,
          avatarChannel: user.channel?.avatarChannel,
          bannerChannel: user.channel?.bannerChannel,
          subscribersCount: user.channel?.subscribersCount,
          contentTotal: user.channel?.contentTotal?.total,
          viewTotal: user.channel?.viewTotal,
        },
      },
    });
  } catch (error) {
    console.error("Error in login-success:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const logout = (req, res) => {
  try {
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { googleAuth, loginSuccess, logout };
