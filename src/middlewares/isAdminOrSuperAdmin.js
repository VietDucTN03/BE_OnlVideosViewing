const asyncHandler = require("express-async-handler");
const User = require("../models/user/user");

const isAdminOrSuperAdmin = asyncHandler(async (req, res, next) => {
  const userId = req.user?._id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await User.findById(userId);
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }

  next();
});

module.exports = isAdminOrSuperAdmin;