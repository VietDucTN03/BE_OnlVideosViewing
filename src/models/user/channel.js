const mongoose = require("mongoose");

const channelSchema = new mongoose.Schema({
    nameChannel: {
        type: String,
        required: true,
        default: function () {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < 10; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return `User_${result}`;
        }
    },
    description: {
        type: String,
        required: true,
        default: "Welcome to your new channel!"
    },
    avatarChannel: {
        type: String,
        default: "https://res.cloudinary.com/digngxuqg/image/upload/v1746652203/j97_g184cg.png"
    },
    bannerChannel: {
        type: String,
        default: "https://res.cloudinary.com/digngxuqg/image/upload/v1746652226/bannerDefault_idfdwz.jpg"
    },
    isPremium: {
        type: Boolean,
        default: false
    },
    subscribers: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "Channel",
        default: [],
    },
    subscribersCount: {
        type: Number,
        default: 0,
    },
    channelsSubscribed: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "Channel",
        default: [],
    },
    contentTotal: {
        videos: { type: Number, default: 0 },
        shortVideos: { type: Number, default: 0 },
        blogs: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },
    viewTotal: {
        type: Number,
        default: 0,
    },
    violationStatus: {
        type: String,
        enum: ["normal", "warning", "banned"],
        default: "normal"
    },
    reportCount: {
        type: Number,
        default: 0,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
}, { timestamps: true });

module.exports = mongoose.model("Channel", channelSchema);