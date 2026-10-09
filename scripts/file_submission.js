// Generic, config-driven upload client.
// Behaviour (number of upload boxes, labels, validation rules, wording) is
// entirely driven by window.UPLOADER_CONFIG, which is emitted per service as
// config.js. This single script serves every service.
console.log("file_submission.js loaded - generic config-driven version");

// API Configuration (api_url injected at render time by Terraform templatefile).
const url = "${api_url}pre-signed-url";
const options = {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
};

// ---------------------------------------------------------------------------
// Config access
// ---------------------------------------------------------------------------
const CONFIG = window.UPLOADER_CONFIG || {};
const BOXES = Array.isArray(CONFIG.boxes) ? CONFIG.boxes : [];
const CROSS_FILE_RULES = Array.isArray(CONFIG.cross_file_rules)
  ? CONFIG.cross_file_rules
  : [];
const CONTACT_EMAIL =
  (CONFIG.wording && CONFIG.wording.contact_email) || "the service team";

// ---------------------------------------------------------------------------
// DOM id helpers (must match modules/render_service box fragment markup)
// ---------------------------------------------------------------------------
function boxInput(boxId) {
  return document.getElementById(boxId + "-input");
}
function boxErrorPanel(boxId) {
  return document.getElementById(boxId + "-file-error");
}
function boxErrorText(boxId) {
  return document.getElementById(boxId + "-file-type-error");
}

// ---------------------------------------------------------------------------
// Error presentation helpers
// ---------------------------------------------------------------------------
function showFormWithError(applyErrors) {
  document.getElementById("upload-banner").style.display = "none";
  document.getElementById("form").style.display = "block";
  applyErrors();
}

function extractCodeFromURL() {
  // Page filename is "<lad_code>-<clean name>.html"; the code is before the first "-".
  const currentUrl = window.location.href;
  const urlParts = currentUrl.split("/");
  const lastPart = urlParts[urlParts.length - 1];
  return lastPart.split("-")[0];
}

function extractCouncilNameFromURL() {
  const currentUrl = window.location.href;
  const urlParts = currentUrl.split("/");
  const lastPart = urlParts[urlParts.length - 1];
  const parts = lastPart.split("-");
  parts.shift(); // remove the code
  return parts.join("-").replace(".html", "");
}

function commonErrorStyle(errorCount) {
  const errorsList = document.getElementById("errors-list");
  const errorsTitle = document.getElementById("errors-list-title");

  if (errorCount === 1) {
    errorsTitle.innerHTML =
      '<h2 class="ons-panel__title ons-u-fs-r--b">There is 1 problem with your answer</h2>';
  } else {
    errorsTitle.innerHTML =
      `<h2 class="ons-panel__title ons-u-fs-r--b">There are $${errorCount} problems with your answer</h2>`;
  }

  errorsList.hidden = false;
  setTimeout(() => {
    errorsList.focus();
  }, 0);
}

function injectAssistiveErrorText(panelElement) {
  if (panelElement && !panelElement.querySelector(".ons-panel__assistive-text")) {
    const span = document.createElement("span");
    span.className = "ons-panel__assistive-text ons-u-vh";
    span.textContent = "Error: ";
    panelElement.insertBefore(span, panelElement.firstChild);
  }
}

// Apply the error styling to a single box's panel and reveal its message text.
function markBoxError(boxId) {
  const panel = boxErrorPanel(boxId);
  const text = boxErrorText(boxId);
  if (panel) {
    panel.classList.add("ons-panel--error", "ons-panel--no-title");
    injectAssistiveErrorText(panel);
  }
  if (text) {
    text.style.display = "block";
  }
}

function clearBoxError(boxId) {
  const panel = boxErrorPanel(boxId);
  const text = boxErrorText(boxId);
  if (panel) {
    panel.classList.remove("ons-panel--error", "ons-panel--no-title");
  }
  if (text) {
    text.style.display = "none";
  }
}

function addItem(line, anchor) {
  const olObj = document.getElementById("errors-list-item");
  olObj.innerHTML =
    olObj.innerHTML +
    "<li class='ons-list__item'><a class='ons-list__link ons-js-inpagelink' href='#" +
    anchor +
    "'>" +
    line +
    "</a></li>";
}

function clearErrors() {
  const errorsList = document.getElementById("errors-list");
  errorsList.hidden = true;
  document.getElementById("errors-list-item").innerHTML = "";
  BOXES.forEach((box) => clearBoxError(box.id));
}

