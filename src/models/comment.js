const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
    {
        refId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        refType: {
            type: String,
            enum: ["Video", "Blog"],
            required: true,
        },
        parentComment: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Comment", 
            default: null  // Nếu null thì đây là comment gốc
        },
        // receiverInfo: {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: "Channel",
        //     default: null
        // },
        content: { 
            type: String, 
            required: true 
        },
        postedBy: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Channel",
            required: true 
        },
        status: [{
            statusLike: {
                type: Boolean,
                default: undefined
            },
            postedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Channel"
            }
        }],
        replyCount: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Comment", commentSchema);
