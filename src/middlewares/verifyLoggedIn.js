const jwt = require("jsonwebtoken");
const User = require("../models/user/user");

const verifyLoggedIn = async (req, res, next) => {
  try {
    console.log("⏩ Vào middleware verifyLoggedIn");

    const token = req.cookies?.authToken;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired" });
      }
      if (err.name === "JsonWebTokenError") {
        return res.status(401).json({ message: "Invalid token" });
      }
      throw err; // các lỗi khác
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;

    console.log("✅ Xác thực đăng nhập thành công, vào next()");
    next();
  } catch (error) {
    console.error("❌ Lỗi tại middleware verifyLoggedIn:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = verifyLoggedIn;