// ---------------------------------------------------------------------------
// Per-box validation helpers
// ---------------------------------------------------------------------------
function fileExtension(name) {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx).toLowerCase();
}

// A file is accepted if its extension OR its MIME type matches one allowed value.
function typeAllowed(box, file) {
  const exts = (box.accepted_extensions || []).map((e) => e.toLowerCase());
  const types = box.accepted_types || [];
  const extOk = exts.length === 0 || exts.includes(fileExtension(file.name));
  const typeOk = types.length === 0 || types.includes(file.type);
  // Accept if it matches an allowed extension or an allowed MIME type.
  return extOk || typeOk;
}

// Build the filename regex from the box prefix + code + 8-digit date + extension.
function filenamePattern(box, code) {
  const exts = (box.accepted_extensions || [".csv"]).map((e) =>
    e.replace(/^\./, "").replace(/[.*+?^$()[\]{}|\\]/g, "\\$&"),
  );
  const extGroup = exts.length ? `($${exts.join("|")})` : "csv";
  return new RegExp(
    "^" + box.filename_prefix + code + "_\\d{8}\\." + extGroup + "$",
    "i",
  );
}

function dateSuffix(name) {
  const m = name.match(/_(\d{8})\./);
  return m ? m[1] : null;
}

// Human-readable list of the file types a box accepts, e.g. ".csv" or ".csv or .txt".
// Prefers extensions (friendlier) and falls back to MIME types only if no extensions are set.
function allowedTypesText(box) {
  const parts =
    box.accepted_extensions && box.accepted_extensions.length
      ? box.accepted_extensions
      : box.accepted_types || [];
  if (parts.length === 0) return "the correct type";
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(", ") + " or " + parts[parts.length - 1];
}

// Example of the filename the box expects, e.g. "CTAX_EXTRACT_E07000223_yyyymmdd.csv".
function expectedFilename(box, code) {
  const ext = (box.accepted_extensions && box.accepted_extensions[0]) || ".csv";
  return box.filename_prefix + code + "_yyyymmdd" + ext;
}

// ---------------------------------------------------------------------------
// Error message templates. Built-in defaults can be overridden per service via
// config.wording.errors.<key>. Templates use {placeholder} substitution.
// ---------------------------------------------------------------------------
const DEFAULT_ERRORS = {
  missing_required: "You need to add the {label}",
  wrong_type: "File is not {types}",
  missing_code: "File name does not contain matching code",
  wrong_filename: "File name must match {expected}",
  names_dont_match: "File names do not match",
  upload_failed: "There has been an issue with the upload, please contact {contact}",
};

const ERROR_OVERRIDES =
  (CONFIG.wording && CONFIG.wording.errors) || {};

function errorMessage(key, vars) {
  const template = ERROR_OVERRIDES[key] || DEFAULT_ERRORS[key] || "";
  return template.replace(/\{(\w+)\}/g, (m, name) =>
    name in (vars || {}) ? vars[name] : m,
  );
}

// Common substitution variables for a given box.
function boxVars(box, extra) {
  return Object.assign(
    {
      label: (box.label || "").replace(/^Upload /, ""),
      types: allowedTypesText(box),
      contact: CONTACT_EMAIL,
    },
    extra || {},
  );
}

