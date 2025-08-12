const rateLimit = require("express-rate-limit");

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1000,
  handler: (req, res, next) => {
    next({
      status: 429,
      message: "Bạn gửi quá nhiều yêu cầu, vui lòng thử lại sau."
    });
  },
});

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  handler: (req, res, next) => {
    next({
      status: 429,
      message: "Quá nhiều lần đăng nhập, vui lòng đợi 1 phút."
    });
  },
});

const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  handler: (req, res, next) => {
    next({
      status: 429,
      message: "Quá nhiều yêu cầu admin."
    });
  },
});

module.exports = { generalLimiter, loginLimiter, adminLimiter };