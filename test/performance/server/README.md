# Uploader Performance Tests

Locust-based infrastructure load tests for the ONC Council Tax Uploader. Tests the full backend upload flow - CloudFront edge delivery, API Gateway -> Lambda pre-signed URL generation, and S3 multipart and single-file uploads - under load patterns representative of peak council usage.

Three test types are support: Load, Stress and Spike.

## Setup

Navigate up a directory (i.e., aws-uploader/test/performance) and install dependencies:

```bash
poetry install
``` 

Configure environment variables by copying the contents of .env.example into .env, and fill in the following values:

### `CLOUDFRONT_BASE_URL`
The base URL of the CloudFront distribution serving the uploader.

In the AWS Console: **CloudFront -> Distributions -> Uploader distribution -> Distribution domain name**

Example:
`CLOUDFRONT_BASE_URL=https://uploader.ingest-dev.aws.onsdigital.uk`

### `API_GATEWAY_BASE_URL`
The invoke URL of the API Gateway that fronts the pre-signed URL Lambda.

In the AWS Console: **API Gateway -> Uploader API -> Stages -> Uploader stage -> Invoke URL**

Example:
`API_GATEWAY_BASE_URL=https://abcdefghij.execute.api-eu-west-2.amazonaws.com`

❗**These values are sensitive. Do not commit them to Git**❗
`.env` is listed in `.gitignore` but always double-check your staged changes before pushing.  Never hardcode these values directly in source files.

## Running Tests

All tests must be run from inside the `server/` directory so that local module imports resolve correctly:

```powershell
cd aws-uploader/test/performance/server
```

### Load Test (baseline)
Gradually ramps to 50 VUs and holds. Validates performance under normal council usage. ~12 minutes.
```powershell
poetry run locust -f locustfile.py --config=load.conf --host=https://uploader.ingest-dev.aws.onsdigital.uk
```

## Running via Browser

By default, load tests open the Locust web UI at `http://localhost:8089`, allowing you to monitor results in real time.

This has been disabled. To re-enable the web UI, set the following in the load.conf file:
```ini
headless = false
```