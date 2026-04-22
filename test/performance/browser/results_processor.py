import statistics

from dataclasses import dataclass, asdict
import json
import csv


@dataclass
class PerformanceReport:
    browser: str
    runs: int
    dns: float | None
    connection: float | None
    tls: float | None
    ttfb: float | None
    response_time: float | None
    dom_interactive: float | None
    dom_content_loaded: float | None
    full_load: float | None
    first_paint: float | None
    fcp: float | None
    lcp: float | None
    tti: float | None
    total_resources: float | None
    total_transfer_kb: float | None

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self, path: str):
        with open(path, "w") as json_file:
            json.dump(self.to_dict(), json_file, indent=2)

    def to_csv(self, path: str):
        data = self.to_dict()
        with open(path, "w", newline="") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=data.keys())
            writer.writeheader()
            writer.writerow(data)


class ResultsProcessor:
    SECTIONS = {
        "Network": ["dns", "connection", "tls", "ttfb"],
        "Document": ["response_time", "dom_interactive", "dom_content_loaded", "full_load"],
        "Paint / Vitals": ["first_paint", "fcp", "lcp", "tti"],
        "Resources": ["total_resources", "total_transfer_kb"],
    }

    def report(self, results: list[dict], browser: str) -> PerformanceReport:
        averaged = self.calculate_averages(results)
        return PerformanceReport(browser=browser, runs=len(results), **averaged)

    @staticmethod
    def calculate_averages(results: list[dict]) -> dict:
        averaged = {}
        decimal_places = 2
        for key in results[0]:
            values = [result[key] for result in results if result[key] is not None]
            averaged[key] = round(statistics.mean(values), decimal_places) if values else None
        return averaged

    @staticmethod
    def assert_within_budget(metric_value: float | None, budget_ms: int, label: str) -> bool:
        assert metric_value is not None, \
            f"{label} could not be measured — browser returned no data"
        assert metric_value < budget_ms, \
            f"{label} too slow: {metric_value}ms (budget: {budget_ms}ms)"
        return True

    @classmethod
    def print(cls, label: str, metrics: dict):
        print(f"\n{'=' * 50}")
        print(f"  {label}")
        print(f"{'=' * 50}")
        for section, keys in cls.SECTIONS.items():
            print(f"\n  {section}:")
            for key in keys:
                value = metrics.get(key)
                unit = "KB" if key == "total_transfer_kb" else ("" if key == "total_resources" else "ms")
                print(f"{key:<25} {f'{value}{unit}' if value is not None else 'N/A':>10}")