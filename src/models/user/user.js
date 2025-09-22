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

    // TODO: xác nhân tài khoản (email là real)
    isVerified: {
        type: Boolean,
        default: false
    },
    verifyToken: String,
    verifyTokenExpire: Date,

    // TODO: hỗ trợ đăng nhập / refresh token
    refreshToken: String,

    // TODO: phục vụ đổi mật khẩu (khi user đổi password)
    passwordChangedAt: Date,

    // TODO: phục vụ forgot password
    resetPasswordToken: String,
    resetPasswordExpire: Date,
}, {
    timestamps: true
});

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();  // * Nếu không thay đổi password thì sẽ bỏ qua và không thực hiện code dưới.
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// * 👉 Method so sánh mật khẩu khi login
userSchema.methods.isCorrectPassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);