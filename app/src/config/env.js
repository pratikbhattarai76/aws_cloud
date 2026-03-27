const path = require("path");
const dotenv = require("dotenv");

// Load .env from app/src/.env if available
dotenv.config({ path: path.join(__dirname, "..", ".env"), silent: true });

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const normalizePrefix = (value, fallback = "drops") => {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const normalized = value.trim().replace(/^\/+|\/+$/g, "");
  return normalized || fallback;
};

const toPort = (value, fallback = 3000) => {
  const port = toPositiveInteger(value, fallback);
  if (port > 65535) {
    return fallback;
  }
  return port;
};

const toMaxListCount = (value, fallback = 200) => {
  const count = toPositiveInteger(value, fallback);
  // For AWS S3 (ListObjectsV2) the maximum is 1000
  return Math.min(count, 1000);
};

const toBytesFromMb = (value, fallback = 20) => {
  const mb = toPositiveInteger(value, fallback);
  if (mb > 5120) {
    throw new Error("MAX_FILE_SIZE_MB cannot be greater than 5120 (5 GB)");
  }
  return mb * 1024 * 1024;
};

const requireEnv = (name, value) => {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
};

const env = Object.freeze({
  appName: "MalaiDeu",
  port: toPort(process.env.PORT),
  storage: Object.freeze({
    region: requireEnv("AWS_REGION", process.env.AWS_REGION),
    bucketName: requireEnv("S3_BUCKET_NAME", process.env.S3_BUCKET_NAME),
    prefix: normalizePrefix(process.env.S3_PREFIX),
    maxListCount: toMaxListCount(process.env.MAX_LIST_COUNT, 200),
  }),
  upload: Object.freeze({
    maxFileCount: toPositiveInteger(process.env.MAX_FILE_COUNT, 10),
    maxFileSizeBytes: toBytesFromMb(process.env.MAX_FILE_SIZE_MB, 20),
  }),
});

module.exports = env;
