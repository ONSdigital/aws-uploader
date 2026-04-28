from locust import LoadTestShape


class LoadShape(LoadTestShape):
    """
        Gradual ramp to 50 VUs, held for 5 min, then ramp down.
    """

    stages = [
        {"duration": 120, "users": 10, "spawn_rate": 2},    # Gentle start
        {"duration": 240, "users": 30, "spawn_rate": 5},    # Mid ramp
        {"duration": 420, "users": 50, "spawn_rate": 5},    # Peak
        {"duration": 540, "users": 50, "spawn_rate": 1},    # Hold
        {"duration": 600, "users": 10, "spawn_rate": 5},    # Ramp down
        {"duration": 660, "users": 0, "spawn_rate": 5},     # Done
    ]

    def tick(self):
        run_time = self.get_run_time()
        for stage in self.stages:
            if run_time < stage["duration"]:
                return stage["user"], stage["spawn_rate"]
        return None


class StressShape(LoadTestShape):
    """
    Escalating stress: VUs increase every 3 minutes until a ceiling
    """

    stages = [
        {"duration": 60,   "users": 10,  "spawn_rate": 5},
        {"duration": 180,  "users": 25,  "spawn_rate": 5},
        {"duration": 360,  "users": 50,  "spawn_rate": 10},
        {"duration": 540,  "users": 75,  "spawn_rate": 10},
        {"duration": 720,  "users": 100, "spawn_rate": 10},
        {"duration": 900,  "users": 150, "spawn_rate": 15},
        {"duration": 1080, "users": 200, "spawn_rate": 20},
        {"duration": 1260, "users": 300, "spawn_rate": 25},
        {"duration": 1440, "users": 350, "spawn_rate": 25},  # ~Max council load
    ]

    def tick(self):
        run_time = self.get_run_time()
        for stage in self.stages:
            if run_time < stage["duration"]:
                return stage["users"], stage["spawn_rate"]
        return None


class SpikeShape(LoadTestShape):
    """
    Spike: instant jump from 1 → 100 VUs, held briefly, then drop back.
    """

    stages = [
        {"duration": 10,  "users": 1,   "spawn_rate": 1},
        {"duration": 11,  "users": 100, "spawn_rate": 100},  # Instant spike
        {"duration": 130, "users": 100, "spawn_rate": 1},    # Hold
        {"duration": 140, "users": 5,   "spawn_rate": 100},  # Drop
        {"duration": 240, "users": 5,   "spawn_rate": 1},    # Recovery
    ]

    def tick(self):
        run_time = self.get_run_time()
        for stage in self.stages:
            if run_time < stage["duration"]:
                return stage["users"], stage["spawn_rate"]
        return None