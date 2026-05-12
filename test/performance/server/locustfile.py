import io
import logging
import math
import random
import time

import requests
from locust import HttpUser, between, task

from env_config import Config
from custom_metrics import record_cold_start, record_upload_throughput

logger = logging.getLogger("uploader-locust")
config = Config.from_env()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def generate_dummy_file_bytes(size_bytes: int) -> bytes:
    rng = random.Random(42)
    chunk = bytes(rng.randint(0, 255) for _ in range(min(size_bytes, 65_536)))
    repeats, remainder = divmod(size_bytes, len(chunk))
    return chunk * repeats + chunk[:remainder]


def split_into_parts(data: bytes, part_count: int) -> list[bytes]:
    part_size = math.ceil(len(data) / part_count)
    return [data[i:i + part_size] for i in range(0, len(data), part_size)]


def fire_request_event(environment, request_type, name, elapsed_s, response_length, exception=None):
    environment.events.request.fire(
        request_type=request_type,
        name=name,
        response_time=elapsed_s * 1000,
        response_length=response_length,
        exception=exception,
        context={},
    )


# ---------------------------------------------------------------------------
# Uploader behaviour
# ---------------------------------------------------------------------------

class UploaderBehaviour:

    def task_upload_session(self):
        self.task_homepage()
        self.task_upload_both_files()

    def task_homepage(self):
        start = time.perf_counter()
        with self.client.get(
                config.homepage_path,
                name=f"[CloudFront] GET {config.homepage_path}",
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                catch_response=True,
        ) as resp:
            elapsed_ms = (time.perf_counter() - start) * 1000
            _handle_homepage_response(resp, elapsed_ms)

    def task_upload_both_files(self):
        result = self.task_get_presigned_urls()
        if not result:
            return
        self._put_multipart(result["fileOneUpload"], config.extract_file_size_bytes, "[S3] PUT EXTRACT (20 MB)")
        self._put_single(result["fileTwoUpload"]["uploadURL"], config.mani_file_size_bytes, "[S3] PUT MANI (1 KB)")

    def task_get_presigned_urls(self) -> dict | None:
        params = _build_presign_params()
        start = time.perf_counter()
        with self.client.get(
            f"{config.api_gateway_base_url}{config.presign_path}",
            params=params,
            name=f"[API GW -> Lambda] GET {config.presign_path}",
            catch_response=True,
        ) as resp:
            latency_ms = (time.perf_counter() - start) * 1000
            return _handle_presign_response(resp, latency_ms)

    def _put_single(self, upload_url: str, size_bytes: int, label: str):
        payload = generate_dummy_file_bytes(size_bytes)
        start = time.perf_counter()
        try:
            resp = requests.put(
                upload_url,
                data=io.BytesIO(payload),
                headers={"Content-Type": "text/csv"},
                timeout=config.upload_timeout_s,
            )
            _handle_put_response(self.environment, resp, size_bytes, label, time.perf_counter() - start)
        except requests.Timeout:
            _fire_timeout(self.environment, "PUT", label, config.upload_timeout_s)

    def _put_multipart_parts(self, parts_meta: list, chunks: list) -> list | None:
        completed_parts = []
        for part, chunk in zip(parts_meta, chunks):
            result = self._put_part(part, chunk, len(parts_meta))
            if result is None:
                return None
            completed_parts.append(result)
        return completed_parts

    def _put_part(self, part: dict, chunk: bytes, total_parts: int) -> dict | None:
        part_number = part["PartNumber"]
        label = f"[S3] PUT EXTRACT (20 MB) part {part_number}/{total_parts}"
        start = time.perf_counter()
        try:
            resp = requests.put(
                part["uploadURL"],
                data=io.BytesIO(chunk),
                headers={"Content-Type": "text/csv"},
                timeout=config.upload_timeout_s,
            )
            elapsed_s = time.perf_counter() - start
            return _handle_part_response(self.environment, resp, part_number, len(chunk), label, elapsed_s)
        except requests.Timeout:
            _fire_timeout(self.environment, "PUT", label, config.upload_timeout_s)
            return None

    def _complete_multipart(self, complete_url: str, completed_parts: list, size_bytes: int, label: str):
        start = time.perf_counter()
        try:
            resp = requests.post(
                complete_url,
                json={"parts": completed_parts},
                timeout=30,
            )
            elapsed_s = time.perf_counter() - start
            _handle_complete_response(self.environment, resp, size_bytes, label, elapsed_s)
        except requests.Timeout:
            _fire_timeout(self.environment, "POST", f"{label} complete", 30)

    def _put_multipart(self, file_one_upload: dict, size_bytes: int, label: str):
        parts_meta = file_one_upload.get("parts", [])
        complete_url = file_one_upload.get("completeURL")

        if not parts_meta or not complete_url:
            logger.error("Multipart upload missing parts or completeURL")
            return

        payload = generate_dummy_file_bytes(size_bytes)
        chunks = split_into_parts(payload, len(parts_meta))
        completed_parts = self._put_multipart_parts(parts_meta, chunks)

        if completed_parts is None:
            return

        self._complete_multipart(complete_url, completed_parts, size_bytes, label)


