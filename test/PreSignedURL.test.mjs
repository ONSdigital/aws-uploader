import { jest } from '@jest/globals';

const mockGetSignedUrl = jest.fn();
const mockS3Send = jest.fn();

jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl
}));

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3: jest.fn(() => ({ send: mockS3Send })),
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
  CreateMultipartUploadCommand: jest.fn(),
  UploadPartCommand: jest.fn(),
  CompleteMultipartUploadCommand: jest.fn()
}));

const { handler } = await import('../src/PreSignedURL.mjs');

describe('PreSignedURL Lambda - Multipart Upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.API_GATEWAY_URL = 'https://api.test.com/';
  });

  test('should use multipart upload for files larger than 5MB', async () => {
    const event = {
      queryStringParameters: {
        fileOneName: 'CTAX_EXTRACT_E00000000_20250131.csv',
        fileTwoName: 'CTAX_MANI_E00000000_20250131.csv',
        fileOneType: 'text/csv',
        fileTwoType: 'text/csv',
        fileOneSize: '6291456', // 6MB
        fileTwoSize: '1024',
        councilName: 'Test'
      }
    };

    mockS3Send.mockResolvedValue({ UploadId: 'test-upload-id' });
    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');

    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.fileOneUpload.multipart).toBe(true);
    expect(body.fileOneUpload.uploadId).toBe('test-upload-id');
    expect(body.fileOneUpload.parts).toBeDefined();
    expect(body.fileOneUpload.parts.length).toBeGreaterThan(0);
  });

  test('should use single upload for files smaller than 5MB', async () => {
    const event = {
      queryStringParameters: {
        fileOneName: 'CTAX_EXTRACT_E00000000_20250131.csv',
        fileTwoName: 'CTAX_MANI_E00000000_20250131.csv',
        fileOneType: 'text/csv',
        fileTwoType: 'text/csv',
        fileOneSize: '1024', // 1KB
        fileTwoSize: '1024',
        councilName: 'Test'
      }
    };

    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');

    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.fileOneUpload.multipart).toBe(false);
    expect(body.fileOneUpload.uploadURL).toBe('https://presigned-url.com');
  });

  test('should calculate correct number of parts for multipart upload', async () => {
    const event = {
      queryStringParameters: {
        fileOneName: 'CTAX_EXTRACT_E00000000_20250131.csv',
        fileTwoName: 'CTAX_MANI_E00000000_20250131.csv',
        fileOneType: 'text/csv',
        fileTwoType: 'text/csv',
        fileOneSize: '15728640', // 15MB
        fileTwoSize: '1024',
        councilName: 'Test'
      }
    };

    mockS3Send.mockResolvedValue({ UploadId: 'test-upload-id' });
    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com');

    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(body.fileOneUpload.parts.length).toBe(3); // 15MB / 5MB = 3 parts
  });
});
