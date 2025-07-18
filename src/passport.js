const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();
const passport = require("passport");
const User = require("./models/user/user");
const Channel = require("./models/user/channel");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.URL_SERVER}/api/auth/google/callback`,
      scope: ["profile", "email"],
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        if (!profile?.id || !profile?.emails?.length) {
          return done(new Error("Invalid Google profile data"), null);
        }

        const email = profile.emails[0].value;

        // Tìm hoặc tạo người dùng
        const user = await User.findOneAndUpdate(
          { email },
          {
            username: profile.displayName,
            email,
            avatar: { url: profile.photos?.[0]?.value || null },
            typeLogin: "google",
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        // Kiểm tra xem người dùng có channel chưa
        if (!user.channel) {
          const channel = await Channel.create({ owner: user._id });

          // Cập nhật user với channel vừa tạo
          user.channel = channel._id;
          await user.save();
        }

        console.log("User after Google login:", user);
        return done(null, user);
      } catch (error) {
        console.error("Google Auth Error:", error);
        return done(error, null);
      }
    }
  )
);

// Serialize & Deserialize User
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
