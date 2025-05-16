const mongoose = require("mongoose");

const shortVideoSchema = new mongoose.Schema({
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
        type: String,
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
    playList: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Playlist"
        }
    ],
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
    duration: {
        type: String
    },
    commentTotal: {
        type: Number,
        default: 0
    },
    isPrivate: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model("ShortVideo", shortVideoSchema);