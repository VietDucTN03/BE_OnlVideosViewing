const mongoose = require("mongoose");

const reportReviewSchema = new mongoose.Schema(
    {
        reporters: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Channel",
                // required: true,
            },
        ],
        reportedChannel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Channel",
            required: true,
        },
        contentType: {
            type: String,
            enum: ["Video", "Blog", "ShortVideo"],
            required: true,
        },
        contentId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        reason: {
            type: String,
            required: true,
        },
        isResolved: {
            type: Boolean,
            default: false,
        },
        resolvedResult: {
            type: String,
            enum: ["valid", "invalid", "pending"],
            default: "pending",
        },
    },
    { timestamps: true }
);

reportReviewSchema.index(
    { contentId: 1, contentType: 1, reason: 1 },
    { unique: true }
);

module.exports = mongoose.model("ReportReview", reportReviewSchema);