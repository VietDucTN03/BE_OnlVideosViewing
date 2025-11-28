const mongoose = require('mongoose');

// ** Service package information.

const subscriptionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            enum: ['Basic', 'Premium']
        },
        description: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        duration: {
            type: Number,
            required: true
        },
        periodType: {
            type: String,
            enum: ['day', 'week', 'month'],
            required: true
        },
        features: [String],   // ? Package features.
        isActive: {
            type: Boolean,
            default: true
        },
        totalSubscribers: {
            type: Number,
            default: 0
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);