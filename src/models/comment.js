const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
    {
        videoId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "video", 
            required: true 
        },
        parentComment: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "comment", 
            default: null  // Nếu null thì đây là comment gốc
        },
        content: { 
            type: String, 
            required: true 
        },
        postedBy: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "channel",
            required: true 
        },
        status: [{
            statusLike: {
                type: Boolean,
                default: undefined
            },
            postedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "channel"
            }
        }],
        createdAt: { 
            type: Date, 
            default: Date.now 
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Comment", commentSchema);
