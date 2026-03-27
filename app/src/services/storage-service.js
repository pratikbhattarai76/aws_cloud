const {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");

const env = require("../config/env");
const {
  buildObjectKey,
  decodeFileId,
  encodeFileId,
  getFolderPathFromKey,
  getFileKind,
  getParentFolderPath,
  normalizeSearch,
  parseDisplayNameFromKey,
  sanitizeDisplayName,
  sanitizeFolderPath,
} = require("../utils/file-utils");

const s3 = new S3Client({ region: env.storage.region });

const prefix = env.storage.prefix;
const basePrefix = `${prefix}/`;
const FOLDER_PATH_CACHE_TTL_MS = 30 * 1000;
const folderPathCache = {
  value: null,
  expiresAt: 0,
  pending: null,
  generation: 0,
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
    parentPath: getParentFolderPath(path),
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
  const currentPrefix = currentFolder ? `${basePrefix}${currentFolder}/` : basePrefix;
  const response = await s3.send(
    new ListObjectsV2Command({
      Bucket: env.storage.bucketName,
      Prefix: currentPrefix,
      Delimiter: "/",
      MaxKeys: env.storage.maxListCount,
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

const uploadFiles = async (files, options = {}) => {
  const displayNames = toArray(options.displayNames);
  const relativePaths = toArray(options.relativePaths);
  const folderPath = sanitizeFolderPath(options.folderPath);

  const uploadedFiles = await Promise.all(
    files.map(async (file, index) => {
      const preferredName =
        typeof displayNames[index] === "string" && displayNames[index].trim()
          ? displayNames[index]
          : file.originalname;
      const displayName = sanitizeDisplayName(preferredName);
      const fileFolderPath = [folderPath, sanitizeFolderPath(relativePaths[index])].filter(Boolean).join("/");
      const key = buildObjectKey(displayName, env.storage.prefix, fileFolderPath);

      await s3.send(
        new PutObjectCommand({
          Bucket: env.storage.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype || "application/octet-stream",
        })
      );

      return {
        id: encodeFileId(key),
        displayName,
        folderPath,
      };
    })
  );

  invalidateFolderPathCache();
  return uploadedFiles;
};

const createFolders = async (folderNames, parentFolder = "") => {
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

const getFileById = async (fileId) => {
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
  listEntries,
  listFolderPaths,
  uploadFiles,
};
