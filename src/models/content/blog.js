const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
    {
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Channel",
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        blogImgs: {
            type: [String],
            required: true,
        },
        categories: {
            type: [String],
            required: true
        },
        statusTotal: {
            like: { type: Number, default: 0 },
            dislike: { type: Number, default: 0 }
        },
        commentTotal: {
            type: Number,
            default: 0
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
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Blog", blogSchema);