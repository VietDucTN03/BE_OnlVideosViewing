const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
  secure: true
});

const storage = new CloudinaryStorage({
  cloudinary,
  resource_type: 'auto',
  allowedFormats: ['jpg', 'png', 'mp4', 'avi', 'mov', 'mkv'], 
  params: {
    folder: 'BE'
  }
}); 

const uploadCloud = multer({ storage });

module.exports = uploadCloud;

// Postman
// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const multer = require('multer');

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_NAME,
//   api_key: process.env.CLOUDINARY_KEY,
//   api_secret: process.env.CLOUDINARY_SECRET,
//   secure: true,
// });

// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: async (req, file) => {
//     let folder = 'cuahangdientu'; // Thư mục chứa file trên Cloudinary
//     let resourceType = 'auto'; // Tự động nhận diện ảnh/video
//     let format;

//     if (file.mimetype.startsWith('image/')) {
//       format = 'jpg'; // Chuyển ảnh sang JPG
//     } else if (file.mimetype.startsWith('video/')) {
//       format = 'mp4'; // Chuyển video sang MP4
//     }

//     return {
//       folder,
//       format,
//       resource_type: resourceType,
//       public_id: `${Date.now()}-${file.originalname.split('.')[0]}`, // Định danh file duy nhất
//     }; 
//   },
// });

// const uploadCloud = multer({ storage });

// module.exports = uploadCloud;

