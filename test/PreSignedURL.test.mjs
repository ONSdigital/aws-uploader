import { jest } from '@jest/globals';

const mockGetSignedUrl = jest.fn();
const mockS3Send = jest.fn();

jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl
}));

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3: jest.fn(() => ({ send: mockS3Send })),
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn((params) => ({ __type: 'Put', ...params })),
  GetObjectCommand: jest.fn((params) => ({ __type: 'GetObject', ...params })),
  CreateMultipartUploadCommand: jest.fn((params) => ({ __type: 'CreateMultipart', ...params })),
  UploadPartCommand: jest.fn((params) => ({ __type: 'UploadPart', ...params })),
  CompleteMultipartUploadCommand: jest.fn()
}));

// Minimal service config mirroring services.tf -> local.services. The Lambda
// now reads each service's config from S3 (<service_id>/config.json); the
// mocked S3 GetObject below serves these entries keyed by serviceId.
const SERVICES_CONFIG = {
  'council-tax': {
    service_id: 'council-tax',
    boxes: [
      {
        id: 'extract',
        required: true,
        accepted_types: ['text/csv'],
        accepted_extensions: ['.csv'],
        filename_prefix: 'CTAX_EXTRACT_'
      },
      {
        id: 'mani',
        required: true,
        accepted_types: ['text/csv'],
        accepted_extensions: ['.csv'],
        filename_prefix: 'CTAX_MANI_'
      }
    ],
    cross_file_rules: [{ type: 'matching_date_suffix', boxes: ['extract', 'mani'] }]
  },
  'electoral-register': {
    service_id: 'electoral-register',
    boxes: [
      {
        id: 'extract',
        required: true,
        accepted_types: ['text/csv'],
        accepted_extensions: ['.csv'],
        filename_prefix: 'ER_EXTRACT_'
      },
      {
        id: 'mani',
        required: false,
        accepted_types: ['text/csv'],
        accepted_extensions: ['.csv'],
        filename_prefix: 'ER_MANI_'
      }
    ],
    cross_file_rules: [{ type: 'matching_date_suffix', boxes: ['extract', 'mani'] }]
  },
  // A service with a TXT-only box, and a box that accepts both CSV and TXT,
  // used to prove the type-error message names the configured type(s).
  'txt-service': {
    service_id: 'txt-service',
    boxes: [
      {
        id: 'notes',
        required: true,
        accepted_types: ['text/plain'],
        accepted_extensions: ['.txt'],
        filename_prefix: 'NOTES_'
      },
      {
        id: 'either',
        required: false,
        accepted_types: ['text/csv', 'text/plain'],
        accepted_extensions: ['.csv', '.txt'],
        filename_prefix: 'EITHER_'
      }
    ],
    cross_file_rules: []
  }
};

// The Lambda now reads each service's config from S3 (<serviceId>/config.json
// in CONFIG_BUCKET) rather than from an env var. `activeConfig` is the map of
// serviceId -> config the mocked S3 GetObject serves; tests can swap it to
// exercise overrides (e.g. the error-override suite).
process.env.CONFIG_BUCKET = 'test-config-bucket';
let activeConfig = SERVICES_CONFIG;

// mockUploadSend holds the behaviour tests configure for non-config S3 calls
// (CreateMultipartUpload etc.) via the usual mockResolvedValue(...) in each test.
const mockUploadSend = jest.fn();

// The single s3.send mock dispatches: a config GetObject is served from
// activeConfig (a 404-style rejection for an unknown serviceId); everything
// else delegates to mockUploadSend so existing test setup keeps working.
// Installed via a function so it can be re-applied after jest.clearAllMocks().
function installS3SendRouter() {
  mockS3Send.mockImplementation((command) => {
    if (command && command.__type === 'GetObject') {
      const serviceId = String(command.Key).replace(/\/config\.json$/, '');
      const service = activeConfig[serviceId];
      if (!service) {
        const err = new Error('NoSuchKey');
        err.name = 'NoSuchKey';
        err.$metadata = { httpStatusCode: 404 };
        return Promise.reject(err);
      }
      return Promise.resolve({
        Body: { transformToString: async () => JSON.stringify(service) },
      });
    }
    return mockUploadSend(command);
  });
}
installS3SendRouter();

// Clear mock call history and re-install the config router before every test.
// This replaces the per-suite jest.clearAllMocks() calls (which would wipe the
// router's implementation); mock.calls are still reset here via clearAllMocks.
beforeEach(() => {
  jest.clearAllMocks();
  activeConfig = SERVICES_CONFIG;
  installS3SendRouter();
  process.env.BUCKET_NAME = 'test-bucket';
  process.env.API_GATEWAY_URL = 'https://api.test.com/';
});

const { handler } = await import('../src/PreSignedURL.mjs');

