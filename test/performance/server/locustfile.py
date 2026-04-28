import io
import logging
import math
import random
import time

import requests
from locust import HttpUser, between, task

from env_config import (
    API_GATEWAY_BASE_URL,
    CLOUDFRONT_BASE_URL,
    COUNCIL_NAME,
    EXTRACT_FILE_SIZE_BYTES,
    HOMEPAGE_PATH,
    MANI_FILE_SIZE_BYTES,
    PRESIGN_PATH,
    SUBMISSION_DATE,
    TEST_LAD_CODE,
    UPLOAD_TIMEOUT_S,
)
from custom_metrics import record_cold_start, record_upload_throughput

logger = logging.getLogger("uploader-locust")


def generate_dummy_file_bytes(size_bytes: int) -> bytes:
    rng = random.Random(42)
    chunk = bytes(rng.randint(0, 255) for _ in range(min(size_bytes, 65_536)))
    repeats, remainder = divmod(size_bytes, len(chunk))
    return chunk * repeats + chunk[:remainder]


def split_into_parts(data: bytes, part_count: int) -> list[bytes]:
    part_size = math.ceil(len(data) / part_count)
    return [data[i:i + part_size] for i in range(0, len(data), part_size)]


class UploaderBehaviour:
    def task_homepage(self):
        start = time.perf_counter()

        with self.client.get(
            HOMEPAGE_PATH,
            name=f"[CloudFront] GET {HOMEPAGE_PATH}",
            catch_response=True,
        ) as resp:
            elapsed_ms = (time.perf_counter() - start) * 1000
            if resp.status_code == 200:
                resp.success()
                logger.debug("homepage OK %.1f ms", elapsed_ms)
            elif resp.status_code in (301, 302):
                resp.success()
            else:
                resp.failure(f"Unexpected status {resp.status_code}")

    def task_get_presigned_urls(self) -> dict | None:
        extract_name = f"CTAX_EXTRACT_{TEST_LAD_CODE}_{SUBMISSION_DATE}.csv"
        mani_name = f"CTAX_MANI_{TEST_LAD_CODE}_{SUBMISSION_DATE}.csv"

        params = {
            "fileOneName": extract_name,
            "fileOneType": "text/csv",
            "fileOneSize": EXTRACT_FILE_SIZE_BYTES,
            "fileTwoName": mani_name,
            "fileTwoType": "text/csv",
            "fileTwoSize": MANI_FILE_SIZE_BYTES,
            "councilName": COUNCIL_NAME,
        }

        start = time.perf_counter()
        with self.client.get(
            f"{API_GATEWAY_BASE_URL}{PRESIGN_PATH}",
            params=params,
            name=f"[API GW -> Lambda] GET {PRESIGN_PATH}",
            catch_response=True,
        ) as resp:
            latency_ms = (time.perf_counter() - start) * 1000

            if resp.headers.get("x-cold-start") == "true":
                record_cold_start(latency_ms)
                logger.debug("Cold start detected %.1f ms", latency_ms)

            if resp.status_code == 200:
                resp.success()
                try:
                    return resp.json()
                except Exception as err:
                    resp.failure(f"Non-JSON 200 response from presign endpoint: {err}")
                    return None
            elif resp.status_code == 429:
                resp.failure("API GW throttle (HTTP Status: 429)")
                return None
            else:
                resp.failure(f"Presign failed with HTTP Status: {resp.status_code}")
                return None

    def _put_single(self, upload_url: str, size_bytes: int, label: str):
        payload = generate_dummy_file_bytes(size_bytes)
        start = time.perf_counter()
        try:
            resp = requests.put(
                upload_url,
                data=io.BytesIO(payload),
                headers={"Content-Type": "text/csv"},
                timeout=UPLOAD_TIMEOUT_S,
            )
            elapsed_s = time.perf_counter() - start
            mb_transferred = size_bytes / (1024 * 1024)
            throughput = mb_transferred / elapsed_s if elapsed_s > 0 else 0

            if resp.status_code in (200, 204):
                self.environment.events.request.fire(
                    request_type="PUT",
                    name=label,
                    response_time=elapsed_s * 1000,
                    response_length=size_bytes,
                    exception=None,
                    context={},
                )
                record_upload_throughput(throughput)
                logger.debug(
                    "%s OK %.2f MB in %.2fs = %.1f MB/s",
                    label, mb_transferred, elapsed_s, throughput,
                )
            else:
                self.environment.events.request.fire(
                    request_type="PUT",
                    name=label,
                    response_time=elapsed_s * 1000,
                    response_length=0,
                    exception=Exception(f"S3 upload failed with HTTP Status: {resp.status_code}"),
                    context={},
                )
        except requests.Timeout:
            self.environment.events.request.fire(
                request_type="PUT",
                name=label,
                response_time=UPLOAD_TIMEOUT_S * 1000,
                response_length=0,
                exception=Exception("Upload timed out"),
                context={},
            )

    def _put_multipart(self, file_one_upload: dict, size_bytes: int, label: str):
        parts_meta = file_one_upload.get("parts", [])
        complete_url = file_one_upload.get("completeURL")

        if not parts_meta or not complete_url:
            logger.error("Multipart upload missing parts or completeURL")
            return

        payload = generate_dummy_file_bytes(size_bytes)
        chunks = split_into_parts(payload, len(parts_meta))
        completed_parts = []

        for part, chunk in zip(parts_meta, chunks):
            part_number = part["PartNumber"]
            upload_url = part["uploadURL"]

            start = time.perf_counter()
            try:
                resp = requests.put(
                    upload_url,
                    data=io.BytesIO(chunk),
                    headers={"Content-Type": "text/csv"},
                    timeout=UPLOAD_TIMEOUT_S,
                )
                elapsed_s = time.perf_counter() - start

                if resp.status_code in (200, 204):
                    etag = resp.headers.get("ETag", "").strip('"')
                    completed_parts.append({"PartNumber": part_number, "ETag": etag})
                    self.environment.events.request.fire(
                        request_type="PUT",
                        name=f"{label} part {part_number}/{len(parts_meta)}",
                        response_time=elapsed_s * 1000,
                        response_length=len(chunk),
                        exception=None,
                        context={},
                    )
                    logger.debug(
                        "Part %d/%d OK ETag=%s", part_number, len(parts_meta), etag
                    )
                else:
                    self.environment.events.request.fire(
                        request_type="PUT",
                        name=f"{label} part {part_number}/{len(parts_meta)}",
                        response_time=elapsed_s * 1000,
                        response_length=0,
                        exception=Exception(f"Part upload failed with HTTP Status: {resp.status_code}"),
                        context={},
                    )
                    logger.error(
                        "Part %d/%d failed with HTTP Status: %d — aborting multipart upload",
                        part_number, len(parts_meta), resp.status_code
                    )
                    return  # Abort — don't call completeURL with missing parts

            except requests.Timeout:
                self.environment.events.request.fire(
                    request_type="PUT",
                    name=f"{label} part {part_number}/{len(parts_meta)}",
                    response_time=UPLOAD_TIMEOUT_S * 1000,
                    response_length=0,
                    exception=Exception(f"Part {part_number} upload timed out"),
                    context={},
                )
                return  # Abort

        # All parts uploaded — complete the multipart upload
        start = time.perf_counter()
        try:
            resp = requests.post(
                complete_url,
                json={"parts": completed_parts},
                timeout=30,
            )
            elapsed_s = time.perf_counter() - start
            mb_transferred = size_bytes / (1024 * 1024)
            throughput = mb_transferred / elapsed_s if elapsed_s > 0 else 0

            if resp.status_code == 200:
                self.environment.events.request.fire(
                    request_type="POST",
                    name=f"{label} complete",
                    response_time=elapsed_s * 1000,
                    response_length=size_bytes,
                    exception=None,
                    context={},
                )
                record_upload_throughput(throughput)
                logger.debug("%s multipart complete OK", label)
            else:
                self.environment.events.request.fire(
                    request_type="POST",
                    name=f"{label} complete",
                    response_time=elapsed_s * 1000,
                    response_length=0,
                    exception=Exception(f"Complete multipart failed with HTTP Status: {resp.status_code}"),
                    context={},
                )
        except requests.Timeout:
            self.environment.events.request.fire(
                request_type="POST",
                name=f"{label} complete",
                response_time=30 * 1000,
                response_length=0,
                exception=Exception("Complete multipart timed out"),
                context={},
            )

    def task_upload_both_files(self):
        result = self.task_get_presigned_urls()
        if not result:
            return

        self._put_multipart(
            result["fileOneUpload"],
            EXTRACT_FILE_SIZE_BYTES,
            "[S3] PUT EXTRACT (20 MB)",
        )
        self._put_single(
            result["fileTwoUpload"]["uploadURL"],
            MANI_FILE_SIZE_BYTES,
            "[S3] PUT MANI (1 KB)",
        )


class LoadTestUser(UploaderBehaviour, HttpUser):
    host = CLOUDFRONT_BASE_URL
    wait_time = between(1, 3)
    weight = 1

    @task(1)
    def homepage(self):
        self.task_homepage()

    @task(3)
    def upload_both_files(self):
        self.task_upload_both_files()


class StressTestUser(UploaderBehaviour, HttpUser):
    host = CLOUDFRONT_BASE_URL
    wait_time = between(0.5, 1.5)  # Tighter think-time = more pressure
    weight = 1

    @task(1)
    def homepage(self):
        self.task_homepage()

    @task(3)
    def upload_both_files(self):
        self.task_upload_both_files()


class SpikeTestUser(UploaderBehaviour, HttpUser):
    host = CLOUDFRONT_BASE_URL
    wait_time = between(0.1, 0.5)  # Minimal wait = sustained burst
    weight = 1

    @task(1)
    def homepage(self):
        self.task_homepage()

    @task(3)
    def upload_both_files(self):
        self.task_upload_both_files()