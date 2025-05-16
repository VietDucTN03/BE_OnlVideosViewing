const cloudinary = require("cloudinary").v2;

const deleteFromCloudinary = async (mediaUrls, resourceType = "video") => {
  if (!Array.isArray(mediaUrls)) return;

  await Promise.all(
    mediaUrls.map(async (url) => {
      try {
        const regex =
          resourceType === "image"
            ? /upload\/(?:v\d+\/)?([^\.]+)\.(?:jpg|jpeg|png|webp)/ // cho ảnh
            : /upload\/(?:v\d+\/)?([^\.]+)\.(?:mp4|mov|webm)/; // cho video

        const matches = url.match(regex);
        if (!matches || !matches[1]) {
          console.warn("Không lấy được public_id từ URL:", url);
          return;
        }

        const publicId = matches[1];
        await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType,
        });
        console.log(`✅ Đã xóa Cloudinary ${resourceType}: ${publicId}`);
      } catch (err) {
        console.error(`❌ Lỗi khi xóa ${resourceType}:`, err.message);
      }
    })
  );
};

module.exports = deleteFromCloudinary;