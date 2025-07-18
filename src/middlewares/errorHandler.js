module.exports = (err, req, res, next) => {
  if (err && err.status === 429) {
    return res.status(429).json({ message: err.message });
  }

  console.error(err);
  res.status(500).json({ message: "Lỗi server" });
};