const mongoose = require("mongoose");

const statusSchema = new mongoose.Schema(
    {
        refId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        refType: {
            type: String,
            enum: ["Video", "ShortVideo", "Blog", "Comment"],
            required: true,
        },
        postedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Channel",
            required: true,
        },
        statusLike: {
            type: Boolean, // true = like, false = dislike
            required: true,
        },
    },
    { timestamps: true }
);

statusSchema.index({ refId: 1, refType: 1, postedBy: 1 }, { unique: true });

module.exports = mongoose.model("Status", statusSchema);