"""Plant parameter profiles for synthetic training data and model selection.

`sim`  matches the 3D workbench simulator and labview_feeder_sim.py (1.6 A class pump).
`rig`  matches the physical BOM: 12V/5V mini centrifugal pump (~0.1-0.5 A), ACS712-05B,
       DS18B20, HC-SR04. Ranges are deliberately wide because the tank geometry is not
       known yet; retrain with logged rig data (train_models.py --csv) to tighten them.

Noise figures come from the part datasheets:
  ACS712-05B: 185 mV/A, ~21 mV p-p output noise -> ~0.02 A sd after 16x ADC averaging
  DS18B20:    0.0625 C resolution at 12 bit
  HC-SR04:    ~3 mm ranging accuracy -> ~0.15 % of a 100 cm tank
"""

import os

PROFILES = {
    "sim": {
        "dt": (0.2, 0.5),
        "pump_amps": (1.4, 1.9), "current_ripple": (0.0, 0.15), "current_noise": 0.05,
        "idle_amps": (0.0, 0.15),
        "fill_rate": (1.5, 3.0), "passive_leak": (0.0, 1.2), "drain_rate": (1.5, 10.0),
        "tank_noise": 0.08,
        "temp_base": (22.0, 40.0), "temp_noise": 0.1,
        "gas_base": (10.0, 45.0), "gas_noise": 1.5,
        "supply_v": (11.5, 12.5),
    },
    "rig": {
        "dt": (0.2, 0.6),
        "pump_amps": (0.12, 0.5), "current_ripple": (0.0, 0.03), "current_noise": 0.02,
        "idle_amps": (0.0, 0.05),
        "fill_rate": (0.5, 3.0), "passive_leak": (0.0, 0.3), "drain_rate": (1.0, 6.0),
        "tank_noise": 0.15,
        "temp_base": (18.0, 35.0), "temp_noise": 0.06,
        "gas_base": (2.0, 30.0), "gas_noise": 1.0,
        "supply_v": (11.4, 12.6),
    },
}
DEFAULT_PROFILE = "sim"
MODELS_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")


def active_profile():
    name = os.environ.get("SCADA_PLANT_PROFILE", DEFAULT_PROFILE)
    if name not in PROFILES:
        raise ValueError(f"Unknown SCADA_PLANT_PROFILE {name!r}; choose from {sorted(PROFILES)}")
    return name


def model_dir(profile):
    return os.path.join(MODELS_ROOT, profile)
