"""Debounced alerts over every detection, with an append-only CSV event log.

A detection must hold for RAISE_AFTER consecutive samples before it becomes an alert and
be absent for CLEAR_AFTER samples before it clears, so one noisy reading never pages an
operator. Safety trips and invalid telemetry raise immediately. Every raise and clear is
written to data/events.csv and kept in memory for /api/alerts.
"""

import csv
import json
import logging
import os
from collections import deque
from datetime import datetime, timezone

RAISE_AFTER = 4
CLEAR_AFTER = 8
IMMEDIATE = {"safety_trip", "data_invalid"}
SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2}
EVENT_FIELDS = ("timestamp", "event", "alert_id", "kind", "severity", "message", "details")
DEFAULT_EVENT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "events.csv")
logger = logging.getLogger(__name__)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class EventLog:
    def __init__(self, path=DEFAULT_EVENT_PATH):
        self.path = path

    def log(self, event):
        try:
            os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
            new_file = not os.path.exists(self.path) or os.path.getsize(self.path) == 0
            with open(self.path, "a", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=EVENT_FIELDS)
                if new_file:
                    writer.writeheader()
                writer.writerow({**{k: event.get(k) for k in EVENT_FIELDS},
                                 "details": json.dumps(event.get("details") or {}, allow_nan=False)})
        except (OSError, ValueError):
            logger.exception("Event log write failed")


class AlertManager:
    def __init__(self, event_log=None, raise_after=RAISE_AFTER, clear_after=CLEAR_AFTER, history=200):
        self.event_log = event_log
        self.raise_after, self.clear_after = raise_after, clear_after
        self.active = {}
        self.streaks = {}  # kind -> (consecutive positives, consecutive negatives)
        self.history = deque(maxlen=history)
        self.next_id = 1

    def _record(self, event):
        self.history.appendleft(event)
        if self.event_log is not None:
            self.event_log.log(event)

    def update(self, detections):
        """detections: {kind: (severity, message, details)} true for this sample. Returns new alerts."""
        raised = []
        for kind in set(detections) | set(self.active) | set(self.streaks):
            pos, neg = self.streaks.get(kind, (0, 0))
            pos, neg = (pos + 1, 0) if kind in detections else (0, neg + 1)
            self.streaks[kind] = (pos, neg)
            if kind in detections:
                severity, message, details = detections[kind]
                if kind in self.active:
                    alert = self.active[kind]
                    alert.update(severity=severity, message=message, details=details, last_seen=now_iso())
                elif pos >= (1 if kind in IMMEDIATE else self.raise_after):
                    alert = {"alert_id": self.next_id, "kind": kind, "severity": severity,
                             "message": message, "details": details,
                             "raised_at": now_iso(), "last_seen": now_iso()}
                    self.next_id += 1
                    self.active[kind] = alert
                    self._record({**alert, "event": "raised", "timestamp": alert["raised_at"]})
                    log = logger.error if severity == "critical" else logger.warning
                    log("ALERT %s [%s]: %s", kind, severity, message)
                    raised.append(alert)
            elif kind in self.active and neg >= (1 if kind in IMMEDIATE else self.clear_after):
                alert = self.active.pop(kind)
                self._record({**alert, "event": "cleared", "timestamp": now_iso()})
                logger.info("Cleared alert %s", kind)
            if pos == 0 and kind not in self.active:
                self.streaks.pop(kind, None)
        return raised

    def active_list(self):
        return sorted(self.active.values(), key=lambda a: (SEVERITY_ORDER.get(a["severity"], 9), a["alert_id"]))

    def recent(self, limit=50):
        return list(self.history)[:limit]
