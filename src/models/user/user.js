const mongoose = require('mongoose');
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        // unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: function () {
            return this.typeLogin === "local";
        },
    },
    avatar: {
        public_id: String,
        url: String
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    typeLogin: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    channel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Channel",
    },

    // TODO: Account verification (email is real)
    isVerified: {
        type: Boolean,
        default: false
    },
    verifyToken: String,
    verifyTokenExpire: Date,

    // TODO: Support login / refresh token
    refreshToken: String,

    // TODO: password change service (when user changes password)
    passwordChangedAt: Date,

    // TODO: forgot password service
    resetPasswordToken: String,
    resetPasswordExpire: Date,
}, {
    timestamps: true
});

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();  // * If you do not change the password, the code below will be ignored and not executed.
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// * Password comparison method when logging in
userSchema.methods.isCorrectPassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);