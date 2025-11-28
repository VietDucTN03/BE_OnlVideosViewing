const jwt = require("jsonwebtoken");
const User = require("../models/user/user");

const protect = async (req, res, next) => {
  try {
    console.log("[Protect] Authenticate token from cookie...");

    const token = req.cookies?.authToken;

    // console.log("Token: ", token);

    if (!token) {
      return res.status(401).json({ message: "Authentication token not found." });
    }

    // Token authentication and decryption
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password"); // avoid giving password

    if (!user || user.isBlocked) {
      return res.status(401).json({ message: "Account is locked or does not exist." });
    }

    // Attach the authenticated user to the request for use in subsequent middleware.
    req.user = user;

    console.log("[Protect] Authentication successful:", user.email);
    next();
  } catch (error) {
    console.error("[Protect] JWT authentication error:", error.message);
    return res.status(401).json({ message: "Token is invalid or expired." });
  }
};

module.exports = protect;