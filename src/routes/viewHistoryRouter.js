const express = require("express");

const viewHistoryRouter = express.Router();

const viewHistoryController = require("../controllers/viewHistoryController");

viewHistoryRouter.get("/get-all-view-history/:userId", viewHistoryController.getViewHistoryByUserId);

module.exports = viewHistoryRouter;