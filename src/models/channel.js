const mongoose = require("mongoose");

const channelSchema = new mongoose.Schema({
    nameChannel: {
        type: String,
        required: true,
        default: "Default Channel"
    },
    description: {
        type: String,
        required: true,
        default: "Welcome to your new channel!"
    },
    avatarChannel: {
        type: String,
        default: null
    },
    bannerChannel: {
        type: String,
        default: null
    },
    viewTotal: {
        type: Number,
        default: 0,
    },
    subscribers: {
        type: Number,
        default: 0,
    },
    videoTotal: {
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