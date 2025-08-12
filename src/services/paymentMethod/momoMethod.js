const Payment = require("../../models/payment/payment");
const UserSubscription = require("../../models/payment/userSubscription");
const User = require("../../models/user/user");
const Channel = require("../../models/user/channel");
const Subscription = require("../../models/payment/subscription");
const asyncHandler = require("express-async-handler");
require("dotenv").config();
const crypto = require("crypto");
const axios = require("axios");
const notifyPremiumUpgrade = require("../../utils/payment/notifyPremiumUpgrade");

// ** Payment MOMO
const accessKeyMomo = process.env.ACCESS_KEY_MOMO;
const secretKeyMomo = process.env.SECRET_KEY_MOMO;
const partnerCodeMomo = process.env.PARTNER_CODE;
const urlNgrok = process.env.NGROK;
const urlServer = process.env.URL_SERVER;
const urlClient = process.env.URL_CLIENT;
const emailAdmin = process.env.EMAIL_NAME;

const createTransactionMomo = asyncHandler(async (req, res) => {
    const { subscriptionId, userId } = req.body;

    // 1. Lấy thông tin gói subscription
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
    }
    const amount = subscription.price;

    // 2. Tạo dữ liệu gửi MoMo
    const orderInfo = `Thanh toán gói ${subscription.name}`;
    const redirectUrl = urlClient;
    const ipnUrl = `${urlNgrok || urlServer}/api/payment/momo/callback`;
    const requestType = "payWithMethod";
    const orderId = `${subscriptionId}-${Date.now()}`;
    const requestId = orderId;
    const extraData = '';
    const orderGroupId = '';
    const autoCapture = true;
    const lang = 'vi';

    const rawSignature = `accessKey=${accessKeyMomo}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCodeMomo}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    // console.log("rawSignature: ", rawSignature);

    const signature = crypto
        .createHmac('sha256', secretKeyMomo)
        .update(rawSignature)
        .digest('hex');

    // console.log("signature: ", signature);

    const requestBody = JSON.stringify({
        partnerCode: partnerCodeMomo,
        partnerName: "MyApp",
        storeId: "MomoStore",
        requestId,
        amount,
        orderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        lang,
        requestType,
        autoCapture,
        extraData,
        orderGroupId,
        signature
    });

    const options = {
        method: 'POST',
        url: 'https://test-payment.momo.vn/v2/gateway/api/create',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
        },
        data: requestBody
    };

    try {
        const result = await axios.request(options);

        // 3. Tạo payment pending
        await Payment.create({
            userId,
            subscriptionId,
            amount,
            paymentMethod: 'momo',
            status: 'pending',
            transactionId: orderId,
            paymentMeta: {
                momoResponse: result.data
            }
        });

        return res.status(200).json(result.data);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

const callbackMomo = asyncHandler(async (req, res) => {
    const data = req.body;
    console.log("Data callbacked: ", data);

    try {
        const payment = await Payment.findOne({ transactionId: data.orderId });
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }

        if (Number(data.resultCode) === 0) {
            payment.status = "completed";
            payment.paymentMeta.momoCallback = data;
            await payment.save();

            const subscription = await Subscription.findById(payment.subscriptionId);
            if (!subscription) {
                return res.status(404).json({ message: "Subscription not found" });
            }

            const startDate = new Date();
            let endDate = new Date(startDate);

            if (subscription.periodType === "day") {
                endDate.setDate(endDate.getDate() + subscription.duration);
            } else if (subscription.periodType === "week") {
                endDate.setDate(endDate.getDate() + subscription.duration * 7);
            } else if (subscription.periodType === "month") {
                endDate.setMonth(endDate.getMonth() + subscription.duration);
            }

            const channel = await Channel.findOne({ owner: payment.userId });
            if (channel) {
                channel.isPremium = true;
                await channel.save();
            }

            const userSub = await UserSubscription.create({
                userId: payment.userId,
                subscriptionId: payment.subscriptionId,
                paymentId: payment._id,
                startDate,
                endDate,
                autoRenew: true,
                status: "active"
            });

            await notifyPremiumUpgrade({
                userId: payment.userId,
                paymentMethod: "MOMO",
                subscription,
                startDate,
                endDate,
                channelId: channel._id
            });

        } else {
            payment.status = "failed";
            payment.paymentMeta.momoCallback = data;
            await payment.save();
        }

        return res.status(200).json({ message: "Callback processed successfully" });
    } catch (err) {
        console.error("Error processing momo callback:", err);
        return res.status(500).json({ message: err.message });
    }
});

const transactionStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.query;

    const rawSignature = `accessKey=${accessKeyMomo}&orderId=${orderId}&partnerCode=${partnerCodeMomo}&requestId=${orderId}`;

    const signature = crypto
        .createHmac('sha256', secretKeyMomo)
        .update(rawSignature)
        .digest('hex');

    const requestBody = JSON.stringify({
        partnerCode: partnerCodeMomo,
        orderId,
        requestId: orderId,
        signature,
        lang: 'vi'
    });

    const options = {
        method: 'POST',
        url: 'https://test-payment.momo.vn/v2/gateway/api/query',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
        },
        data: requestBody
    };

    let result = await axios.request(options);

    const data = result.data;

    return res.status(200).json(data);
});

module.exports = {
    createTransactionMomo,
    callbackMomo,
    transactionStatus,
};

