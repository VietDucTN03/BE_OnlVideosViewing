const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        // unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    // password: {
    //     type: String,
    //     required: true
    // },
    avatar: {
        public_id: String,
        url: String
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    typeLogin: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    channel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Channel",
    },
    // refreshToken: String,
    // passwordChangedAt: String,
    // resetPasswordToken: String,
    // resetPasswordExpire: Date,
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);