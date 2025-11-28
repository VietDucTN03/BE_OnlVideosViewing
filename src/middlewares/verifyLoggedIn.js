const jwt = require("jsonwebtoken");
const User = require("../models/user/user");

const verifyLoggedIn = async (req, res, next) => {
  try {
    console.log("Enter the verifyLoggedIn middleware...");

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
      throw err;
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;

    console.log("Login authentication successful, go to next() middleware...");
    next();
  } catch (error) {
    console.error("Error in verifyLoggedIn middleware:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = verifyLoggedIn;