// ---------------------------------------------------------------------------
// Form submission handler
// ---------------------------------------------------------------------------
document.getElementById("form").addEventListener("submit", function (e) {
  e.preventDefault();
  const form = this;

  clearErrors();

  const code = extractCodeFromURL();
  let councilName = encodeURIComponent(extractCouncilNameFromURL());

  let errCount = 0;
  // Collect the files that were actually provided, keyed by box id.
  const provided = {};

  // --- Presence + per-file validation ---
  BOXES.forEach((box) => {
    const input = boxInput(box.id);
    const file = input && input.files.length > 0 ? input.files[0] : null;

    if (!file) {
      if (box.required) {
        markBoxError(box.id);
        addItem(errorMessage("missing_required", boxVars(box)), box.id + "-input");
        errCount++;
      }
      return; // optional + empty => skip
    }

    let boxValid = true;

    if (!typeAllowed(box, file)) {
      markBoxError(box.id);
      addItem(errorMessage("wrong_type", boxVars(box)), box.id + "-input");
      errCount++;
      boxValid = false;
    }

    if (!file.name.includes(code)) {
      markBoxError(box.id);
      addItem(errorMessage("missing_code", boxVars(box)), box.id + "-input");
      errCount++;
      boxValid = false;
    } else if (!filenamePattern(box, code).test(file.name)) {
      markBoxError(box.id);
      addItem(
        errorMessage("wrong_filename", boxVars(box, { expected: expectedFilename(box, code) })),
        box.id + "-input",
      );
      errCount++;
      boxValid = false;
    }

    if (boxValid) {
      provided[box.id] = file;
    }
  });

  if (errCount > 0) {
    commonErrorStyle(errCount);
    return false;
  }

  // --- Cross-file rules (only across boxes that have files present) ---
  for (const rule of CROSS_FILE_RULES) {
    if (rule.type === "matching_date_suffix") {
      const dates = rule.boxes
        .filter((bid) => provided[bid])
        .map((bid) => dateSuffix(provided[bid].name))
        .filter(Boolean);
      const allMatch = dates.every((d) => d === dates[0]);
      if (dates.length > 1 && !allMatch) {
        rule.boxes.forEach((bid) => {
          if (provided[bid]) markBoxError(bid);
        });
        addItem(errorMessage("names_dont_match", {}), rule.boxes[0] + "-input");
        commonErrorStyle(1);
        return false;
      }
    }
  }

  // --- Build the request describing the provided files ---
  const files = Object.keys(provided).map((boxId) => {
    const f = provided[boxId];
    return { boxId, name: f.name, type: f.type, size: f.size };
  });

  const urlWithParameters =
    url +
    `?serviceId=$${encodeURIComponent(CONFIG.service_id)}` +
    `&councilName=$${councilName}` +
    `&files=$${encodeURIComponent(JSON.stringify(files))}`;

  document.getElementById("form").style.display = "none";
  document.getElementById("upload-banner").style.display = "block";

  fetch(urlWithParameters, options)
    .then((response) => response.json())
    .then((data) => {
      console.log("message : " + data.message);

      if (data.message && data.message !== "Success") {
        // Map a structured server message back to the relevant box if possible.
        showFormWithError(() => {
          const boxId = data.boxId || (files[0] && files[0].boxId);
          if (boxId) markBoxError(boxId);
          addItem(data.message, (boxId || "form") + "-input");
          commonErrorStyle(1);
        });
        return;
      }

      const uploads = data.uploads || {};
      const uploadPromises = Object.keys(provided).map((boxId) =>
        uploadFile(uploads[boxId], provided[boxId]),
      );

      Promise.all(uploadPromises)
        .then(() => {
          window.location.href = "success.html";
        })
        .catch((error) => {
          console.error("Error uploading files:", error);
          showFormWithError(() => {
            Object.keys(provided).forEach((bid) => markBoxError(bid));
            addItem(
              errorMessage("upload_failed", { contact: CONTACT_EMAIL }),
              (files[0] ? files[0].boxId : "form") + "-input",
            );
            commonErrorStyle(1);
          });
        });
    });
});

// ---------------------------------------------------------------------------
// Upload helpers (unchanged behaviour: single PUT or S3 multipart)
// ---------------------------------------------------------------------------
async function uploadFile(uploadData, file) {
  console.log("uploading file " + file.name);

  if (uploadData.multipart) {
    window.localStorage.setItem("lastUploadWasMultipart", "true");
    return await uploadMultipartFile(uploadData, file);
  } else {
    window.localStorage.setItem("lastUploadWasMultipart", "false");
    return await fetch(uploadData.uploadURL, {
      method: "PUT",
      body: file,
    }).then((resp) => {
      return resp.text().then((body) => {
        const result = {
          status: resp.status,
          body,
        };
        if (!resp.ok) {
          return Promise.reject(result);
        }
        return result;
      });
    });
  }
}

async function uploadMultipartFile(uploadData, file) {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  const parts = [];

  for (let i = 0; i < uploadData.parts.length; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const response = await fetch(uploadData.parts[i].uploadURL, {
      method: "PUT",
      body: chunk,
      headers: {
        "Content-Type": "application/octet-stream",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to upload part $${i + 1}`);
    }

    const etag = response.headers.get("ETag");
    if (!etag) {
      throw new Error(`No ETag received for part $${i + 1}`);
    }

    parts.push({
      ETag: etag,
      PartNumber: uploadData.parts[i].PartNumber,
    });
  }

  // Complete multipart upload
  const completeResponse = await fetch(uploadData.completeURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ parts }),
  });

  if (!completeResponse.ok) {
    const errorText = await completeResponse.text();
    throw new Error(`Failed to complete multipart upload: $${errorText}`);
  }

  return { status: completeResponse.status };
}
