const express = require("express");

const authRouter = express.Router();

const passport = require("passport");
const authController = require("../controllers/authController");

authRouter.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));

authRouter.get("/google/callback", passport.authenticate("google", { session: false }), authController.googleAuth);

authRouter.get("/login-success", authController.loginSuccess);

authRouter.post("/logout", authController.logout);

module.exports = authRouter;