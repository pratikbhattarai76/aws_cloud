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

const toPort = (value, fallback = 3000) => {
  const port = toPositiveInteger(value, fallback);
  if (port > 65535) {
    return fallback;
  }
  return port;
};

const normalizeOptionalString = (value) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || "";
};

const storageBucketName = normalizeOptionalString(process.env.S3_BUCKET_NAME);
const storageEnabled = Boolean(storageBucketName);
const storageMode = storageEnabled ? "live" : "local";
const storagePreviewMessage =
  "Storage is not connected. Files and folders appear automatically wherever S3 access is available.";

const env = Object.freeze({
  appName: "MalaiDeu",
  assetVersion: String(Date.now()),
  port: toPort(process.env.PORT),
  storage: Object.freeze({
    mode: storageMode,
    enabled: storageEnabled,
    previewMessage: storagePreviewMessage,
    region: normalizeOptionalString(process.env.AWS_REGION) || "us-east-1",
    bucketName: storageBucketName,
  }),
});

module.exports = env;
