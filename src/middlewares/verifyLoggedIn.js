const jwt = require("jsonwebtoken");
const User = require("../models/user/user");

const verifyLoggedIn = async (req, res, next) => {
  try {
    console.log("⏩ Vào middleware verifyLoggedIn");

    const token = req.cookies?.authToken;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Giải mã token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Tìm user trong DB
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Gắn thông tin user vào request để dùng ở controller
    req.user = user;

    console.log("✅ Xác thực đăng nhập thành công, vào next()");
    next();
  } catch (error) {
    console.error("❌ Lỗi tại middleware verifyLoggedIn:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = verifyLoggedIn;