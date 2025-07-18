const express = require("express");

const searchRouter = express.Router();

const searchController = require("../controllers/searchController");

const verifyLoggedIn = require("../middlewares/verifyLoggedIn");

searchRouter.get("/get-list-of-search-suggestions", searchController.getListOfSearchSuggestions);

searchRouter.get("/get-search-results", verifyLoggedIn, searchController.getSearchResults);

module.exports = searchRouter;