const express = require("express");

const blogRouter = express.Router();

const blogController = require("../controllers/blogController");

blogRouter.get("/get-all-blogs-by-user-id/:userId", blogController.getAllBlogsByUserId);

blogRouter.get("/get-all-blogs-by-channel-id/:channelId", blogController.getAllBlogsByChannelId);

blogRouter.get("/get-blog-info/:blogId", blogController.getBlogInfo);

blogRouter.post("/create-blog", blogController.createBlog);

blogRouter.put("/edit-blog/:blogId", blogController.editBlog);

blogRouter.delete("/delete-blog/:blogId", blogController.deleteBlog);

module.exports = blogRouter;