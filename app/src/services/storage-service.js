const { createReadStream } = require("fs");
const {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");
const archiver = require("archiver");
const { unlink } = require("fs/promises");
const { PassThrough } = require("stream");
const { pipeline } = require("stream/promises");

const env = require("../config/env");
const {
  buildObjectKey,
  createCollisionDisplayName,
  decodeFileId,
  encodeFileId,
  getFolderPathFromKey,
  getFileKind,
  getParentFolderPath,
  normalizeSearch,
  parseDisplayNameFromKey,
  sanitizeDisplayName,
  sanitizeFolderName,
  sanitizeFolderPath,
} = require("../utils/file-utils");

const s3 = env.storage.enabled ? new S3Client({ region: env.storage.region }) : null;

const prefix = "";
const basePrefix = "";
const MAX_LIST_COUNT = 200;
const FOLDER_PATH_CACHE_TTL_MS = 5 * 60 * 1000;
const folderPathCache = {
  value: null,
  expiresAt: 0,
  pending: null,
  generation: 0,
};

const createStoragePreviewError = () => {
  const error = new Error(env.storage.previewMessage);
  error.code = "STORAGE_PREVIEW_MODE";
  error.statusCode = 503;
  return error;
};

const ensureStorageEnabled = () => {
  if (!env.storage.enabled) {
    throw createStoragePreviewError();
  }
};

const toFileSummary = (object) => {
  const displayName = parseDisplayNameFromKey(object.Key);

  return {
    id: encodeFileId(object.Key),
    displayName,
    folderPath: getFolderPathFromKey(object.Key, prefix),
    size: object.Size || 0,
    uploadedAt: object.LastModified || null,
    kind: getFileKind(displayName),
  };
};

const toDirectFolder = (currentFolder, name) => {
  const path = [currentFolder, name].filter(Boolean).join("/");

  return {
    name,
    path,
  };
};

const invalidateFolderPathCache = () => {
  folderPathCache.value = null;
  folderPathCache.expiresAt = 0;
  folderPathCache.pending = null;
  folderPathCache.generation += 1;
};

const listEntries = async (search, folder = "") => {
  const currentFolder = sanitizeFolderPath(folder);

  if (!env.storage.enabled) {
    return {
      currentFolder,
      files: [],
      folders: [],
      hasMore: false,
      parentFolder: getParentFolderPath(currentFolder),
      storageNotice: env.storage.previewMessage,
    };
  }

  const currentPrefix = currentFolder ? `${basePrefix}${currentFolder}/` : basePrefix;
  const response = await s3.send(
    new ListObjectsV2Command({
      Bucket: env.storage.bucketName,
      Prefix: currentPrefix,
      Delimiter: "/",
      MaxKeys: MAX_LIST_COUNT,
    })
  );
  const searchNeedle = normalizeSearch(search);
  const folders = (response.CommonPrefixes || [])
    .map((entry) => String(entry.Prefix || ""))
    .map((entryPrefix) => entryPrefix.slice(currentPrefix.length).replace(/\/$/, ""))
    .map((folderName) => sanitizeFolderPath(folderName))
    .filter(Boolean)
    .filter((folderName) => !searchNeedle || normalizeSearch(folderName).includes(searchNeedle))
    .map((folderName) => toDirectFolder(currentFolder, folderName))
    .sort((left, right) => left.name.localeCompare(right.name));

  const files = (response.Contents || [])
    .filter((object) => object.Key && object.Key !== currentPrefix && !object.Key.endsWith("/"))
    .map((object) => toFileSummary(object))
    .filter((file) => !searchNeedle || normalizeSearch(file.displayName).includes(searchNeedle));

  files.sort((left, right) => {
    const leftTime = left.uploadedAt ? new Date(left.uploadedAt).getTime() : 0;
    const rightTime = right.uploadedAt ? new Date(right.uploadedAt).getTime() : 0;

    return rightTime - leftTime;
  });

  return {
    currentFolder,
    files,
    folders,
    hasMore: Boolean(response.IsTruncated),
    parentFolder: getParentFolderPath(currentFolder),
    storageNotice: "",
  };
};

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return [value];
  }

  return [];
};

