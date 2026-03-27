const express = require("express");
const multer = require("multer");
const path = require("path");

const env = require("./config/env");
const routes = require("./routes/pages");
const { formatBytes, formatDate } = require("./utils/file-utils");
const { redirectWithMessage } = require("./utils/http");

const app = express();

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.locals.appName = env.appName;
  res.locals.currentPath = req.path;
  res.locals.maxFileCount = env.upload.maxFileCount;
  res.locals.maxFileSize = formatBytes(env.upload.maxFileSizeBytes);
  res.locals.formatBytes = formatBytes;
  res.locals.formatDate = formatDate;
  next();
});

app.use(routes);

app.use((req, res) => {
  res.status(404).render("error", {
    pageTitle: "Not Found",
    heading: "Page not found",
    message: "The page you requested does not exist.",
  });
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return redirectWithMessage(res, "/", "error", `Files can be up to ${formatBytes(env.upload.maxFileSizeBytes)}.`);
  }

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT") {
    return redirectWithMessage(res, "/", "error", `Upload up to ${env.upload.maxFileCount} files at a time.`);
  }

  console.error("Unhandled error:", error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(error.statusCode || 500).render("error", {
    pageTitle: "Something went wrong",
    heading: "Something went wrong",
    message: "The app hit an unexpected problem. Please try again.",
  });
});

module.exports = app;
