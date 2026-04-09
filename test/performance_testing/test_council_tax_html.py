from playwright.sync_api import Page

from config import NUM_RUNS, MAX_TTFB_MS, MAX_DOM_CONTENT_LOADED_MS, MAX_FCP_MS, MAX_TTI_MS, MAX_FULL_LOAD_MS
from performance_collector import PerformanceCollector
from results_processor import ResultsProcessor


class UploaderPage:
    def __init__(self, page: Page, base_url: str, extract_file: str, mani_file: str):
        self.page = page
        self.base_url = base_url
        self.extract_file = extract_file
        self.mani_file = mani_file

    def complete_upload_journey(self):
        self._navigate()
        self._upload_extract()
        self._upload_mani()
        self._submit()

    def _navigate(self):
        self.page.goto(f"{self.base_url}/council-tax/E00000000-Test.html")
        self.page.wait_for_load_state("networkidle")

    def _upload_extract(self):
        self.page.set_input_files("#fileOne", self.extract_file)

    def _upload_mani(self):
        self.page.set_input_files("#fileTwo", self.mani_file)

    def _submit(self):
        self.page.get_by_role("button", name="Submit").click()
        self.page.wait_for_load_state("networkidle")


def test_uploader_performance(page: Page, base_url: str, browser_name: str, extract_file, mani_file):
    # arrange
    uploader = UploaderPage(page, base_url, extract_file, mani_file)
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

    averaged = processor.calculate_averages(results)
    processor.print(f"Averaged results ({browser_name}, {NUM_RUNS} runs)", averaged)

    # # Reporting - uncomment as required
    # report = processor.report(results=results, browser=browser_name)
    # report.to_json(f"output/{browser_name}_results.json")
    # report.to_csv(f"output/{browser_name}_results.csv")

    # assert
    processor.assert_within_budget(averaged['ttfb'], MAX_TTFB_MS, "TTFB")
    processor.assert_within_budget(averaged['dom_content_loaded'], MAX_DOM_CONTENT_LOADED_MS, "DOMContentLoaded")
    processor.assert_within_budget(averaged['fcp'], MAX_FCP_MS, "FCP")
    processor.assert_within_budget(averaged['tti'], MAX_TTI_MS, "TTI")
    processor.assert_within_budget(averaged['full_load'], MAX_FULL_LOAD_MS, "Full load")
