const Payment = require("../../models/payment/payment");
const Subscription = require("../../models/payment/subscription");
const UserSubscription = require("../../models/payment/userSubscription");
const User = require("../../models/user/user");
const Channel = require("../../models/user/channel");
const asyncHandler = require("express-async-handler");
require("dotenv").config();
const crypto = require("crypto");
const axios = require("axios");

const notifyPremiumUpgrade = require("../../utils/payment/notifyPremiumUpgrade");

const { VNPay, ignoreLogger, ProductCode, VnpLocate, dateFormat } = require('vnpay');

// ? Payment VNPAY
const tmnCodeVnpay = process.env.TMN_CODE;
const secureSecretVnpay = process.env.SECURE_SECRET;
const urlNgrok = process.env.NGROK;
const urlServer = process.env.URL_SERVER;
const urlClient = process.env.URL_CLIENT;

const createTransactionVnpay = asyncHandler(async (req, res) => {

    const { subscriptionId, userId } = req.body;

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
    }
    const amount = subscription.price;

    let clientIp =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.ip;

    if (clientIp.startsWith("::ffff:")) {
        clientIp = clientIp.replace("::ffff:", "");
    }

    console.log("clientIp: ", clientIp);

    const orderId = `${subscriptionId}-${Date.now()}`;

    try {
        const vnpay = new VNPay({
            tmnCode: tmnCodeVnpay,
            secureSecret: secureSecretVnpay,
            vnpayHost: "https://sandbox.vnpayment.vn",
            testMode: true,
            hashAlgorithm: "SHA512",
        });

        // 1. Generate payment URL
        const paymentUrl = await vnpay.buildPaymentUrl({
            vnp_Amount: amount,
            vnp_IpAddr: clientIp,
            vnp_TxnRef: orderId,
            vnp_OrderInfo: "Order payment #" + orderId,
            vnp_OrderType: "billpayment",
            vnp_ReturnUrl: `${urlServer || urlNgrok}/api/payment/vnpay/callback-vnpay?redirect=${encodeURIComponent(urlClient)}`,
            vnp_BankCode: "NCB",
            vnp_CreateDate: dateFormat(new Date(), "yyyymmddHHMMss"),
            vnp_ExpireDate: dateFormat(new Date(Date.now() + 15 * 60 * 1000), "yyyyMMddHHmmss"),
            vnp_Locale: "vn",
            vnp_Command: "pay",
            vnp_Version: "2.1.0",
        });

        await Payment.create({
            userId,
            subscriptionId,
            amount,
            paymentMethod: "vnpay",
            status: "pending",
            transactionId: orderId,
            paymentMeta: {
                paymentUrl
            }
        });

        return res.status(201).json({ orderId, amount, paymentUrl });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Error creating VNPay payment URL" });
    }
});

const callbackVnpay = asyncHandler(async (req, res) => {
    const data = req.query;
    console.log("Data from VNPay: ", data);
    const redirectUrl = req.query.redirect || urlClient;

    try {
        const payment = await Payment.findOne({ transactionId: data.vnp_TxnRef })
            .populate("subscriptionId")
            .populate("userId", "_id name email");

        if (!payment) {
            return res.redirect(302, `${redirectUrl}?success=false&message=Payment not found`);
        }

        if (data.vnp_ResponseCode === "00" && data.vnp_TransactionStatus === "00") {
            payment.status = "completed";
            payment.paymentMeta.vnpayCallback = data;
            await payment.save();

            const subscription = await Subscription.findById(payment.subscriptionId);
            if (!subscription) {
                return res.status(404).json({ message: "Subscription not found" });
            }

            // Add 1 to totalSubscribers
            await Subscription.findByIdAndUpdate(
                payment.subscriptionId,
                { $inc: { totalSubscribers: 1 } }
            );

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

            await UserSubscription.create({
                userId: payment.userId,
                subscriptionId: payment.subscriptionId,
                paymentId: payment._id,
                startDate,
                endDate,
                // autoRenew: true,
                status: "active"
            });

            await notifyPremiumUpgrade({
                userId: payment.userId,
                paymentMethod: "VNPay",
                subscription,
                startDate,
                endDate,
                channelId: channel?._id
            });

            // ** Get Back Payment
            const reducedPayment = {
                _id: payment._id,
                amount: payment.amount,
                paymentMethod: payment.paymentMethod,
                status: payment.status,
                transactionId: payment.transactionId,
                paymentDate: payment.paymentDate
            };

            // ** Get Back Subscription
            const sub = payment.subscriptionId || {};
            const reducedSubscription = {
                _id: sub._id,
                name: sub.name,
                price: sub.price,
                duration: sub.duration,
                periodType: sub.periodType
            };

            const usr = payment.userId || {};

            // ** Get Back User
            const reducedUser = { _id: usr._id, email: usr.email, name: usr.username };

            // ** Get Back Channel
            const reducedChannel = channel ? {
                _id: channel._id,
                avatarChannel: channel.avatarChannel,
                nameChannel: channel.nameChannel,
                isPremium: channel.isPremium,
                viewTotal: channel.viewTotal
            } : {};

            const payload = {
                payment: reducedPayment,
                subscription: reducedSubscription,
                user: reducedUser,
                channel: reducedChannel
            };

            console.log("Payload: ", payload);

            const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");

            return res.redirect(302, `${redirectUrl}?success=true&data=${encoded}`);
        } else {
            payment.status = "failed";
            payment.paymentMeta.vnpayCallback = data;
            await payment.save();
            console.warn("VNPay payment failed");
        }

        return res.status(200).json({ message: "VNPay callback processed successfully" });
    } catch (err) {
        console.error("Error processing VNPay callback:", err);
        return res.status(500).json({ message: err.message });
    }
});

module.exports = {
    createTransactionVnpay,
    callbackVnpay,
};