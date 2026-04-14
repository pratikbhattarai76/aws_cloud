const dropzone = document.querySelector("[data-dropzone]");
const fileInput = document.querySelector("[data-file-input]");
const folderInput = document.querySelector("[data-folder-input]");
const fileLabel = document.querySelector("[data-file-label]");
const selectedSummary = document.querySelector("[data-selected-summary]");
const selectedFiles = document.querySelector("[data-selected-files]");
const selectedFileInputs = document.querySelector("[data-selected-file-inputs]");
const clearButton = document.querySelector("[data-clear-button]");
const uploadForm = document.querySelector("[data-upload-form]");
const submitButton = document.querySelector("[data-submit-button]");
const uploadProgress = document.querySelector("[data-upload-progress]");
const uploadProgressBar = document.querySelector("[data-upload-progress-bar]");
const uploadProgressPercent = document.querySelector("[data-upload-progress-percent]");
const uploadProgressStatus = document.querySelector("[data-upload-progress-status]");
const uploadProgressMeta = document.querySelector("[data-upload-progress-meta]");
const revealItems = [...document.querySelectorAll("[data-reveal]")];
const pickerMode = document.querySelector("[data-picker-mode]");
const dropzoneTitle = document.querySelector("[data-dropzone-title]");
const dropzoneHelp = document.querySelector("[data-dropzone-help]");
const uploadFolderToggle = document.querySelector("[data-upload-folder-toggle]");
const uploadFolderPanel = document.querySelector("[data-upload-folder-panel]");
const libraryFolderToggle = document.querySelector("[data-library-folder-toggle]");
const libraryFolderPanel = document.querySelector("[data-library-folder-panel]");
const uploadFolderParentInput = document.querySelector("[data-upload-folder-parent]");
const uploadTargetSelect = document.querySelector("#folder");

let selectedFileState = [];
let selectedDisplayNameState = [];
const MAX_VISIBLE_FILE_ROWS = 24;
let syncSelectedFileInputsForSubmit = () => {};
const uploadMaxBytes = Number.parseInt(uploadForm?.dataset.uploadMaxBytes || "0", 10) || 0;

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

const getSelectedUploadStats = () => ({
  fileCount: selectedFileState.length,
  totalBytes: selectedFileState.reduce((sum, file) => sum + (Number(file.size) || 0), 0),
});

const getSelectedUploadLabel = () => {
  const { fileCount, totalBytes } = getSelectedUploadStats();

  if (!fileCount) {
    return "Select files to begin.";
  }

  const countLabel = fileCount === 1 ? "1 file selected" : `${fileCount} files selected`;
  return `${countLabel} / ${formatBytes(totalBytes)}`;
};

const getUploadSizeError = (oversizedFiles) => {
  if (!Array.isArray(oversizedFiles) || !oversizedFiles.length) {
    return "";
  }

  const maxSizeLabel = formatBytes(uploadMaxBytes);
  const exampleFile = oversizedFiles[0];

  if (oversizedFiles.length === 1) {
    return `${exampleFile.name} is ${formatBytes(exampleFile.size)} and exceeds the ${maxSizeLabel} upload limit.`;
  }

  return `${oversizedFiles.length} files exceed the ${maxSizeLabel} upload limit.`;
};

const setUploadProgressState = ({ hidden = false, status = "Ready to upload.", meta = getSelectedUploadLabel(), percent = 0, error = false } = {}) => {
  if (!uploadProgress || !uploadProgressBar || !uploadProgressPercent || !uploadProgressStatus || !uploadProgressMeta) {
    return;
  }

  uploadProgress.hidden = hidden;
  uploadProgress.classList.toggle("is-error", error);

  if (Number.isFinite(percent)) {
    const normalizedPercent = Math.max(0, Math.min(percent, 100));
    uploadProgressBar.value = normalizedPercent;
    uploadProgressPercent.textContent = `${Math.round(normalizedPercent)}%`;
  } else {
    uploadProgressBar.removeAttribute("value");
    uploadProgressPercent.textContent = "--";
  }

  uploadProgressStatus.textContent = status;
  uploadProgressMeta.textContent = meta;
};