// Helper to build an event in the new (generic) request shape.
function buildEvent(serviceId, files, councilName = 'Test') {
  return {
    queryStringParameters: {
      serviceId,
      councilName: encodeURIComponent(councilName),
      files: JSON.stringify(files)
    }
  };
}

describe('PreSignedURL Lambda - council-tax (two required files)', () => {
  test('uses multipart upload for files larger than 5MB', async () => {
    const event = buildEvent('council-tax', [
      { boxId: 'extract', name: 'CTAX_EXTRACT_E00000000_20250131.csv', type: 'text/csv', size: 6291456 },
      { boxId: 'mani', name: 'CTAX_MANI_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    mockUploadSend.mockResolvedValue({ UploadId: 'test-upload-id' });
    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');

    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.message).toBe('Success');
    expect(body.uploads.extract.multipart).toBe(true);
    expect(body.uploads.extract.uploadId).toBe('test-upload-id');
    expect(body.uploads.extract.parts.length).toBeGreaterThan(0);
    expect(body.uploads.mani.multipart).toBe(false);
  });

  test('uses single upload for files smaller than 5MB', async () => {
    const event = buildEvent('council-tax', [
      { boxId: 'extract', name: 'CTAX_EXTRACT_E00000000_20250131.csv', type: 'text/csv', size: 1024 },
      { boxId: 'mani', name: 'CTAX_MANI_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');

    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.uploads.extract.multipart).toBe(false);
    expect(body.uploads.extract.uploadURL).toBe('https://presigned-url.com');
  });

  test('calculates the correct number of parts for multipart upload', async () => {
    const event = buildEvent('council-tax', [
      { boxId: 'extract', name: 'CTAX_EXTRACT_E00000000_20250131.csv', type: 'text/csv', size: 15728640 },
      { boxId: 'mani', name: 'CTAX_MANI_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    mockUploadSend.mockResolvedValue({ UploadId: 'test-upload-id' });
    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');

    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(body.uploads.extract.parts.length).toBe(3); // 15MB / 5MB = 3 parts
  });

  test('writes objects under the <service_id>/ key prefix', async () => {
    const event = buildEvent('council-tax', [
      { boxId: 'extract', name: 'CTAX_EXTRACT_E00000000_20250131.csv', type: 'text/csv', size: 1024 },
      { boxId: 'mani', name: 'CTAX_MANI_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');

    await handler(event);

    // Inspect the PutObjectCommand the handler built for the presigned URL.
    const putCalls = mockGetSignedUrl.mock.calls.map((c) => c[1]);
    expect(putCalls.length).toBeGreaterThan(0);
    expect(putCalls.every((p) => p.Key.startsWith('council-tax/Test/'))).toBe(true);
  });

  test('rejects a file whose extension and type are both disallowed', async () => {
    // A file passes if EITHER its extension OR its MIME type is allowed, so to
    // be rejected on type it must fail both (here: .pdf extension + pdf type).
    const event = buildEvent('council-tax', [
      { boxId: 'extract', name: 'CTAX_EXTRACT_E00000000_20250131.pdf', type: 'application/pdf', size: 1024 },
      { boxId: 'mani', name: 'CTAX_MANI_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    const result = await handler(event);
    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.boxId).toBe('extract');
    // Message names the expected type for a CSV-only box.
    expect(body.message).toBe('File is not .csv');
  });

  test('accepts a correct extension even when the browser reports a different MIME type', async () => {
    // Browsers sometimes report an empty or wrong MIME type for CSVs; the file
    // should still be accepted because the .csv extension is allowed.
    const event = buildEvent('council-tax', [
      { boxId: 'extract', name: 'CTAX_EXTRACT_E00000000_20250131.csv', type: 'application/vnd.ms-excel', size: 1024 },
      { boxId: 'mani', name: 'CTAX_MANI_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });

  test('rejects an empty file', async () => {
    const event = buildEvent('council-tax', [
      { boxId: 'extract', name: 'CTAX_EXTRACT_E00000000_20250131.csv', type: 'text/csv', size: 0 },
      { boxId: 'mani', name: 'CTAX_MANI_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    const result = await handler(event);
    expect(result.statusCode).toBe(204);
    expect(JSON.parse(result.body).message).toBe('File is empty');
  });

  test('rejects filenames that do not match the configured pattern with an expected-format message', async () => {
    const event = buildEvent('council-tax', [
      { boxId: 'extract', name: 'WRONG_PREFIX_E00000000_20250131.csv', type: 'text/csv', size: 1024 },
      { boxId: 'mani', name: 'CTAX_MANI_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    const result = await handler(event);
    expect(result.statusCode).toBe(403);
    // Message tells the user the exact filename format expected for this box.
    expect(JSON.parse(result.body).message).toBe('File name must match CTAX_EXTRACT_E00000000_yyyymmdd.csv');
  });

  test('rejects mismatched date suffixes across files (cross-file rule)', async () => {
    const event = buildEvent('council-tax', [
      { boxId: 'extract', name: 'CTAX_EXTRACT_E00000000_20250131.csv', type: 'text/csv', size: 1024 },
      { boxId: 'mani', name: 'CTAX_MANI_E00000000_20250130.csv', type: 'text/csv', size: 1024 }
    ]);

    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');

    const result = await handler(event);
    expect(result.statusCode).toBe(300);
    expect(JSON.parse(result.body).message).toBe('File names do not match');
  });
});

describe('PreSignedURL Lambda - electoral-register (optional second file)', () => {
  test('succeeds when only the compulsory file is provided', async () => {
    const event = buildEvent('electoral-register', [
      { boxId: 'extract', name: 'ER_EXTRACT_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');

    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.uploads.extract).toBeDefined();
    expect(body.uploads.mani).toBeUndefined();
  });

  test('succeeds when both files are provided and valid', async () => {
    const event = buildEvent('electoral-register', [
      { boxId: 'extract', name: 'ER_EXTRACT_E00000000_20250131.csv', type: 'text/csv', size: 1024 },
      { boxId: 'mani', name: 'ER_MANI_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');

    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.uploads.extract).toBeDefined();
    expect(body.uploads.mani).toBeDefined();
  });

  test('fails when the compulsory file is missing', async () => {
    const event = buildEvent('electoral-register', [
      { boxId: 'mani', name: 'ER_MANI_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    const result = await handler(event);
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).boxId).toBe('extract');
  });

  test('writes objects under the electoral-register/ key prefix', async () => {
    const event = buildEvent('electoral-register', [
      { boxId: 'extract', name: 'ER_EXTRACT_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');

    await handler(event);

    const putCalls = mockGetSignedUrl.mock.calls.map((c) => c[1]);
    expect(putCalls.every((p) => p.Key.startsWith('electoral-register/Test/'))).toBe(true);
  });
});

describe('PreSignedURL Lambda - type-specific error messages', () => {
  test('a TXT-only box rejects a CSV with "File is not .txt"', async () => {
    const event = buildEvent('txt-service', [
      { boxId: 'notes', name: 'NOTES_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    const result = await handler(event);
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).message).toBe('File is not .txt');
  });

  test('a TXT-only box accepts a .txt file', async () => {
    const event = buildEvent('txt-service', [
      { boxId: 'notes', name: 'NOTES_E00000000_20250131.txt', type: 'text/plain', size: 1024 }
    ]);

    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).uploads.notes).toBeDefined();
  });

  test('a CSV-or-TXT box reports both types and accepts either', async () => {
    // Rejected file (pdf) names both allowed types.
    const reject = buildEvent('txt-service', [
      { boxId: 'notes', name: 'NOTES_E00000000_20250131.txt', type: 'text/plain', size: 1024 },
      { boxId: 'either', name: 'EITHER_E00000000_20250131.pdf', type: 'application/pdf', size: 1024 }
    ]);
    const rejectResult = await handler(reject);
    expect(rejectResult.statusCode).toBe(403);
    expect(JSON.parse(rejectResult.body).message).toBe('File is not .csv or .txt');

    // A .txt is accepted by the CSV-or-TXT box.
    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');
    const accept = buildEvent('txt-service', [
      { boxId: 'notes', name: 'NOTES_E00000000_20250131.txt', type: 'text/plain', size: 1024 },
      { boxId: 'either', name: 'EITHER_E00000000_20250131.txt', type: 'text/plain', size: 1024 }
    ]);
    const acceptResult = await handler(accept);
    expect(acceptResult.statusCode).toBe(200);
  });
});

describe('PreSignedURL Lambda - per-service error message overrides', () => {
  test('uses a service-provided wrong_type override with placeholder substitution', async () => {
    // Serve a service with an error override via the mocked config.json fetch.
    // Its serviceId isn't used by any other test, so the Lambda's per-service
    // config cache won't collide.
    activeConfig = {
      'custom-msgs': {
        service_id: 'custom-msgs',
        wording: {
          errors: {
            wrong_type: 'Oops — {label} must be a {types} document'
          }
        },
        boxes: [
          {
            id: 'doc',
            label: 'Upload the report',
            required: true,
            accepted_types: ['text/csv'],
            accepted_extensions: ['.csv'],
            filename_prefix: 'RPT_'
          }
        ],
        cross_file_rules: []
      }
    };

    const event = {
      queryStringParameters: {
        serviceId: 'custom-msgs',
        councilName: encodeURIComponent('Test'),
        files: JSON.stringify([
          { boxId: 'doc', name: 'RPT_E00000000_20250131.pdf', type: 'application/pdf', size: 1024 }
        ])
      }
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).message).toBe('Oops — Upload the report must be a .csv document');
  });
});

describe('PreSignedURL Lambda - unknown service', () => {
  test('returns 400 for an unknown serviceId', async () => {
    const event = buildEvent('does-not-exist', [
      { boxId: 'extract', name: 'X_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });
});
