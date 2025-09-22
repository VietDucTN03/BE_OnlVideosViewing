const express = require("express");

const authRouter = express.Router();

const passport = require("passport");

const { loginLimiter } = require("../../middlewares/rateLimit");

const verifyLoggedIn = require("../../middlewares/verifyLoggedIn");

const authController = require("../../controllers/userController/authController");

// authRouter.use(loginLimiter);

// * Google Auth

authRouter.get("/google", loginLimiter, passport.authenticate("google", { scope: ["profile", "email"], session: false }));

authRouter.get("/google/callback", passport.authenticate("google", { session: false }), authController.googleAuth);

authRouter.get("/login-success", authController.loginSuccess);

// * Local Auth

authRouter.post("/register-local", loginLimiter, authController.registerLocal);

authRouter.get("/verify-email", authController.verifyEmail);

authRouter.post("/login-local", loginLimiter, authController.loginLocal);

// * Change Password

authRouter.post("/forgot-password", authController.forgotPassword);

authRouter.get("/verify-reset-password", authController.verifyResetPassword);

authRouter.post("/reset-password", authController.resetPassword);

authRouter.post("/update-password", verifyLoggedIn, authController.updatePassword);

authRouter.post("/logout", authController.logout);

module.exports = authRouter;