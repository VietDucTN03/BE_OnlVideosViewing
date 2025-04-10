const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Channel = require("../models/channel");

const googleAuth = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication failed" });
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
    maxAge: 24 * 60 * 60 * 1000,  // 1 ngày
  });

  res.redirect(`${process.env.URL_CLIENT}/${req.user.email}/profile`);
};

const loginSuccess = async (req, res) => {
  try {
    const token = req.cookies.authToken; // Lấy JWT từ Cookie
    if (!token) {
      return res.status(401).json({ error: "No authentication token found" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired. Please log in again.' });
      }
      throw err;
    }

    const user = await User.findById(decoded.id).populate("channel"); // Lấy thông tin channel

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
        channel: user.channel, // Trả về thông tin channel
      }
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

