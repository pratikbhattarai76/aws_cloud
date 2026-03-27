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

const listEntries = async (search, folder = "") => {
  const response = await s3.send(
    new ListObjectsV2Command({
      Bucket: env.storage.bucketName,
      Prefix: basePrefix,
      MaxKeys: env.storage.maxListCount,
    })
  );

  const currentFolder = sanitizeFolderPath(folder);
  const currentPrefix = currentFolder ? `${basePrefix}${currentFolder}/` : basePrefix;
  const searchNeedle = normalizeSearch(search);
  const folderMap = new Map();
  const files = [];

  (response.Contents || []).forEach((object) => {
    if (!object.Key || !object.Key.startsWith(currentPrefix)) {
      return;
    }

    const relativePath = object.Key.slice(currentPrefix.length);

    if (!relativePath) {
      return;
    }

    const parts = relativePath.split("/").filter(Boolean);

    if (!parts.length) {
      return;
    }

    if (parts.length > 1 || object.Key.endsWith("/")) {
      const folderName = parts[0];

      if (searchNeedle && !normalizeSearch(folderName).includes(searchNeedle)) {
        return;
      }

      if (!folderMap.has(folderName)) {
        folderMap.set(folderName, toDirectFolder(currentFolder, folderName));
      }

      return;
    }

    const file = toFileSummary(object);

    if (!searchNeedle || normalizeSearch(file.displayName).includes(searchNeedle)) {
      files.push(file);
    }
  });

  files.sort((left, right) => {
      const leftTime = left.uploadedAt ? new Date(left.uploadedAt).getTime() : 0;
      const rightTime = right.uploadedAt ? new Date(right.uploadedAt).getTime() : 0;

      return rightTime - leftTime;
    });

  return {
    currentFolder,
    files,
    folders: [...folderMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
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

const listFolderPaths = async () => {
  const response = await s3.send(
    new ListObjectsV2Command({
      Bucket: env.storage.bucketName,
      Prefix: basePrefix,
      MaxKeys: env.storage.maxListCount,
    })
  );

  const folders = new Set();

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

  return [...folders].sort((left, right) => left.localeCompare(right));
};

const uploadFiles = async (files, options = {}) => {
  const displayNames = toArray(options.displayNames);
  const relativePaths = toArray(options.relativePaths);
  const folderPath = sanitizeFolderPath(options.folderPath);

  return Promise.all(
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
