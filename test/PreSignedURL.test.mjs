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
  CreateMultipartUploadCommand: jest.fn((params) => ({ __type: 'CreateMultipart', ...params })),
  UploadPartCommand: jest.fn((params) => ({ __type: 'UploadPart', ...params })),
  CompleteMultipartUploadCommand: jest.fn()
}));

// Minimal service config mirroring services.tf -> local.services, injected the
// same way Terraform injects it (jsonencode(local.services) into SERVICES_CONFIG).
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
  }
};

// SERVICES_CONFIG must be set before the module is imported (it is read at module load).
process.env.SERVICES_CONFIG = JSON.stringify(SERVICES_CONFIG);

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
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.API_GATEWAY_URL = 'https://api.test.com/';
  });

  test('uses multipart upload for files larger than 5MB', async () => {
    const event = buildEvent('council-tax', [
      { boxId: 'extract', name: 'CTAX_EXTRACT_E00000000_20250131.csv', type: 'text/csv', size: 6291456 },
      { boxId: 'mani', name: 'CTAX_MANI_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    mockS3Send.mockResolvedValue({ UploadId: 'test-upload-id' });
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

    mockS3Send.mockResolvedValue({ UploadId: 'test-upload-id' });
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
    expect(JSON.parse(result.body).boxId).toBe('extract');
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

  test('rejects filenames that do not match the configured pattern', async () => {
    const event = buildEvent('council-tax', [
      { boxId: 'extract', name: 'WRONG_PREFIX_E00000000_20250131.csv', type: 'text/csv', size: 1024 },
      { boxId: 'mani', name: 'CTAX_MANI_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    const result = await handler(event);
    expect(result.statusCode).toBe(403);
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
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.API_GATEWAY_URL = 'https://api.test.com/';
  });

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

describe('PreSignedURL Lambda - unknown service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.API_GATEWAY_URL = 'https://api.test.com/';
  });

  test('returns 400 for an unknown serviceId', async () => {
    const event = buildEvent('does-not-exist', [
      { boxId: 'extract', name: 'X_E00000000_20250131.csv', type: 'text/csv', size: 1024 }
    ]);

    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });
});
