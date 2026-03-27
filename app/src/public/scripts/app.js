const dropzone = document.querySelector("[data-dropzone]");
const fileInput = document.querySelector("[data-file-input]");
const folderInput = document.querySelector("[data-folder-input]");
const fileLabel = document.querySelector("[data-file-label]");
const selectedFiles = document.querySelector("[data-selected-files]");
const clearButton = document.querySelector("[data-clear-button]");
const uploadForm = document.querySelector("[data-upload-form]");
const submitButton = document.querySelector("[data-submit-button]");
const revealItems = [...document.querySelectorAll("[data-reveal]")];
const actionToggle = document.querySelector("[data-action-toggle]");
const actionsPanel = document.querySelector("[data-actions-panel]");
const pickerMode = document.querySelector("[data-picker-mode]");
const dropzoneTitle = document.querySelector("[data-dropzone-title]");
const dropzoneHelp = document.querySelector("[data-dropzone-help]");
const uploadFolderToggle = document.querySelector("[data-upload-folder-toggle]");
const uploadFolderPanel = document.querySelector("[data-upload-folder-panel]");
const uploadFolderParentInput = document.querySelector("[data-upload-folder-parent]");
const uploadTargetSelect = document.querySelector("#folder");

let selectedFileState = [];

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const value = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / 1024 ** value;
  const precision = size >= 10 || value === 0 ? 0 : 1;

  return `${size.toFixed(precision)} ${units[value]}`;
};

