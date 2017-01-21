const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: './userImages',
  filename: (req, file, cb) => {
    cb(null, (req.params.id + path.extname(file.originalname)).toLowerCase());
  }
});
const imageExts = ['.png', '.jpg', '.gif', '.tiff', '.jpeg', '.tif'];

function fileFilter(req, file, cb) {
  cb(null, (imageExts.includes(path.extname(file.originalname).toLowerCase())));
}

const upload = multer({storage: storage, fileFilter: fileFilter});
module.exports = upload;