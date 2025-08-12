const Blog = require("../../models/content/blog");
const Channel = require("../../models/user/channel");
const asyncHandler = require("express-async-handler");
const deleteFromCloudinary = require("../../utils/cloudinary/deleteFromCloudinary");

const getAllBlogsByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, keyword = "", sort = "createdAtDesc" } = req.query;

  if (!userId) {
    return res.status(400).json({ message: "Thiếu userId." });
  }

  const pageNum = parseInt(page, 10);
  const limit = 2;
  const skip = (pageNum - 1) * limit;

  const sortOptions = {
    createdAtDesc: { createdAt: -1 },
    createdAtAsc: { createdAt: 1 },
    likesDesc: { "statusTotal.like": -1 },
    dislikesDesc: { "statusTotal.dislike": -1 },
    commentsDesc: { commentTotal: -1 },
  };

  const sortCondition = sortOptions[sort] || sortOptions.createdAtDesc;

  const baseQuery = {
    author: userId,
    isBanned: false,
  };

  let totalBlogs = await Blog.countDocuments(baseQuery);

  const query = { ...baseQuery };
  if (keyword) {
    query.$or = [
      { title: { $regex: keyword, $options: "i" } },
      { content: { $regex: keyword, $options: "i" } },
    ];
  }

  totalBlogs = await Blog.countDocuments(query);

  const totalPages = Math.ceil(totalBlogs / limit);

  try {
    const filteredTotal = await Blog.countDocuments(query);

    const blogs = await Blog.find(query)
      .sort(sortCondition)
      .select("-reportReviewCount -reportCount -violationStatus")
      .skip(skip)
      .limit(limit)
      .lean();

    const hasMore = skip + blogs.length < filteredTotal;

    if (keyword && filteredTotal === 0) {
      return res.status(200).json({
        success: true,
        blogs: [],
        totalBlogs: 0,
        page: 1,
        limit,
        hasMore: false,
        keyword,
        sort,
        message: `No blogs found matching the keyword "${keyword}".`,
      });
    }

    if (totalBlogs === 0) {
      return res.status(200).json({
        success: true,
        blogs: [],
        totalBlogs: 0,
        totalPages: 0,
        page: 1,
        limit,
        hasMore: false,
        keyword,
        sort,
        message: "Users do not have any blog.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Successfully fetched user blog",
      blogs,
      totalBlogs,
      totalPages,
      page: pageNum,
      limit,
      hasMore,
      keyword,
      sort,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy blog theo userId:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch user blog",
        error: error.message,
      });
  }
});

const getAllBlogsByChannelId = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { page = 1, keyword = "", sort = "createdAtDesc" } = req.query;

  if (!channelId) {
    return res.status(400).json({ message: "Thiếu channelId." });
  }

  const pageNum = parseInt(page);
  const limit = 2;
  const skip = (pageNum - 1) * limit;

  const sortOptions = {
    createdAtDesc: { createdAt: -1 },
    createdAtAsc: { createdAt: 1 },
    likesDesc: { "statusTotal.like": -1 },
    commentsDesc: { commentTotal: -1 },
  };

  const sortCondition = sortOptions[sort] || sortOptions.createdAtDesc;

  const baseQuery = {
    author: channelId,
    isPrivate: false,
    isBanned: false,
  };

  let totalBlogs = await Blog.countDocuments(baseQuery);

  const query = { ...baseQuery };
  if (keyword) {
    query.$or = [
      { title: { $regex: keyword, $options: "i" } },
      { content: { $regex: keyword, $options: "i" } },
    ];
  }

  totalBlogs = await Blog.countDocuments(query);

  try {
    const filteredTotal = await Blog.countDocuments(query);

    const blogs = await Blog.find(query)
      .select("-reportReviewCount -reportCount -violationStatus")
      .sort(sortCondition)
      .skip(skip)
      .limit(limit)
      .lean();

    const hasMore = skip + limit < filteredTotal;

    if (keyword && filteredTotal === 0) {
      return res.status(200).json({
        success: true,
        blogs: [],
        totalBlogs: 0,
        page: 1,
        limit,
        hasMore: false,
        keyword,
        sort,
        message: `No blogs found matching the keyword "${keyword}".`,
      });
    }

    if (totalBlogs === 0) {
      return res.status(200).json({
        success: true,
        blogs: [],
        totalBlogs: 0,
        page: 1,
        limit,
        hasMore: false,
        keyword,
        sort,
        message: "Channel has no blog.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Successfully fetched channel blog",
      blogs,
      totalBlogs,
      page: pageNum,
      limit,
      hasMore,
      keyword,
      sort,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy blog theo channelId:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch channel blog",
        error: error.message,
      });
  }
});

