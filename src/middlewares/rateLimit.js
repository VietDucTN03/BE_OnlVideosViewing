const rateLimit = require("express-rate-limit");

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1000,
  handler: (req, res, next) => {
    next({
      status: 429,
      message: "You sent too many requests, please try again later."
    });
  },
});

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  handler: (req, res, next) => {
    next({
      status: 429,
      message: "Too many login attempts, please wait 1 minute."
    });
  },
});

const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  handler: (req, res, next) => {
    next({
      status: 429,
      message: "Too many admin requests."
    });
  },
});

module.exports = { generalLimiter, loginLimiter, adminLimiter };