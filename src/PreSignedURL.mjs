import querystring from 'querystring';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

class uploaderLogger {
  logError(code, fileName, fileSize, statusCode, errorMessage) {
    console.error(`Status: ${statusCode}, Code: ${code}, File: ${fileName}, File size: ${fileSize} MB, Message: ${errorMessage}`);
  }

  logInternalError(code, fileName, statusCode, errorMessage) {
    console.error(`Status: ${statusCode}, Code: ${code}, File: ${fileName}, Message: ${errorMessage}`);
  }

  logInfo(infoMessage) {
    console.log(`Info: ${infoMessage}`);
  }

  logSuccess(code, fileName, URL, statusCode, councilName, serviceId) {
    console.log(`Success: Service: ${serviceId}, Council: ${councilName}, Status: ${statusCode}, Code: ${code}, fileName: ${fileName}, URL: ${URL}`);
  }
}

function cleanCouncilName(councilName) {
  return councilName.replace(/[!_\-.*'()&$@=;/+:,?\\{}^}%`[\]"<>#|~]/g, "").replace(/ /g, "");
}

// New way of using AWS SDk v3
import { S3, PutObjectCommand, S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3"
const s3 = new S3({ region: 'eu-west-2' });
const logger = new uploaderLogger()

const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5MB threshold for multipart

// Service configurations are injected at deploy time as a JSON object keyed by
// service_id (see services.tf -> local.services_json). This is the single
// source of truth shared with the browser (config.js) and Terraform rendering.
const SERVICES = JSON.parse(process.env.SERVICES_CONFIG || "{}");

function convertExtensionToLowerCase(filename) {
  const fileParts = filename.split('.');
  const fileExtension = fileParts.pop();
  const fileNameWithoutExtension = fileParts.join('.');
  return fileNameWithoutExtension + '.' + fileExtension.toLowerCase();
}

function fileExtension(name) {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx).toLowerCase();
}

// Accept if the file's extension OR MIME type matches one of the box's allowed values.
function typeAllowed(box, file) {
  const exts = (box.accepted_extensions || []).map((e) => e.toLowerCase());
  const types = box.accepted_types || [];
  const extOk = exts.length === 0 || exts.includes(fileExtension(file.name));
  const typeOk = types.length === 0 || types.includes(file.type);
  return extOk || typeOk;
}

function filenamePattern(box, code) {
  const exts = (box.accepted_extensions || ['.csv']).map((e) =>
    e.replace(/^\./, '').replace(/[.*+?^$()[\]{}|\\]/g, '\\$&')
  );
  const extGroup = exts.length ? `(${exts.join('|')})` : 'csv';
  return new RegExp('^' + box.filename_prefix + code + '_\\d{8}\\.' + extGroup + '$', 'i');
}

function dateSuffix(name) {
  const m = name.match(/_(\d{8})\./);
  return m ? m[1] : null;
}

// Derive the user's code from any provided filename: <prefix><code>_<date>.<ext>
function codeFromFiles(service, files) {
  for (const f of files) {
    const box = service.boxes.find((b) => b.id === f.boxId);
    if (!box) continue;
    const m = f.name.match(new RegExp('^' + box.filename_prefix + '([^_]+)_'));
    if (m) return m[1];
  }
  return 'unknown';
}

function errorResponse(statusCode, message, extra = {}) {
  return {
    statusCode,
    isBase64Encoded: false,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ message, ...extra }),
  };
}

