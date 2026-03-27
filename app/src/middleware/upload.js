const crypto = require("crypto");
const fs = require("fs");
const multer = require("multer");
const os = require("os");
const path = require("path");

const uploadTempDir = path.join(os.tmpdir(), "malaideu-uploads");

fs.mkdirSync(uploadTempDir, { recursive: true });

module.exports = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadTempDir);
    },
    filename: (req, file, cb) => {
      const safeExtension = path.extname(file.originalname || "").slice(0, 20);
      cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExtension}`);
    },
  }),
});
