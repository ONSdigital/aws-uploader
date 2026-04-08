import statistics

from playwright.sync_api import Page

NUM_RUNS = 5
EXTRACT_FILE = "test_files/CTAX_EXTRACT_E00000000_20201231.csv"
MANI_FILE = "test_files/CTAX_MANI_E00000000_20201231.csv"

class UploaderPage:
    def __init__(self, page: Page, base_url: str):
        self.page = page
        self.base_url = base_url

    def complete_upload_journey(self):
        self._navigate()
        self._upload_extract()
        self._upload_mani()
        self._submit()

    def _navigate(self):
        self.page.goto(f"{self.base_url}/council-tax/E00000000-Test.html")
        self.page.wait_for_load_state("networkidle")

    def _upload_extract(self):
        self.page.set_input_files("#fileOne", EXTRACT_FILE)

    def _upload_mani(self):
        self.page.set_input_files("#fileTwo", MANI_FILE)

    def _submit(self):
        self.page.get_by_role("button", name="Submit").click()
        self.page.wait_for_load_state("networkidle")


class PerformanceCollector:
    def __init__(self, page: Page):
        self.page = page

    def collect(self) -> dict:
        navigation = self._get_navigation_timing()
        paint = self._get_paint_metrics()
        resources = self._get_resource_summary()
        lcp = self._get_lcp()
        tti = self._get_tti(fallback_ms=navigation['dom_content_loaded'])

        return {
            **navigation,
            **paint,
            **resources,
            'lcp': lcp,
            'tti': tti,
        }

    def _get_navigation_timing(self) -> dict:
        return self.page.evaluate("""() => {
                    const nav = performance.getEntriesByType('navigation')[0];
                    return {
                        dns:                nav.domainLookupEnd - nav.domainLookupStart,
                        connection:         nav.connectEnd - nav.connectStart,
                        tls:                nav.connectEnd - nav.secureConnectionStart,
                        ttfb:               nav.responseStart - nav.requestStart,
                        response_time:      nav.responseEnd - nav.responseStart,
                        dom_interactive:    nav.domInteractive - nav.startTime,
                        dom_content_loaded: nav.domContentLoadedEventEnd - nav.startTime,
                        full_load:          nav.loadEventEnd - nav.startTime,
                    };
                }""")

    def _get_paint_metrics(self) -> dict:
        return self.page.evaluate("""() => {
                    const paint = performance.getEntriesByType('paint');
                    const fcp = paint.find(e => e.name === 'first-contentful-paint');
                    return {
                        first_paint: paint.find(e => e.name === 'first-paint')?.startTime ?? null,
                        fcp:         fcp ? fcp.startTime : null,
                    };
                }""")

    def _get_resource_summary(self) -> dict:
        return self.page.evaluate("""() => {
                    const resources = performance.getEntriesByType('resource');
                    return {
                        total_resources:   resources.length,
                        total_transfer_kb: parseFloat((
                            resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024
                        ).toFixed(2)),
                    };
                }""")

    def _get_lcp(self) -> float | None:
        return self.page.evaluate("""() => new Promise(resolve => {
            let lcp = null;
            const observer = new PerformanceObserver(list => {
                lcp = list.getEntries().at(-1).startTime;
            });
            try {
                observer.observe({ type: 'largest-contentful-paint', buffered: true });
            } catch (e) {}
            setTimeout(() => { observer.disconnect(); resolve(lcp); }, 1000);
        })""")

    def _get_tti(self, fallback_ms: float) -> float | None:
        tti = self.page.evaluate("""() => new Promise(resolve => {
                const observer = new PerformanceObserver(list => {
                    const last = list.getEntries().at(-1);
                    observer.disconnect();
                    resolve(last.startTime + last.duration);
                });
                try {
                    observer.observe({ type: 'longtask', buffered: true });
                } catch (e) { resolve(null); }
                setTimeout(() => resolve(null), 3000);
            })""")

        if tti is None:
            return fallback_ms

        return round(tti, 2)


class ResultsProcessor:
    SECTIONS = {
        "Network": ["dns", "connection", "tls", "ttfb"],
        "Document": ["response_time", "dom_interactive", "dom_content_loaded", "full_load"],
        "Paint / Vitals": ["first_paint", "fcp", "lcp", "tti"],
        "Resources": ["total_resources", "total_transfer_kb"],
    }

    @staticmethod
    def average(results: list[dict]) -> dict:
        averaged = {}
        decimal_places = 2
        for key in results[0]:
            values = [result[key] for result in results if result[key] is not None]
            averaged[key] = round(statistics.mean(values), decimal_places) if values else None
        print("debug")
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


def test_uploader_performance(page: Page, base_url: str, browser_name: str):
    # arrange
    uploader = UploaderPage(page, base_url)
    collector = PerformanceCollector(page)
    processor = ResultsProcessor()
    results = []

    # act
    for run in range(1, NUM_RUNS + 1):
        print(f"\n--- Run {run}/{NUM_RUNS} ({browser_name})---")

        uploader.complete_upload_journey()
        metrics = collector.collect()

        processor.print(f"Run {run} results", metrics)
        results.append(metrics)

        if run < NUM_RUNS:
            page.reload()
            page.wait_for_load_state("networkidle")

    averaged = processor.average(results)
    processor.print(f"Averaged results ({browser_name}, {NUM_RUNS} runs)", averaged)

    # assert
    max_ttfb_threshold_in_ms = 300
    max_dom_content_loaded_threshold_in_ms = 1000
    max_fcp_threshold_in_ms = 2000
    max_tti_threshold_in_ms = 4000
    max_full_load_threshold_in_ms = 4000

    processor.assert_within_budget(averaged['ttfb'], max_ttfb_threshold_in_ms, "TTFB")
    processor.assert_within_budget(averaged['dom_content_loaded'], max_dom_content_loaded_threshold_in_ms, "DOMContentLoaded")
    processor.assert_within_budget(averaged['fcp'], max_fcp_threshold_in_ms, "FCP")
    processor.assert_within_budget(averaged['tti'], max_tti_threshold_in_ms, "TTI")
    processor.assert_within_budget(averaged['full_load'], max_full_load_threshold_in_ms, "Full load")
