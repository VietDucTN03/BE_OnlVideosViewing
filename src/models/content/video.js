const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
    {
        uploader: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Channel",
            required: true
        },
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        url: {
            type: [String],
            required: true
        },
        thumbnail: {
            type: String,
            required: true
        },
        category: {
            type: [String], // Danh mục video (mảng)
            required: true
        },
        views: {
            type: Number,
            default: 0
        },
        statusTotal: {
            like: { type: Number, default: 0 },
            dislike: { type: Number, default: 0 }
        },
        playList: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Playlist"
            }
        ],
        duration: {
            type: String
        },
        commentTotal: {
            type: Number,
            default: 0
        },
        isPremiumOnly: {
            type: Boolean,
            default: false
        },
        violationStatus: {
            type: String,
            enum: ["normal", "warning", "banned"],
            default: "normal"
        },
        reportReviewCount: {
            type: Number,
            default: 0,
        },
        reportCount: {
            type: Number,
            default: 0,
        },
        isBanned: {
            type: Boolean,
            default: false
        },
        isPrivate: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Video", videoSchema);