const resetUploadProgress = (hidden = true) => {
  if (!uploadProgressBar) {
    return;
  }

  uploadProgressBar.max = 100;
  setUploadProgressState({
    hidden,
    percent: 0,
    status: "Ready to upload.",
    meta: getSelectedUploadLabel(),
    error: false,
  });
};

const bindTogglePanel = (toggleButton, targetPanel) => {
  if (!toggleButton || !targetPanel) {
    return;
  }

  const positionPanel = () => {
    if (toggleButton.getAttribute("aria-expanded") !== "true") {
      return;
    }

    if (window.matchMedia("(max-width: 760px)").matches) {
      targetPanel.style.position = "";
      targetPanel.style.top = "";
      targetPanel.style.left = "";
      targetPanel.style.width = "";
      return;
    }

    const offsetParent = targetPanel.offsetParent || targetPanel.parentElement;

    if (!offsetParent) {
      return;
    }

    const parentRect = offsetParent.getBoundingClientRect();
    const buttonRect = toggleButton.getBoundingClientRect();
    const sidePadding = 16;
    const verticalOffset = 10;
    const preferredWidth = Math.min(448, Math.max(280, parentRect.width - sidePadding * 2));
    const maxLeft = Math.max(sidePadding, parentRect.width - preferredWidth - sidePadding);
    const alignedLeft = buttonRect.right - parentRect.left - preferredWidth;
    const left = Math.min(Math.max(alignedLeft, sidePadding), maxLeft);

    targetPanel.style.position = "absolute";
    targetPanel.style.width = `${preferredWidth}px`;
    targetPanel.style.left = `${left}px`;

    const panelHeight = targetPanel.offsetHeight;
    const preferredTop = buttonRect.top - parentRect.top - panelHeight - verticalOffset;
    const fallbackTop = buttonRect.bottom - parentRect.top + verticalOffset;
    const top = preferredTop >= sidePadding ? preferredTop : fallbackTop;

    targetPanel.style.top = `${Math.max(sidePadding, top)}px`;
  };

  const setPanelOpenState = (nextState) => {
    toggleButton.setAttribute("aria-expanded", String(nextState));
    targetPanel.hidden = !nextState;

    if (nextState) {
      requestAnimationFrame(() => {
        positionPanel();
        targetPanel.querySelector("textarea, input, select")?.focus();
      });
    } else {
      targetPanel.style.position = "";
      targetPanel.style.top = "";
      targetPanel.style.left = "";
      targetPanel.style.width = "";
      toggleButton.focus();
    }
  };

  toggleButton.addEventListener("click", () => {
    const isOpen = toggleButton.getAttribute("aria-expanded") === "true";
    setPanelOpenState(!isOpen);
  });

  targetPanel.querySelectorAll("[data-panel-close]").forEach((button) => {
    button.addEventListener("click", () => setPanelOpenState(false));
  });

  targetPanel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setPanelOpenState(false);
    }
  });

  document.addEventListener("click", (event) => {
    const isOpen = toggleButton.getAttribute("aria-expanded") === "true";

    if (!isOpen) {
      return;
    }

    if (toggleButton.contains(event.target) || targetPanel.contains(event.target)) {
      return;
    }

    setPanelOpenState(false);
  });

  window.addEventListener("resize", positionPanel);
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
    selectedDisplayNameState = selectedDisplayNameState.filter((_, fileIndex) => fileIndex !== index);
    resetUploadProgress(true);
    syncInputFiles();
    renderFiles();
  };

  syncSelectedFileInputsForSubmit = () => {
    if (!selectedFileInputs) {
      return;
    }

    const fragment = document.createDocumentFragment();

    selectedFileState.forEach((file, index) => {
      const displayNameInput = document.createElement("input");
      displayNameInput.type = "hidden";
      displayNameInput.name = "displayNames";
      displayNameInput.value = selectedDisplayNameState[index] || file.name;

      const relativePathInput = document.createElement("input");
      relativePathInput.type = "hidden";
      relativePathInput.name = "relativePaths";
      relativePathInput.value = getRelativeFolderPath(file);

      fragment.append(displayNameInput, relativePathInput);
    });

    selectedFileInputs.replaceChildren(fragment);
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
    input.type = "text";
    input.value = selectedDisplayNameState[index] || file.name;
    input.autocomplete = "off";
    input.addEventListener("input", (event) => {
      selectedDisplayNameState[index] = event.target.value;
    });

    const meta = document.createElement("p");
    meta.className = "selected-file-meta";
    meta.textContent = [
      formatBytes(file.size),
      getFileTypeLabel(file),
      getRelativeFolderPath(file) ? `Folder: ${getRelativeFolderPath(file)}` : "Folder: selected target",
    ].join(" / ");

    const removeButton = document.createElement("button");
    removeButton.className = "button button-ghost";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removeFileAt(index));

    fields.append(label, input, meta);
    wrapper.append(fields, removeButton);

    return wrapper;
  };

  const renderEmptyState = () => {
    selectedFileInputs?.replaceChildren();
    if (selectedSummary) {
      selectedSummary.textContent = "";
      selectedSummary.hidden = true;
    }

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
    const selectedUploadLabel = getSelectedUploadLabel();

    fileLabel.textContent = hasFiles
      ? selectedUploadLabel
      : "No file selected";
    dropzone.classList.toggle("has-file", hasFiles);

    if (selectedSummary) {
      selectedSummary.hidden = !hasFiles;
      selectedSummary.textContent = hasFiles ? `Total selected: ${selectedUploadLabel}` : "";
    }

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

    const visibleRows = selectedFileState
      .slice(0, MAX_VISIBLE_FILE_ROWS)
      .map((file, index) => buildFileRow(file, index));

    if (fileCount > MAX_VISIBLE_FILE_ROWS) {
      const summary = document.createElement("p");
      summary.className = "preview-meta";
      summary.textContent = `Showing first ${MAX_VISIBLE_FILE_ROWS} of ${fileCount} files to keep the page responsive. All selected files will still upload.`;
      selectedFiles.replaceChildren(summary, ...visibleRows);
      return;
    }

    selectedFiles.replaceChildren(...visibleRows);
  };

  const mergeFiles = (incomingFiles) => {
    const nextFiles = Array.from(incomingFiles || []);

    if (!nextFiles.length) {
      resetUploadProgress(true);
      renderFiles();
      return;
    }

    const oversizedFiles =
      uploadMaxBytes > 0 ? nextFiles.filter((file) => Number(file.size) > uploadMaxBytes) : [];
    const acceptedFiles =
      oversizedFiles.length > 0 ? nextFiles.filter((file) => Number(file.size) <= uploadMaxBytes) : nextFiles;

    if (!acceptedFiles.length && oversizedFiles.length) {
      setUploadProgressState({
        hidden: false,
        percent: 0,
        status: "Some files were not added.",
        meta: getUploadSizeError(oversizedFiles),
        error: true,
      });
      return;
    }

    resetUploadProgress(true);

    const existingKeys = new Set(
      selectedFileState.map((file) => `${file.name}:${file.size}:${file.lastModified}:${file.type}`)
    );

    acceptedFiles.forEach((file) => {
      const fileKey = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;

      if (!existingKeys.has(fileKey)) {
        selectedFileState.push(file);
        selectedDisplayNameState.push(file.name);
        existingKeys.add(fileKey);
      }
    });

    syncInputFiles();
    renderFiles();

    if (oversizedFiles.length) {
      setUploadProgressState({
        hidden: false,
        percent: 0,
        status: "Some files were skipped.",
        meta: getUploadSizeError(oversizedFiles),
        error: true,
      });
    }
  };

  const clearSelection = () => {
    selectedFileState = [];
    selectedDisplayNameState = [];
    fileInput.value = "";
    if (folderInput) {
      folderInput.value = "";
    }
    fileLabel.textContent = "No file selected";
    dropzone.classList.remove("has-file");

    if (clearButton) {
      clearButton.disabled = true;
    }

    resetUploadProgress(true);
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
  folderInput?.addEventListener("change", () => {
    folderInput.value = "";
  });
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
  const defaultSubmitLabel = submitButton.textContent;

  const setUploadingState = (isUploading, buttonLabel = defaultSubmitLabel) => {
    submitButton.disabled = isUploading;
    submitButton.textContent = buttonLabel;
    uploadForm.classList.toggle("is-submitting", isUploading);
    dropzone?.classList.toggle("is-submitting", isUploading);

    [...uploadForm.querySelectorAll("input, select, textarea, button")].forEach((field) => {
      if (field === submitButton) {
        return;
      }

      field.disabled = isUploading;
    });
  };

  uploadForm.addEventListener("submit", (event) => {
    syncSelectedFileInputsForSubmit();

    if (typeof XMLHttpRequest === "undefined" || typeof FormData === "undefined") {
      setUploadingState(true, "Uploading...");
      return;
    }

    event.preventDefault();

    const formData = new FormData(uploadForm);
    const { fileCount, totalBytes } = getSelectedUploadStats();
    const fileLabelText = fileCount === 1 ? "1 file" : `${fileCount} files`;

    setUploadingState(true, "Uploading...");
    setUploadProgressState({
      hidden: false,
      percent: 0,
      status: "Starting upload...",
      meta: `${fileLabelText} queued / ${formatBytes(totalBytes)}`,
      error: false,
    });

    const request = new XMLHttpRequest();
    request.open((uploadForm.method || "POST").toUpperCase(), uploadForm.action || window.location.href);
    request.responseType = "json";
    request.setRequestHeader("Accept", "application/json");
    request.setRequestHeader("X-Requested-With", "XMLHttpRequest");

    request.upload.addEventListener("progress", (progressEvent) => {
      if (!progressEvent.lengthComputable) {
        setUploadProgressState({
          hidden: false,
          percent: Number.NaN,
          status: "Uploading files...",
          meta: `${fileLabelText} in progress / about ${formatBytes(totalBytes)}`,
          error: false,
        });
        return;
      }

      const percent = progressEvent.total > 0 ? (progressEvent.loaded / progressEvent.total) * 100 : 0;

      setUploadProgressState({
        hidden: false,
        percent,
        status: percent >= 100 ? "Finishing upload..." : "Uploading files...",
        meta: `${formatBytes(progressEvent.loaded)} of ${formatBytes(progressEvent.total)} sent`,
        error: false,
      });
    });

    request.upload.addEventListener("load", () => {
      setUploadingState(true, "Processing...");
      setUploadProgressState({
        hidden: false,
        percent: 100,
        status: "Upload complete. Finalizing in storage...",
        meta: "Please wait while the server saves your files.",
        error: false,
      });
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300 && request.response?.redirectTo) {
        window.location.assign(request.response.redirectTo);
        return;
      }

      setUploadingState(false);
      const responseError =
        typeof request.response?.error === "string" && request.response.error
          ? request.response.error
          : request.status === 413
            ? uploadMaxBytes > 0
              ? `These files exceed the ${formatBytes(uploadMaxBytes)} upload limit for this server.`
              : "These files are too large for this upload endpoint."
            : "Please try again.";

      setUploadProgressState({
        hidden: false,
        percent: 0,
        status: "We could not upload those files.",
        meta: responseError,
        error: true,
      });
    });

    request.addEventListener("error", () => {
      setUploadingState(false);
      setUploadProgressState({
        hidden: false,
        percent: 0,
        status: "The upload was interrupted.",
        meta: "Check your connection and try again.",
        error: true,
      });
    });

    request.addEventListener("abort", () => {
      setUploadingState(false);
      setUploadProgressState({
        hidden: false,
        percent: 0,
        status: "The upload was cancelled.",
        meta: "Choose files again when you are ready.",
        error: true,
      });
    });

    request.send(formData);
  });
}

bindTogglePanel(uploadFolderToggle, uploadFolderPanel);
bindTogglePanel(libraryFolderToggle, libraryFolderPanel);

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
