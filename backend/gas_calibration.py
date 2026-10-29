"""MQ-2 gas calibration with temperature/humidity compensation (advisory; safety uses firmware PPM).

Sources:
  LPG sensitivity curve ppm = 574.25 * (Rs/R0)^-2.222 and clean-air Rs/R0 = 9.83:
    MQUnifiedsensor library (miguel5612), fitted to the Hanwei MQ-2 datasheet Fig. 3;
    the firmware uses the same constants.
  Temperature/humidity dependence: Hanwei MQ-2 datasheet Fig. 4 (Rs/Rs(20 C, 33 %RH)).
    The datasheet only publishes the plot; TH_CURVE below is an approximate reading of it
    (about +/-5 %). Replace it with your own digitisation or reference data when available.
"""

import logging
import math
import os

MQ2_LPG_A = 574.25
MQ2_LPG_B = -2.222
MQ2_CLEAN_AIR_RATIO = 9.83
MQ2_SUPPLY_MV = 5000.0
# Must match MQ2_RL_KOHM / MQ2_R0_KOHM in wokwi_edge_node/src/main.cpp.
RL_KOHM = float(os.environ.get("SCADA_MQ2_RL_KOHM", "1.0"))
R0_KOHM = float(os.environ.get("SCADA_MQ2_R0_KOHM", "10.0"))
REFERENCE_TEMP, REFERENCE_RH = 20.0, 33.0
TH_CURVE = {
    33.0: [(-10, 1.40), (0, 1.25), (10, 1.10), (20, 1.00), (30, 0.92), (40, 0.86), (50, 0.82)],
    85.0: [(-10, 1.25), (0, 1.10), (10, 0.97), (20, 0.89), (30, 0.82), (40, 0.77), (50, 0.73)],
}
logger = logging.getLogger(__name__)


def _interp(points, x):
    if x <= points[0][0]:
        return points[0][1]
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return points[-1][1]


def th_factor(temp, rh):
    """Rs multiplier relative to the 20 C / 33 %RH reference."""
    low, high = _interp(TH_CURVE[33.0], temp), _interp(TH_CURVE[85.0], temp)
    weight = min(max((rh - 33.0) / (85.0 - 33.0), 0.0), 1.0)
    return low + (high - low) * weight


def ppm_from_ratio(ratio):
    return MQ2_LPG_A * ratio ** MQ2_LPG_B


def ratio_from_ppm(ppm, temp=REFERENCE_TEMP, rh=REFERENCE_RH):
    return (ppm / MQ2_LPG_A) ** (1.0 / MQ2_LPG_B) * th_factor(temp, rh)


def sensor_mv_from_ratio(ratio, rl=RL_KOHM, r0=R0_KOHM):
    return MQ2_SUPPLY_MV * rl / (rl + ratio * r0)


def ratio_from_sensor_mv(sensor_mv, rl=RL_KOHM, r0=R0_KOHM):
    if not 0 < sensor_mv < MQ2_SUPPLY_MV:
        return None
    return rl * (MQ2_SUPPLY_MV - sensor_mv) / sensor_mv / r0


def features(ratio, temp, rh):
    return [math.log10(ratio), temp, rh]


class GasCalibrator:
    """Learned ratio(T, RH) -> PPM map; falls back to the datasheet formula without a model."""

    def __init__(self, model=None):
        self.model = model

    @classmethod
    def load(cls, path):
        if not os.path.exists(path):
            return cls()
        try:
            import joblib
            return cls(joblib.load(path))
        except Exception:
            logger.exception("Could not load gas calibration model; using datasheet formula.")
            return cls()

    def predict(self, sensor_mv, ambient_temp=None, humidity=None):
        """Return None without a raw MQ-2 reading, else calibrated/uncompensated PPM."""
        if sensor_mv is None:
            return None
        ratio = ratio_from_sensor_mv(sensor_mv)
        if ratio is None or ratio <= 0:
            return None
        compensated = ambient_temp is not None and humidity is not None
        temp = ambient_temp if compensated else REFERENCE_TEMP
        rh = humidity if compensated else REFERENCE_RH
        if self.model is not None:
            ppm = 10 ** float(self.model.predict([features(ratio, temp, rh)])[0])
            method = "model"
        else:
            ppm = ppm_from_ratio(ratio / th_factor(temp, rh))
            method = "datasheet"
        return {
            "ppm_calibrated": round(min(ppm, 10000.0), 1),
            "ppm_uncompensated": round(min(ppm_from_ratio(ratio), 10000.0), 1),
            "rs_r0_ratio": round(ratio, 3),
            "compensated": compensated,
            "method": method,
        }