const collectFolderPaths = async () => {
  const folders = new Set();
  let continuationToken;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: env.storage.bucketName,
        Prefix: basePrefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      })
    );

    (response.Contents || []).forEach((object) => {
      if (!object.Key || !object.Key.startsWith(basePrefix)) {
        return;
      }

      const folderPath = getFolderPathFromKey(object.Key, prefix);

      if (!folderPath) {
        return;
      }

      const parts = folderPath.split("/").filter(Boolean);
      let currentPath = "";

      parts.forEach((part) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        folders.add(currentPath);
      });
    });

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return [...folders].sort((left, right) => left.localeCompare(right));
};

const listFolderPaths = async () => {
  if (!env.storage.enabled) {
    return [];
  }

  if (folderPathCache.value && folderPathCache.expiresAt > Date.now()) {
    return folderPathCache.value;
  }

  if (folderPathCache.pending) {
    return folderPathCache.pending;
  }

  const cacheGeneration = folderPathCache.generation;
  folderPathCache.pending = collectFolderPaths()
    .then((folders) => {
      if (folderPathCache.generation === cacheGeneration) {
        folderPathCache.value = folders;
        folderPathCache.expiresAt = Date.now() + FOLDER_PATH_CACHE_TTL_MS;
      }

      return folders;
    })
    .finally(() => {
      if (folderPathCache.generation === cacheGeneration) {
        folderPathCache.pending = null;
      }
    });

  return folderPathCache.pending;
};

const listFolderObjectsPage = (folderPrefix, continuationToken) =>
  s3.send(
    new ListObjectsV2Command({
      Bucket: env.storage.bucketName,
      Prefix: folderPrefix,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    })
  );

const removeUploadedTempFiles = async (files = []) => {
  await Promise.all(
    files
      .map((file) => file?.path)
      .filter(Boolean)
      .map(async (filePath) => {
        try {
          await unlink(filePath);
        } catch (error) {
          if (error?.code !== "ENOENT") {
            console.warn(`Temporary upload cleanup failed for ${filePath}:`, error);
          }
        }
      })
  );
};

const listDirectFileDisplayNames = async (folderPath = "") => {
  const currentFolder = sanitizeFolderPath(folderPath);
  const currentPrefix = currentFolder ? `${basePrefix}${currentFolder}/` : basePrefix;
  const displayNames = new Set();
  let continuationToken;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: env.storage.bucketName,
        Prefix: currentPrefix,
        Delimiter: "/",
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      })
    );

    (response.Contents || [])
      .filter((object) => object.Key && object.Key !== currentPrefix && !object.Key.endsWith("/"))
      .map((object) => parseDisplayNameFromKey(object.Key))
      .forEach((displayName) => displayNames.add(displayName));

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return displayNames;
};

const createUniqueDisplayName = (displayName, existingNames) => {
  let nextDisplayName = sanitizeDisplayName(displayName);
  let collisionIndex = 1;

  while (existingNames.has(nextDisplayName)) {
    nextDisplayName = createCollisionDisplayName(displayName, collisionIndex);
    collisionIndex += 1;
  }

  existingNames.add(nextDisplayName);
  return nextDisplayName;
};

const appendFolderObjectToArchive = async (archive, folderPrefix, archiveRoot, object) => {
  if (!object.Key || !object.Key.startsWith(folderPrefix)) {
    return;
  }

  const relativePath = object.Key.slice(folderPrefix.length);
  const entryName = relativePath ? `${archiveRoot}/${relativePath}` : `${archiveRoot}/`;

  if (object.Key.endsWith("/")) {
    archive.append("", { name: entryName });
    return;
  }

  const response = await s3.send(
    new GetObjectCommand({
      Bucket: env.storage.bucketName,
      Key: object.Key,
    })
  );

  if (!response.Body) {
    throw new Error(`Storage returned an empty file stream for ${object.Key}`);
  }

  const entryStream = new PassThrough();
  archive.append(entryStream, { name: entryName });
  await pipeline(response.Body, entryStream);
};

