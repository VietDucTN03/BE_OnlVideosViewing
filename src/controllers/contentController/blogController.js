const Blog = require("../../models/content/blog");
const asyncHandler = require("express-async-handler");
const deleteFromCloudinary = require("../../utils/cloudinary/deleteFromCloudinary");

const getAllBlogsByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1 } = req.query;

  if (!userId) {
    return res.status(400).json({ message: "Thiếu userId." });
  }

  const pageNum = parseInt(page, 10);
  const limit = 2;
  const skip = (pageNum - 1) * limit;

  const totalBlogs = await Blog.countDocuments({ author: userId });

  const totalPages = Math.ceil(totalBlogs / limit);

  const blogs = await Blog.find({ author: userId })
    .sort({ createdAt: -1 })
    .select("-reportReviewCount -reportCount -violationStatus -isBanned")
    .skip(skip)
    .limit(limit);

  const hasMore = skip + blogs.length < totalBlogs;

  // Không có blog nào trong toàn bộ hệ thống
  if (totalBlogs === 0) {
    return res.status(200).json({
      message: "Người dùng chưa có blog nào.",
      blogs: [],
      totalBlogs,
      totalPages: 0,
      hasMore: false,
    });
  }

  // Hết blog để tải thêm ở trang kế tiếp
  if (blogs.length === 0) {
    return res.status(200).json({
      message: "Không còn blog nào để tải thêm.",
      blogs: [],
      totalBlogs,
      totalPages,
      hasMore: false,
    });
  }

  // Trường hợp có blog trả về
  res.status(200).json({
    message: "Lấy tất cả blogs của user thành công.",
    blogs,
    limit,
    totalBlogs,
    totalPages,
    hasMore,
  });
});

const getAllBlogsByChannelId = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { page = 1 } = req.query;

  if (!channelId) {
    return res.status(400).json({ message: "Thiếu channelId." });
  }

  const pageNum = parseInt(page, 10);
  const limit = 2;
  const skip = (pageNum - 1) * limit;

  const totalBlogs = await Blog.countDocuments({
    author: channelId,
    isPrivate: false,
  });

  const blogs = await Blog.find({ author: channelId, isPrivate: false, })
    .select("-reportReviewCount -reportCount -violationStatus -isBanned")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  console.log("blogs: ", blogs);

  const hasMore = skip + blogs.length < totalBlogs;

  // Không có blog nào trong toàn bộ hệ thống
  if (totalBlogs === 0) {
    return res.status(200).json({
      message: "Channel chưa có blog nào.",
      blogs: [],
      totalBlogs,
      hasMore: false,
    });
  }

  // Hết blog sé tải thêm ở trang kế tiếp
  if (blogs.length === 0) {
    return res.status(200).json({
      message: "Không còn blog nào để tải thêm.",
      blogs: [],
      totalBlogs,
      hasMore: false,
    });
  }

  res.status(200).json({
    message: "Lấy blog công khai của channel thành công.",
    blogs,
    totalBlogs,
    hasMore,
  });
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
    return res.status(404).json({ message: "Không tìm thấy blog." });
  }

  // console.log(blog);

  res.status(200).json({
    message: "Lấy thông tin blog thành công.",
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
        "Vui lòng cung cấp đầy đủ title, content, blogImgs, categories, isPrivate và userId.",
    });
  }

  if (!Array.isArray(blogImgs) || !Array.isArray(categories)) {
    return res
      .status(400)
      .json({ message: "blogImgs và categories phải là mảng." });
  }

  const newBlog = await Blog.create({
    author: userId,
    title,
    content,
    blogImgs,
    categories,
    isPrivate,
  });

  res.status(201).json({
    message: "Tạo blog thành công.",
    blog: newBlog,
  });
});

const editBlog = asyncHandler(async (req, res) => {
  const { blogId } = req.params;
  const { title, content, blogImgs, categories, isPrivate } = req.body;

  if (!blogId) {
    return res.status(400).json({ message: "Thiếu blogId." });
  }

  const blog = await Blog.findById(blogId);

  if (!blog) {
    return res.status(404).json({ message: "Không tìm thấy blog." });
  }

  // Kiểm tra các trường hợp có truyền vào thì mới cập nhật
  if (title !== undefined) blog.title = title;
  if (content !== undefined) blog.content = content;

  if (blogImgs !== undefined) {
    if (!Array.isArray(blogImgs)) {
      return res.status(400).json({ message: "blogImgs phải là mảng." });
    }
    blog.blogImgs = blogImgs;
  }

  if (categories !== undefined) {
    if (!Array.isArray(categories)) {
      return res.status(400).json({ message: "categories phải là mảng." });
    }
    blog.categories = categories;
  }

  if (isPrivate !== undefined) blog.isPrivate = isPrivate;

  const updatedBlog = await blog.save();

  // console.log(updatedBlog);

  res.status(200).json({
    message: "Cập nhật blog thành công.",
    blog: updatedBlog,
  });
});

const deleteBlog = asyncHandler(async (req, res) => {
  const { blogId } = req.params;

  if (!blogId) {
    return res.status(400).json({ message: "Thiếu blogId." });
  }

  // Tìm blog để lấy thông tin ảnh
  const blog = await Blog.findById(blogId);

  if (!blog) {
    return res.status(404).json({ message: "Không tìm thấy blog." });
  }

  await deleteFromCloudinary(blog.blogImgs, "image");

  await blog.deleteOne();

  res.status(200).json({
    blog,
    message: `Xóa blog ${blog.title} thành công và ảnh trên Cloudinary.`,
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
