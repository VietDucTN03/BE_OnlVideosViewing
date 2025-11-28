const jwt = require("jsonwebtoken");
const User = require("../../models/user/user");
const Channel = require("../../models/user/channel");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const sendMail = require("../../utils/sendMail/sendMail");

const changeUserPassword = require("../../services/authServices/changeUserPassword");

const googleAuth = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication failed" });
  }

  try {
    const user = await User.findById(req.user._id).populate("channel");

    if (!user.channel) {
      const newChannel = await Channel.create({
        nameChannel: `${user.username}'s Channel`,
        owner: user._id,
      });

      user.channel = newChannel._id;
      await user.save();
    }

    // * Get current UA and IP
    const ua = req.headers["user-agent"] || "unknown";
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.connection.remoteAddress;

    const token = jwt.sign(
      { id: req.user._id, email: req.user.email, ua, ip },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // * Save token to cookie
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 24 * 60 * 60 * 1000, // 1 ngày
    });

    // res.redirect(`${process.env.URL_CLIENT}/${req.user.email}/profile`);

    if (user.role === "admin") {
      res.redirect(`${process.env.URL_CLIENT}/admin`);
    } else {
      res.redirect(`${process.env.URL_CLIENT}/${req.user.email}/profile`);
    }
  } catch (err) {
    console.error("Error in googleAuth:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const loginSuccess = async (req, res) => {
  try {
    const token = req.cookies.authToken;
    if (!token) {
      return res.status(401).json({ error: "No authentication token found" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired. Please log in again." });
      }
      throw err;
    }

    // * Check if UA + IP matches token?
    const currentUA = req.headers["user-agent"] || "unknown";
    const currentIP =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.connection.remoteAddress;

    if (decoded.ua !== currentUA || decoded.ip !== currentIP) {
      return res
        .status(401)
        .json({ error: "Invalid session environment. Please log in again." });
    }

    const user = await User.findById(decoded.id).populate("channel");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        typeLogin: user.typeLogin,
        isBlocked: user.isBlocked,
        channel: {
          _id: user.channel?._id,
          nameChannel: user.channel?.nameChannel,
          description: user.channel?.description,
          avatarChannel: user.channel?.avatarChannel,
          bannerChannel: user.channel?.bannerChannel,
          isPremium: user.channel?.isPremium,
          subscribersCount: user.channel?.subscribersCount,
          contentTotal: user.channel?.contentTotal?.total,
          viewTotal: user.channel?.viewTotal,
          violationStatus: user.channel?.violationStatus,
        },
      },
    });
  } catch (error) {
    console.error("Error in login-success:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const registerLocal = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Missing inputs" });
    }

    const existedUser = await User.findOne({ email });
    if (existedUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // create verifyToken and expire
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyTokenExpire = Date.now() + 15 * 60 * 1000;  // 15 minutes

    const newUser = await User.create({
      username,
      email,
      password,
      typeLogin: "local",
      isVerified: false,
      verifyToken,
      verifyTokenExpire,
    });

    // const newChannel = await Channel.create({
    //   nameChannel: `${username}'s Channel`,
    //   owner: newUser._id,
    // });

    // newUser.channel = newChannel._id;
    // await newUser.save();

    // * Send verify email
    const verifyLink = `${process.env.URL_SERVER || process.env.NGROK}/api/auth/verify-email?token=${verifyToken}`;

    await sendMail({
      from: `"Support" <${process.env.EMAIL_NAME}>`,
      email: newUser.email,
      subject: "Confirm your account ✔",
      html: `
        <div style="max-width:600px;margin:auto;font-family:sans-serif;border-radius:8px;overflow:hidden;background:#f0fdfa;">
          <div style="background:linear-gradient(90deg,#14b8a6,#06b6d4);color:white;padding:24px;text-align:center;">
            <h2 style="margin:0;font-size:24px;">Metube</h2>
          </div>
          <div style="padding:24px;">
            <h3 style="color:#0f172a;margin-top:0;">Welcome ${username}!</h3>
            <p style="color:#334155;line-height:1.6;">
              You have just successfully registered an account. To activate and use all the features, please verify your email by clicking the button below:
            </p>
            <a href="${verifyLink}" target="_blank" style="display:inline-block; padding: 12px 25px; background: #4CAF50; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 6px;">
              Verify account
            </a>
            <p style="color:#334155;line-height:1.6;">
              This link will expire in <b>15 minutes</b>.<br>
              If you did not register, please ignore this email.
            </p>
            <p style="color:#64748b;font-size:14px;">
              This is an automated email, please do not reply. If you need assistance, please contact our Support department.
            </p>
          </div>
          <div style="background:#e0f2fe;color:#334155;padding:18px;text-align:center;font-size:13px;">
            &copy; ${new Date().getFullYear()} Your Platform Name. All rights reserved.
          </div>
        </div>
      `,
    });

    return res.status(201).json({
      message: "Register successfully. Please check your email to verify your account.",
    });
  } catch (error) {
    console.error("Error in registerLocal:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) return res.status(400).json({ error: "Missing token" });

    const user = await User.findOne({
      verifyToken: token,
      verifyTokenExpire: { $gt: Date.now() },
    });

    // if (!user) {
    //   return res.status(400).json({ error: "Invalid or expired token" });
    // }

    if (!user) return res.redirect(`${process.env.URL_CLIENT}/login`);

    user.isVerified = true;
    user.verifyToken = undefined;
    user.verifyTokenExpire = undefined;
    await user.save();

    if (!user.channel) {
      const newChannel = await Channel.create({
        nameChannel: `${user.username}'s Channel`,
        owner: user._id,
      });
      user.channel = newChannel._id;
      await user.save();
    }

    res.cookie("verify_status", "success", {
      httpOnly: false,
      maxAge: 5000,
    });

    return res.redirect(`${process.env.URL_CLIENT}/login`);
  } catch (error) {
    console.error("Error in verifyEmail:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const loginLocal = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const user = await User.findOne({ email }).populate("channel");
    if (!user) {
      return res.status(400).json({ error: "Email not registered, please sign up first." });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: "Please verify your email before logging in" });
    }

    // * Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Wrong password, try again." });
    }

    const ua = req.headers["user-agent"] || "unknown";
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.connection.remoteAddress;

    const token = jwt.sign(
      { id: user._id, email: user.email, ua, ip },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Login success",
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        typeLogin: user.typeLogin,
        isBlocked: user.isBlocked,
        channel: {
          _id: user.channel?._id,
          nameChannel: user.channel?.nameChannel,
          description: user.channel?.description,
          avatarChannel: user.channel?.avatarChannel,
          bannerChannel: user.channel?.bannerChannel,
          isPremium: user.channel?.isPremium,
          subscribersCount: user.channel?.subscribersCount,
          contentTotal: user.channel?.contentTotal?.total,
          viewTotal: user.channel?.viewTotal,
          violationStatus: user.channel?.violationStatus,
        },
      },
    });
  } catch (error) {
    console.error("Error in loginLocal:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email, typeLogin: "local" });
    if (!user) {
      return res.status(404).json({ error: "No local account is found with this email." });
    }

    // * Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save();

    const resetLink = `${process.env.URL_SERVER}/api/auth/verify-reset-password?token=${resetToken}`;

    await sendMail({
      from: `"Support" <${process.env.EMAIL_NAME}>`,
      email: user.email,
      subject: "Password change request",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;">
          <h2>Reset password</h2>
          <p>You have just requested a password change. Click the link below to set a new password:</p>
          <a href="${resetLink}" target="_blank" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">Reset password</a>
          <pThis link will expire in 15 minutes.</p>
        </div>
      `,
    });

    res.json({ message: "Reset password link sent to your email" });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const verifyResetPassword = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Missing token" });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) return res.redirect(`${process.env.URL_CLIENT}/login`);

    res.cookie("resetToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000,
    });

    return res.redirect(`${process.env.URL_CLIENT}/reset-password`);
  } catch (error) {
    console.error("Error in verifyResetPassword:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;

    const token = req.cookies.resetToken;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpire: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: "Invalid or expired token" });

    await changeUserPassword({ user, newPassword: password, isForgotMode: true, token });

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.clearCookie("resetToken");

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    await changeUserPassword({ user, oldPassword, newPassword, isForgotMode: false });
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const logout = (req, res) => {
  try {
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  googleAuth,
  loginSuccess,
  registerLocal,
  verifyEmail,
  loginLocal,
  forgotPassword,
  verifyResetPassword,
  resetPassword,
  updatePassword,
  logout
};
