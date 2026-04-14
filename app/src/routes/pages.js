const express = require("express");
const { pipeline } = require("stream/promises");

const env = require("../config/env");
const upload = require("../middleware/upload");
const storage = require("../services/storage-service");
const { buildContentDisposition, sanitizeFolderPath } = require("../utils/file-utils");
const { asyncHandler, getFlash, redirectWithMessage } = require("../utils/http");

const router = express.Router();

const isStorageUnavailableError = (error) =>
  Boolean(
    error &&
      (error.code === "STORAGE_PREVIEW_MODE" ||
        error.name === "CredentialsProviderError" ||
        error.name === "AccessDenied" ||
        error.name === "NoSuchBucket")
  );

const logStorageError = (label, error) => {
  if (isStorageUnavailableError(error)) {
    console.warn(`${label}: ${env.storage.previewMessage}`);
    return;
  }

  console.error(`${label}:`, error);
};

const toStorageMessage = (error, fallback) => {
  if (!error) {
    return fallback;
  }

  if (error.code === "INVALID_FILE_ID" || error.name === "NoSuchKey") {
    return "That file link is no longer valid.";
  }

  if (error.code === "INVALID_FOLDER_NAME") {
    return "Enter a valid folder name.";
  }

  if (error.code === "FOLDER_NOT_FOUND") {
    return "That folder link is no longer valid.";
  }

  if (isStorageUnavailableError(error)) {
    return env.storage.previewMessage;
  }

  return fallback;
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const currentFolder = sanitizeFolderPath(req.query.folder);
    let folderOptions = [];
    let storageNotice = env.storage.enabled ? "" : env.storage.previewMessage;

    try {
      folderOptions = await storage.listFolderPaths();
    } catch (error) {
      logStorageError("List folders for upload error", error);
      if (isStorageUnavailableError(error)) {
        storageNotice = env.storage.previewMessage;
      }
    }

    if (currentFolder && !folderOptions.includes(currentFolder)) {
      folderOptions.unshift(currentFolder);
    }

    res.render("index", {
      currentFolder,
      flash: getFlash(req),
      folderOptions,
      storageNotice,
      uploadMaxFileSizeBytes: env.upload.maxFileSizeBytes,
    });
  })
);

router.post(
  "/upload",
  upload.array("files"),
  asyncHandler(async (req, res) => {
    const folderPath = sanitizeFolderPath(req.body.folder);
    const displayNames = Array.isArray(req.body.displayNames)
      ? req.body.displayNames
      : typeof req.body.displayNames === "string"
        ? [req.body.displayNames]
        : [];
    const relativePaths = Array.isArray(req.body.relativePaths)
      ? req.body.relativePaths
      : typeof req.body.relativePaths === "string"
        ? [req.body.relativePaths]
        : [];

    if (!req.files || !req.files.length) {
      return redirectWithMessage(res, "/", "error", "Choose at least one file before uploading.", {
        folder: folderPath,
      });
    }

    try {
      const savedFiles = await storage.uploadFiles(req.files, { displayNames, relativePaths, folderPath });
      const successMessage =
        savedFiles.length === 1 ? `${savedFiles[0].displayName} is ready.` : `${savedFiles.length} files are ready.`;

      return redirectWithMessage(res, "/files", "success", successMessage, {
        folder: folderPath,
      });
    } catch (error) {
      logStorageError("Upload error", error);
      return redirectWithMessage(res, "/", "error", toStorageMessage(error, "We could not upload your files."), {
        folder: folderPath,
      });
    }
  })
);

router.post(
  "/folders",
  asyncHandler(async (req, res) => {
    const parentFolder = sanitizeFolderPath(req.body.parentFolder);
    const redirectTo = req.body.redirectTo === "upload" ? "/" : "/files";
    const folderNames = Array.isArray(req.body.folderNames)
      ? req.body.folderNames
      : typeof req.body.folderNames === "string"
        ? [req.body.folderNames]
        : [];

    if (!folderNames.some((name) => String(name || "").trim())) {
      return redirectWithMessage(res, redirectTo, "error", "Enter a folder name.", {
        folder: parentFolder,
      });
    }

    try {
      const folders = await storage.createFolders(folderNames, parentFolder);
      const successMessage =
        folders.length === 1 ? `${folders[0].name} folder created.` : `${folders.length} folders created.`;
      const nextFolder = folders.length === 1 ? folders[0].path : parentFolder;

      return redirectWithMessage(res, redirectTo, "success", successMessage, {
        folder: nextFolder,
      });
    } catch (error) {
      logStorageError("Create folder error", error);

      return redirectWithMessage(res, redirectTo, "error", toStorageMessage(error, "We could not create that folder."), {
        folder: parentFolder,
      });
    }
  })
);

router.get(
  "/files",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const currentFolder = sanitizeFolderPath(req.query.folder);
    const flash = getFlash(req);

    try {
      const library = await storage.listEntries(search, currentFolder);

      return res.render("files", {
        flash,
        files: library.files,
        folders: library.folders,
        currentFolder: library.currentFolder,
        parentFolder: library.parentFolder,
        search,
        storageError: library.storageNotice || "",
        storageDisabled: Boolean(library.storageNotice),
      });
    } catch (error) {
      logStorageError("List files error", error);
      const storageUnavailable = isStorageUnavailableError(error);

      return res.status(storageUnavailable ? 200 : 503).render("files", {
        flash,
        files: [],
        folders: [],
        currentFolder,
        parentFolder: "",
        search,
        storageError: toStorageMessage(error, "We could not load your files right now."),
        storageDisabled: storageUnavailable,
      });
    }
  })
);

const streamFile = async (req, res, disposition) => {
  try {
    const file = await storage.getFileById(req.params.fileId);

    if (!file.body) {
      throw new Error("Storage returned an empty file stream");
    }

    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", buildContentDisposition(disposition, file.displayName));

    if (typeof file.contentLength === "number") {
      res.setHeader("Content-Length", String(file.contentLength));
    }

    await pipeline(file.body, res);
  } catch (error) {
    logStorageError(`${disposition} error`, error);

    if (res.headersSent) {
      res.destroy(error);
      return;
    }

    return redirectWithMessage(
      res,
      "/files",
      "error",
      toStorageMessage(
        error,
        disposition === "inline" ? "We could not open that file." : "We could not download that file."
      )
    );
  }
};

router.get(
  "/files/:fileId/open",
  asyncHandler(async (req, res) => {
    await streamFile(req, res, "inline");
  })
);

router.get(
  "/files/:fileId/download",
  asyncHandler(async (req, res) => {
    await streamFile(req, res, "attachment");
  })
);

router.get(
  "/folders/download",
  asyncHandler(async (req, res) => {
    const folderPath = sanitizeFolderPath(req.query.folder);
    const returnFolder = sanitizeFolderPath(req.query.returnFolder);

    try {
      const archive = await storage.getFolderArchive(folderPath);

      res.setHeader("Content-Type", archive.contentType);
      res.setHeader("Content-Disposition", buildContentDisposition("attachment", archive.displayName));

      await pipeline(archive.body, res);
    } catch (error) {
      logStorageError("Folder download error", error);

      if (res.headersSent) {
        res.destroy(error);
        return;
      }

      return redirectWithMessage(
        res,
        "/files",
        "error",
        toStorageMessage(error, "We could not download that folder."),
        { folder: returnFolder }
      );
    }
  })
);

module.exports = router;
