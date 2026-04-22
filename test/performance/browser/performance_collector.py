from playwright.sync_api import Page

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