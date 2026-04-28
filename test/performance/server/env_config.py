import os

ENV = os.environ.get("ENV", "dev")
CLOUDFRONT_BASE_URL: str = os.environ.get(
    "CLOUDFRONT_BASE_URL", f"https://uploader.ingest-{ENV}.aws.onsdigital.uk"
)

API_GATEWAY_BASE_URL: str = os.environ.get(
    "API_GATEWAY_BASE_URL", f"https://REPLACE_ME.execute-api.eu-west-2.amazonaws.com"
)

TEST_LAD_CODE: str = os.environ.get("TEST_LAD_CODE", "P00000000")
COUNCIL_NAME: str = os.environ.get("COUNCIL_NAME", "Performance-Test")
SUBMISSION_DATE: str = os.environ.get("SUBMISSION_DATE", "20261231")

HOMEPAGE_PATH: str = os.environ.get("HOMEPAGE_PATH", f"/council-tax/{TEST_LAD_CODE}-Performance-Test.html")

PRESIGN_PATH: str = os.environ.get("PRESIGN_PATH", "/pre-signed-url")

EXTRACT_FILE_SIZE_BYTES: int = int(
    os.environ.get("EXTRACT_FILE_SIZE_BYTES", str(20 * 1024 * 1024))  # 20 MB
)
MANI_FILE_SIZE_BYTES: int = int(
    os.environ.get("MANI_FILE_SIZE_BYTES", str(1 * 1024))             # 1 KB
)

UPLOAD_TIMEOUT_S: int = int(os.environ.get("UPLOAD_TIMEOUT_S", "120"))

THRESHOLD_P50_MS: float = float(os.environ.get("THRESHOLD_P50_MS", "150"))
THRESHOLD_P95_MS: float = float(os.environ.get("THRESHOLD_P95_MS", "400"))
THRESHOLD_P99_MS: float = float(os.environ.get("THRESHOLD_P99_MS", "800"))
THRESHOLD_5XX_RATE: float = float(os.environ.get("THRESHOLD_5XX_RATE", "0.001"))  # 0.1%
THRESHOLD_COLD_START_RATE: float = float(
    os.environ.get("THRESHOLD_COLD_START_RATE", "0.05")  # 5%
)
THRESHOLD_THROUGHPUT_MBS: float = float(
    os.environ.get("THRESHOLD_THROUGHPUT_MBS", "10.0")   # 10 MB/s minimum
)