const uploadFiles = async (files, options = {}) => {
  const safeFiles = Array.isArray(files) ? files : [];

  try {
    ensureStorageEnabled();
    const displayNames = toArray(options.displayNames);
    const relativePaths = toArray(options.relativePaths);
    const folderPath = sanitizeFolderPath(options.folderPath);
    const folderNameCache = new Map();
    const uploadedFiles = [];

    for (const [index, file] of safeFiles.entries()) {
      const preferredName =
        typeof displayNames[index] === "string" && displayNames[index].trim()
          ? displayNames[index]
          : file.originalname;
      const fileFolderPath = [folderPath, sanitizeFolderPath(relativePaths[index])].filter(Boolean).join("/");

      if (!folderNameCache.has(fileFolderPath)) {
        folderNameCache.set(fileFolderPath, await listDirectFileDisplayNames(fileFolderPath));
      }

      const existingNames = folderNameCache.get(fileFolderPath);
      const displayName = createUniqueDisplayName(preferredName, existingNames);
      const key = buildObjectKey(displayName, prefix, fileFolderPath);

      await s3.send(
        new PutObjectCommand({
          Bucket: env.storage.bucketName,
          Key: key,
          Body: createReadStream(file.path),
          ContentLength: file.size,
          ContentType: file.mimetype || "application/octet-stream",
        })
      );

      uploadedFiles.push({
        id: encodeFileId(key),
        displayName,
      });
    }

    invalidateFolderPathCache();
    return uploadedFiles;
  } finally {
    await removeUploadedTempFiles(safeFiles);
  }
};

const createFolders = async (folderNames, parentFolder = "") => {
  ensureStorageEnabled();
  const names = toArray(folderNames)
    .flatMap((value) =>
      String(value || "")
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
    .map((name) => sanitizeFolderPath(name))
    .filter(Boolean);

  if (!names.length) {
    const error = new Error("Invalid folder name");
    error.code = "INVALID_FOLDER_NAME";
    error.statusCode = 400;
    throw error;
  }

  const uniqueNames = [...new Set(names)];

  await Promise.all(
    uniqueNames.map((name) => {
      const folderPath = [sanitizeFolderPath(parentFolder), name].filter(Boolean).join("/");

      return s3.send(
        new PutObjectCommand({
          Bucket: env.storage.bucketName,
          Key: `${basePrefix}${folderPath}/`,
          Body: "",
          ContentType: "application/x-directory",
        })
      );
    })
  );

  invalidateFolderPathCache();

  return uniqueNames.map((name) => {
    const folderPath = [sanitizeFolderPath(parentFolder), name].filter(Boolean).join("/");

    return {
      name: name.split("/").filter(Boolean).slice(-1)[0],
      path: folderPath,
    };
  });
};

const getFolderArchive = async (folderPath) => {
  ensureStorageEnabled();
  const currentFolder = sanitizeFolderPath(folderPath);

  if (!currentFolder) {
    const error = new Error("Invalid folder path");
    error.code = "INVALID_FOLDER_NAME";
    error.statusCode = 400;
    throw error;
  }

  const folderPrefix = `${basePrefix}${currentFolder}/`;
  const archiveRoot = sanitizeFolderName(currentFolder) || "folder";
  const firstPage = await listFolderObjectsPage(folderPrefix);

  if (!(firstPage.Contents || []).some((object) => object.Key && object.Key.startsWith(folderPrefix))) {
    const error = new Error("Folder not found");
    error.code = "FOLDER_NOT_FOUND";
    error.statusCode = 404;
    throw error;
  }

  const archive = archiver("zip", { zlib: { level: 9 } });

  const streamArchive = async () => {
    let response = firstPage;

    while (true) {
      for (const object of response.Contents || []) {
        await appendFolderObjectToArchive(archive, folderPrefix, archiveRoot, object);
      }

      if (!response.IsTruncated || !response.NextContinuationToken) {
        break;
      }

      response = await listFolderObjectsPage(folderPrefix, response.NextContinuationToken);
    }

    await archive.finalize();
  };

  setImmediate(() => {
    streamArchive().catch((error) => {
      archive.destroy(error);
    });
  });

  return {
    body: archive,
    contentType: "application/zip",
    displayName: `${archiveRoot}.zip`,
  };
};

const getFileById = async (fileId) => {
  ensureStorageEnabled();
  const key = decodeFileId(fileId);
  const displayName = parseDisplayNameFromKey(key);

  const response = await s3.send(
    new GetObjectCommand({
      Bucket: env.storage.bucketName,
      Key: key,
    })
  );

  return {
    body: response.Body,
    contentLength: response.ContentLength,
    contentType: response.ContentType || "application/octet-stream",
    displayName,
  };
};

module.exports = {
  createFolders,
  getFileById,
  getFolderArchive,
  listEntries,
  listFolderPaths,
  uploadFiles,
};