export const handler = async (event, context, callback) => {
  let serviceId;
  try {
    logger.logInfo("Starting verification checks");

    const qs = event.queryStringParameters || {};
    serviceId = qs.serviceId;
    const service = SERVICES[serviceId];
    if (!service) {
      logger.logError(serviceId, 'n/a', 0, 400, 'Unknown serviceId');
      return errorResponse(400, 'Unknown service');
    }

    const councilNameRaw = decodeURIComponent(qs.councilName || '');
    let files;
    try {
      files = JSON.parse(qs.files || '[]');
    } catch (e) {
      return errorResponse(400, 'Invalid files parameter');
    }

    const boxesById = Object.fromEntries(service.boxes.map((b) => [b.id, b]));
    const code = codeFromFiles(service, files);

    // --- Required-box presence check ---
    const providedIds = new Set(files.map((f) => f.boxId));
    for (const box of service.boxes) {
      if (box.required && !providedIds.has(box.id)) {
        logger.logError(code, box.id, 0, 403, 'Required file missing');
        return errorResponse(403, `Missing required file: ${box.label}`, { boxId: box.id });
      }
    }

    // --- Per-file validation (size, type, filename pattern) ---
    for (const f of files) {
      const box = boxesById[f.boxId];
      if (!box) {
        return errorResponse(400, `Unknown upload box: ${f.boxId}`, { boxId: f.boxId });
      }
      const size = parseInt(f.size, 10);
      if (size === 0) {
        logger.logError(code, f.name, f.size, 204, 'File is empty');
        return errorResponse(204, 'File is empty', { boxId: f.boxId, filename: f.name });
      }
      if (!typeAllowed(box, f)) {
        logger.logError(code, f.name, f.size, 403, 'File type not allowed');
        return errorResponse(403, 'File is not an allowed type', { boxId: f.boxId, filename: f.name });
      }
      if (!filenamePattern(box, code).test(f.name)) {
        logger.logError(code, f.name, f.size, 403, 'Filename pattern mismatch');
        return errorResponse(403, 'File name does not follow the right pattern', { boxId: f.boxId, filename: f.name });
      }
    }

    // --- Cross-file rules (only across boxes that were provided) ---
    for (const rule of (service.cross_file_rules || [])) {
      if (rule.type === 'matching_date_suffix') {
        const dates = rule.boxes
          .map((bid) => files.find((f) => f.boxId === bid))
          .filter(Boolean)
          .map((f) => dateSuffix(f.name))
          .filter(Boolean);
        if (dates.length > 1 && !dates.every((d) => d === dates[0])) {
          logger.logError(code, 'n/a', 0, 300, 'File names do not match');
          return errorResponse(300, 'File names do not match');
        }
      }
    }

    // --- All checks pass: generate presigned URLs per provided file ---
    const currentDate = new Date();
    const formatedDate = currentDate.toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const councilName = cleanCouncilName(councilNameRaw);

    const uploads = {};
    for (const f of files) {
      const fileNameLowerCase = convertExtensionToLowerCase(f.name);
      const size = parseInt(f.size, 10);
      uploads[f.boxId] = await createUploadData(serviceId, fileNameLowerCase, size, formatedDate, councilName);
      logger.logSuccess(code, fileNameLowerCase, 'multipart/single', 200, councilName, serviceId);
    }

    return {
      statusCode: 200,
      isBase64Encoded: false,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Success', uploads }),
    };
  } catch (error) {
    logger.logInternalError(serviceId, 'n/a', '500', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal Server Error',
        error: error.message,
      }),
    };
  }
};

const createUploadData = async (serviceId, fileName, fileSize, formatedDate, councilName) => {
  const key = `${serviceId}/${councilName}/${formatedDate}/${fileName}`;

  if (fileSize > MULTIPART_THRESHOLD) {
    return await createMultipartUpload(key, fileSize);
  } else {
    const s3Params = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key
    });
    const uploadURL = await getSignedUrl(s3, s3Params, { expiresIn: 1800 });
    return { uploadURL, multipart: false };
  }
}

const createMultipartUpload = async (key, fileSize) => {
  const createParams = new CreateMultipartUploadCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key
  });

  const createResult = await s3.send(createParams);
  const uploadId = createResult.UploadId;

  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  const numParts = Math.ceil(fileSize / CHUNK_SIZE);
  const parts = [];

  for (let i = 1; i <= numParts; i++) {
    const uploadPartParams = new UploadPartCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      PartNumber: i,
      UploadId: uploadId
    });

    const uploadURL = await getSignedUrl(s3, uploadPartParams, { expiresIn: 1800 });
    parts.push({ PartNumber: i, uploadURL });
  }

  return {
    multipart: true,
    uploadId,
    parts,
    completeURL: `${process.env.API_GATEWAY_URL}complete-multipart?bucket=${process.env.BUCKET_NAME}&key=${encodeURIComponent(key)}&uploadId=${uploadId}`
  };
}
