const express = require("express");

const authRouter = express.Router();

const passport = require("passport");

const { loginLimiter } = require("../../middlewares/rateLimit");

const authController = require("../../controllers/userController/authController");

authRouter.use(loginLimiter);

authRouter.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));

authRouter.get("/google/callback", passport.authenticate("google", { session: false }), authController.googleAuth);

authRouter.get("/login-success", authController.loginSuccess);

authRouter.post("/logout", authController.logout);

module.exports = authRouter;