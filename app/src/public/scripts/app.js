const dropzone = document.querySelector("[data-dropzone]");
const fileInput = document.querySelector("[data-file-input]");
const fileLabel = document.querySelector("[data-file-label]");
const selectedName = document.querySelector("[data-selected-name]");
const selectedMeta = document.querySelector("[data-selected-meta]");
const uploadForm = document.querySelector("[data-upload-form]");
const submitButton = document.querySelector("[data-submit-button]");
const revealItems = [...document.querySelectorAll("[data-reveal]")];

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
  const updateLabel = () => {
    const [file] = fileInput.files || [];
    const hasFile = Boolean(file);

    fileLabel.textContent = hasFile ? file.name : "No file selected";
    dropzone.classList.toggle("has-file", hasFile);

    if (selectedName) {
      selectedName.textContent = hasFile ? file.name : "No file selected";
    }

    if (selectedMeta) {
      selectedMeta.textContent = hasFile
        ? `${formatBytes(file.size)} / ${getFileTypeLabel(file)}`
        : "Once you pick a file, its size and type will appear here.";
    }
  };

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
    const files = event.dataTransfer?.files;

    if (files?.length) {
      fileInput.files = files;
      updateLabel();
    }
  });

  fileInput.addEventListener("change", updateLabel);
}

if (uploadForm && submitButton) {
  uploadForm.addEventListener("submit", () => {
    submitButton.disabled = true;
    submitButton.textContent = "Uploading...";
    uploadForm.classList.add("is-submitting");
    dropzone?.classList.add("is-submitting");
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
