const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            enum: ['Basic', 'Premium', 'Ultimate']
        },
        description: {
            type: String,
            required: true
        },
        price: {
            type: String,
            required: true
        },
        duration: {
            type: Number,
            required: true
        },
        features: [{
            type: String
        }],
        isActive: {
            type: Boolean,
            default: true
        }
    }, 
    { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);