const jwt = require("jsonwebtoken");
const User = require("../models/user/user");

const protect = async (req, res, next) => {
  try {
    console.log("🛡️ [Protect] Xác thực token từ cookie...");

    const token = req.cookies?.authToken;

    // console.log("Token: ", token);

    if (!token) {
      return res.status(401).json({ message: "Không tìm thấy token xác thực" });
    }

    // Xác thực và giải mã token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password"); // tránh trả password

    if (!user || user.isBlocked) {
      return res.status(401).json({ message: "Tài khoản bị khoá hoặc không tồn tại" });
    }

    // Gắn user đã xác thực vào request để dùng ở các middleware tiếp theo
    req.user = user;

    console.log("✅ [Protect] Xác thực thành công:", user.email);
    next();
  } catch (error) {
    console.error("❌ [Protect] Lỗi xác thực JWT:", error.message);
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};

module.exports = protect;