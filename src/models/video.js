const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
    {
        uploader: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Channel",
            // required: true
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
        status: [
            {
                statusLike: {
                    type: Boolean,
                    default: undefined
                },
                postedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Channel"
                }
            }
        ],
        relatedVideos: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        playList: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Playlist"
            }
        ],
        duration: {
            type: String
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Video", videoSchema);