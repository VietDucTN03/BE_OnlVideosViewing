const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
    {
        refId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        refType: {
            type: String,
            enum: ["Video", "Blog", "ShortVideo"],
            required: true,
        },
        parentComment: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Comment", 
            default: null  // Nếu null thì đây là comment gốc
        },
        content: { 
            type: String, 
            required: true 
        },
        postedBy: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Channel",
            required: true 
        },
        statusTotal: {
            like: { type: Number, default: 0 },
            dislike: { type: Number, default: 0 },
            likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Channel" }],
            dislikedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Channel" }]
        },
        replyCount: {
            type: Number,
            default: 0
        },
        // reportCount: {
        //     type: Number,
        //     default: 0,
        // },
        // isBlocked: {
        //     type: Boolean,
        //     default: false
        // },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Comment", commentSchema);
