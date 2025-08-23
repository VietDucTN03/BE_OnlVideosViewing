const express = require("express");

const subscriptionRouter = express.Router();

const subscriptionServices = require("../../services/subscriptionServices/subscriptionServices");

const verifyChannelOwnership = require("../../middlewares/verifyChannelOwnership");

const verifyLoggedIn = require("../../middlewares/verifyLoggedIn");

const expressAsyncHandler = require("express-async-handler");

const Subscription = require("../../models/payment/subscription");

subscriptionRouter.get("/get-subscription-plans", subscriptionServices.getSubscriptionPlans);

subscriptionRouter.get("/get-user-subscription/:userId", verifyLoggedIn, subscriptionServices.getUserSubscriptionOfUser);

subscriptionRouter.get("/get-details-of-user-subscription/:userSubscriptionId", verifyLoggedIn, subscriptionServices.getDetailsOfUserSubscription);

subscriptionRouter.post("/cancel-user-subscription/:userSubscriptionId", verifyLoggedIn, subscriptionServices.cancelUserSubscription);

module.exports = subscriptionRouter;