const getBlogInfo = asyncHandler(async (req, res) => {
  const { blogId } = req.params;

  if (!blogId) {
    return res.status(400).json({ message: "Thiếu blogId." });
  }

  const blog = await Blog.findById(blogId)
    .populate(
      "author",
      "nameChannel avatarChannel"
    )
    .select("-reportReviewCount -reportCount -violationStatus -isBanned")
    .lean();

  if (!blog) {
    return res.status(404).json({ message: "No blog found." });
  }

  // console.log(blog);

  res.status(200).json({
    message: "Get blog information successfully.",
    blog,
  });
});

const createBlog = asyncHandler(async (req, res) => {
  const { title, content, blogImgs, categories, userId, isPrivate } = req.body;

  if (
    !title ||
    !content ||
    !blogImgs ||
    !categories ||
    !userId ||
    isPrivate === undefined
  ) {
    return res.status(400).json({
      message:
        "Please provide full Title, Content, Blogimgs, Categories, IsPrivate.",
    });
  }

  if (!Array.isArray(blogImgs) || !Array.isArray(categories)) {
    return res
      .status(400)
      .json({ message: "Blogimgs and Categories must be arrays." });
  }

  try {
    const newBlog = await Blog.create({
      author: userId,
      title,
      content,
      blogImgs,
      categories,
      isPrivate,
    });

    const channel = await Channel.findByIdAndUpdate(
      userId,
      {
        $inc: {
          "contentTotal.blogs": 1,
          "contentTotal.total": 1,
        },
      },
      { new: true }
    );

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    res.status(201).json({
      success: true,
      message: `Blog "${title}" created successfully.`,
      blog: newBlog,
    });
  } catch (error) {
    console.error("❌ Lỗi khi tạo blog:", error);
    next(error);
  }
});

const editBlog = asyncHandler(async (req, res) => {
  const { blogId } = req.params;
  const { title, content, blogImgs, categories, isPrivate } = req.body;

  if (!blogId) {
    return res.status(400).json({ message: "Thiếu blogId." });
  }

  const blog = await Blog.findById(blogId);

  if (!blog) {
    return res.status(404).json({ message: "No blog found." });
  }

  // Kiểm tra các trường hợp có truyền vào thì mới cập nhật
  if (title !== undefined) blog.title = title;
  if (content !== undefined) blog.content = content;

  if (blogImgs !== undefined) {
    if (!Array.isArray(blogImgs)) {
      return res.status(400).json({ message: "Blogimgs must be arrays." });
    }
    blog.blogImgs = blogImgs;
  }

  if (categories !== undefined) {
    if (!Array.isArray(categories)) {
      return res.status(400).json({ message: "Categories must be arrays." });
    }
    blog.categories = categories;
  }

  if (isPrivate !== undefined) blog.isPrivate = isPrivate;

  const updatedBlog = await blog.save();

  // console.log(updatedBlog);

  res.status(200).json({
    message: "Update blog successfully.",
    blog: updatedBlog,
  });
});

const deleteBlog = asyncHandler(async (req, res) => {
  const { blogId } = req.params;

  if (!blogId) {
    return res.status(400).json({ message: "Thiếu blogId." });
  }

  const blog = await Blog.findById(blogId);

  if (!blog) {
    return res.status(404).json({ message: "No blog found." });
  }

  await deleteFromCloudinary(blog.blogImgs, "image");

  const channelUpdate = await Channel.findByIdAndUpdate(
    blog.author,
    {
      $inc: {
        "contentTotal.blogs": -1,
        "contentTotal.total": -1,
      },
    },
    { new: true }
  );

  if (!channelUpdate) {
    return res.status(404).json({ message: "No channel found to update." });
  }

  await blog.deleteOne();

  res.status(200).json({
    blog,
    message: `Delete the blog "${blog.title}"`,
  });
});

module.exports = {
  getAllBlogsByUserId,
  getAllBlogsByChannelId,
  getBlogInfo,
  createBlog,
  editBlog,
  deleteBlog,
};