const getFileTypeLabel = (file) => {
  if (file.type) {
    return file.type;
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "";
  return extension ? `${extension.toUpperCase()} file` : "Unknown type";
};

if (dropzone && fileInput && fileLabel) {
  const getCurrentMode = () => (pickerMode?.value === "folder" ? "folder" : "files");

  const getRelativeFolderPath = (file) => {
    const relativePath = typeof file.webkitRelativePath === "string" ? file.webkitRelativePath : "";

    if (!relativePath.includes("/")) {
      return "";
    }

    return relativePath.split("/").slice(0, -1).join("/");
  };

  const updatePickerMode = () => {
    const isFolderMode = getCurrentMode() === "folder";

    if (dropzoneTitle) {
      dropzoneTitle.textContent = isFolderMode ? "Browse a folder from this device" : "Browse files from this device";
    }

    if (dropzoneHelp) {
      dropzoneHelp.textContent = isFolderMode
        ? "Choose one local folder and its files will keep their folder structure."
        : "You can also drag and drop multiple files into this area.";
    }

    dropzone.setAttribute("for", isFolderMode ? "folders" : "files");
    fileInput.required = !isFolderMode;

    if (folderInput) {
      folderInput.required = isFolderMode;
    }
  };

  const syncUploadFolderParent = () => {
    if (!uploadFolderParentInput || !uploadTargetSelect) {
      return;
    }

    uploadFolderParentInput.value = uploadTargetSelect.value;
  };

  const syncInputFiles = () => {
    if (typeof DataTransfer === "undefined") {
      return;
    }

    const transfer = new DataTransfer();
    selectedFileState.forEach((file) => transfer.items.add(file));
    fileInput.files = transfer.files;
  };

  const removeFileAt = (index) => {
    selectedFileState = selectedFileState.filter((_, fileIndex) => fileIndex !== index);
    syncInputFiles();
    renderFiles();
  };

  const buildFileRow = (file, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "selected-file-row";

    const fields = document.createElement("div");
    fields.className = "selected-file-fields";

    const label = document.createElement("label");
    label.className = "field-label";
    label.setAttribute("for", `display-name-${index}`);
    label.textContent = file.webkitRelativePath || `File ${index + 1}`;

    const input = document.createElement("input");
    input.className = "text-input";
    input.id = `display-name-${index}`;
    input.name = "displayNames";
    input.type = "text";
    input.value = file.name;
    input.autocomplete = "off";

    const meta = document.createElement("p");
    meta.className = "selected-file-meta";
    meta.textContent = [
      formatBytes(file.size),
      getFileTypeLabel(file),
      getRelativeFolderPath(file) ? `Folder: ${getRelativeFolderPath(file)}` : "Folder: selected target",
    ].join(" / ");

    const relativePathInput = document.createElement("input");
    relativePathInput.type = "hidden";
    relativePathInput.name = "relativePaths";
    relativePathInput.value = getRelativeFolderPath(file);

    const removeButton = document.createElement("button");
    removeButton.className = "button button-ghost";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removeFileAt(index));

    fields.append(label, input, meta, relativePathInput);
    wrapper.append(fields, removeButton);

    return wrapper;
  };

  const renderEmptyState = () => {
    if (!selectedFiles) {
      return;
    }

    const message = document.createElement("p");
    message.className = "preview-meta";
    message.textContent = "No file selected.";
    selectedFiles.replaceChildren(message);
  };

  const renderFiles = () => {
    const fileCount = selectedFileState.length;
    const hasFiles = fileCount > 0;

    fileLabel.textContent = hasFiles
      ? fileCount === 1
        ? selectedFileState[0].name
        : `${fileCount} files selected`
      : "No file selected";
    dropzone.classList.toggle("has-file", hasFiles);

    if (clearButton) {
      clearButton.disabled = !hasFiles;
    }

    if (!selectedFiles) {
      return;
    }

    if (!hasFiles) {
      renderEmptyState();
      return;
    }

    selectedFiles.replaceChildren(...selectedFileState.map((file, index) => buildFileRow(file, index)));
  };

  const mergeFiles = (incomingFiles) => {
    const nextFiles = Array.from(incomingFiles || []);

    if (!nextFiles.length) {
      renderFiles();
      return;
    }

    const existingKeys = new Set(
      selectedFileState.map((file) => `${file.name}:${file.size}:${file.lastModified}:${file.type}`)
    );

    nextFiles.forEach((file) => {
      const fileKey = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;

      if (!existingKeys.has(fileKey)) {
        selectedFileState.push(file);
        existingKeys.add(fileKey);
      }
    });

    syncInputFiles();
    renderFiles();
  };

  const clearSelection = () => {
    selectedFileState = [];
    fileInput.value = "";
    if (folderInput) {
      folderInput.value = "";
    }
    fileLabel.textContent = "No file selected";
    dropzone.classList.remove("has-file");

    if (clearButton) {
      clearButton.disabled = true;
    }

    renderEmptyState();
  };

  dropzone.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    if (getCurrentMode() === "folder" && folderInput) {
      folderInput.click();
      return;
    }

    fileInput.click();
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragover");
    });
  });

  ["dragleave", "dragend", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragover");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    if (getCurrentMode() === "folder") {
      return;
    }

    const files = event.dataTransfer?.files;

    if (files?.length) {
      mergeFiles(files);
    }
  });

  fileInput.addEventListener("change", () => mergeFiles(fileInput.files));
  folderInput?.addEventListener("change", () => mergeFiles(folderInput.files));
  uploadTargetSelect?.addEventListener("change", syncUploadFolderParent);
  pickerMode?.addEventListener("change", () => {
    clearSelection();
    updatePickerMode();
  });
  clearButton?.addEventListener("click", clearSelection);
  clearSelection();
  syncUploadFolderParent();
  updatePickerMode();
}

if (uploadForm && submitButton) {
  uploadForm.addEventListener("submit", () => {
    submitButton.disabled = true;
    submitButton.textContent = "Uploading...";
    uploadForm.classList.add("is-submitting");
    dropzone?.classList.add("is-submitting");
  });
}

if (actionToggle && actionsPanel) {
  actionToggle.addEventListener("click", () => {
    const isOpen = actionToggle.getAttribute("aria-expanded") === "true";
    const nextState = !isOpen;

    actionToggle.setAttribute("aria-expanded", String(nextState));
    actionsPanel.hidden = !nextState;
  });
}

if (uploadFolderToggle && uploadFolderPanel) {
  uploadFolderToggle.addEventListener("click", () => {
    const isOpen = uploadFolderToggle.getAttribute("aria-expanded") === "true";
    const nextState = !isOpen;

    uploadFolderToggle.setAttribute("aria-expanded", String(nextState));
    uploadFolderPanel.hidden = !nextState;
  });
}

if (revealItems.length) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.18,
      }
    );

    revealItems.forEach((item, index) => {
      item.style.setProperty("--reveal-delay", `${Math.min(index * 90, 450)}ms`);
      observer.observe(item);
    });
  }
}
