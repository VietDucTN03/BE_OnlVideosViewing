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
        status: [
            {
                statusLike: {
                    type: Boolean,
                    default: undefined
                },
                postedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Channel"
                },
            }
        ],
        commentTotal: {
            type: Number,
            default: 0
        },
        isPrivate: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Blog", blogSchema);