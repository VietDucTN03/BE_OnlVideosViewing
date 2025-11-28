const cloudinary = require("cloudinary").v2;
const path = require("path");
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const deleteFromCloudinary = async (mediaUrls, resourceType = "image") => {
  if (!Array.isArray(mediaUrls)) return;

  console.log("resourceType: ", resourceType);

  await Promise.all(
    mediaUrls.map(async (url) => {
      try {
        const uploadIndex = url.indexOf("/upload/");
        if (uploadIndex === -1) {
          console.warn("'/upload/' not found in URL:", url);
          return;
        }

        const afterUpload = url.substring(uploadIndex + 8);
        const parts = afterUpload.split("/");
        if (parts[0].startsWith("v") && /^\d+$/.test(parts[0].substring(1))) {
          parts.shift();
        }

        const filename = parts.pop();
        const filenameNoExt = path.parse(filename).name;
        const publicId = [...parts, filenameNoExt].join("/");

        if (!publicId) {
          console.warn("Unable to determine public_id from URL:", url);
          return;
        }

        console.log("Deleting Cloudinary:", publicId);

        await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType,
          type: "upload",
          invalidate: true,
        });

        console.log(`Deleted ${resourceType}: ${publicId}`);
      } catch (err) {
        console.error(`Error deleting ${resourceType}:`, err);
      }
    })
  );
};

module.exports = deleteFromCloudinary;