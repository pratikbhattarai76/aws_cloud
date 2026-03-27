const express = require("express");
const multer = require("multer");
const path = require("path");

const env = require("./config/env");
const routes = require("./routes/pages");
const { formatBytes, formatDate, sanitizeFolderPath } = require("./utils/file-utils");
const { redirectWithMessage } = require("./utils/http");

const app = express();

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.locals.appName = env.appName;
  res.locals.assetVersion = env.assetVersion;
  res.locals.currentPath = req.path;
  res.locals.formatBytes = formatBytes;
  res.locals.formatDate = formatDate;
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    appName: env.appName,
    storageMode: env.storage.mode,
  });
});

app.use(routes);

app.use((req, res) => {
  res.status(404).render("error", {
    heading: "Page not found",
    message: "The page you requested does not exist.",
  });
});

app.use((error, req, res, next) => {
  const isXmlHttpRequest = String(req.get("x-requested-with") || "").toLowerCase() === "xmlhttprequest";
  const folder = sanitizeFolderPath(req.body?.folder);

  if (error instanceof multer.MulterError) {
    return redirectWithMessage(res, "/", "error", "The upload request could not be processed. Please try again.", {
      folder,
    });
  }

  console.error("Unhandled error:", error);

  if (res.headersSent) {
    return next(error);
  }

  if (isXmlHttpRequest) {
    return res.status(error.statusCode || 500).json({
      error: "The app hit an unexpected problem. Please try again.",
    });
  }

  return res.status(error.statusCode || 500).render("error", {
    heading: "Something went wrong",
    message: "The app hit an unexpected problem. Please try again.",
  });
});

module.exports = app;
