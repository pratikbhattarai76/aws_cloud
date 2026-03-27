const multer = require("multer");

const env = require("../config/env");

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: env.upload.maxFileCount,
    fileSize: env.upload.maxFileSizeBytes,
  },
});