# ---------------------------------------------------------------------------
# Response handlers
# ---------------------------------------------------------------------------

def _handle_homepage_response(resp, elapsed_ms: float):
    if resp.status_code == 200:
        resp.success()
        logger.debug("homepage OK %.1f ms", elapsed_ms)
        return
    if resp.status_code in (301, 302):
        resp.success()
        return
    resp.failure(f"Unexpected status {resp.status_code}")


def _build_presign_params() -> dict:
    return {
        "fileOneName": f"CTAX_EXTRACT_{config.test_lad_code}_{config.submission_date}.csv",
        "fileOneType": "text/csv",
        "fileOneSize": config.extract_file_size_bytes,
        "fileTwoName": f"CTAX_MANI_{config.test_lad_code}_{config.submission_date}.csv",
        "fileTwoType": "text/csv",
        "fileTwoSize": config.mani_file_size_bytes,
        "councilName": config.council_name,
    }


def _handle_presign_response(resp, latency_ms: float) -> dict | None:
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

    if resp.status_code == 429:
        resp.failure("API GW throttle (HTTP Status: 429)")
        return None

    resp.failure(f"Presign failed with HTTP Status: {resp.status_code}")
    return None


def _handle_put_response(environment, resp, size_bytes: int, label: str, elapsed_s: float):
    if resp.status_code in (200, 204):
        mb_transferred = size_bytes / (1024 * 1024)
        throughput = mb_transferred / elapsed_s if elapsed_s > 0 else 0
        fire_request_event(environment, "PUT", label, elapsed_s, size_bytes)
        record_upload_throughput(throughput)
        logger.debug("%s OK %.2f MB in %.2fs = %.1f MB/s", label, mb_transferred, elapsed_s, throughput)
        return
    fire_request_event(
        environment, "PUT", label, elapsed_s, 0,
        exception=Exception(f"S3 upload failed with HTTP Status: {resp.status_code}"),
    )


def _handle_part_response(environment, resp, part_number: int, chunk_size: int, label: str, elapsed_s: float) -> dict | None:
    if resp.status_code in (200, 204):
        etag = resp.headers.get("ETag", "").strip('"')
        fire_request_event(environment, "PUT", label, elapsed_s, chunk_size)
        logger.debug("Part %d OK ETag=%s", part_number, etag)
        return {"PartNumber": part_number, "ETag": etag}

    fire_request_event(
        environment, "PUT", label, elapsed_s, 0,
        exception=Exception(f"Part upload failed with HTTP Status: {resp.status_code}"),
    )
    logger.error("Part %d failed with HTTP Status: %d — aborting", part_number, resp.status_code)
    return None


def _handle_complete_response(environment, resp, size_bytes: int, label: str, elapsed_s: float):
    if resp.status_code == 200:
        mb_transferred = size_bytes / (1024 * 1024)
        throughput = mb_transferred / elapsed_s if elapsed_s > 0 else 0
        fire_request_event(environment, "POST", f"{label} complete", elapsed_s, size_bytes)
        record_upload_throughput(throughput)
        logger.debug("%s multipart complete OK", label)
        return
    fire_request_event(
        environment, "POST", f"{label} complete", elapsed_s, 0,
        exception=Exception(f"Complete multipart failed with HTTP Status: {resp.status_code}"),
    )


def _fire_timeout(environment, request_type: str, label: str, timeout_s: int):
    fire_request_event(
        environment, request_type, label, timeout_s, 0,
        exception=Exception(f"{label} timed out"),
    )


# ---------------------------------------------------------------------------
# User classes
# ---------------------------------------------------------------------------

class LoadTestUser(UploaderBehaviour, HttpUser):
    host = config.cloudfront_base_url
    wait_time = between(1, 3)
    weight = 1

    @task
    def upload_session(self):
        self.task_upload_session()


class StressTestUser(UploaderBehaviour, HttpUser):
    host = config.cloudfront_base_url
    wait_time = between(0.5, 1.5)
    weight = 1

    @task
    def upload_session(self):
        self.task_upload_session()


class SpikeTestUser(UploaderBehaviour, HttpUser):
    host = config.cloudfront_base_url
    wait_time = between(0.1, 0.5)
    weight = 1

    @task
    def upload_session(self):
        self.task_upload_session()