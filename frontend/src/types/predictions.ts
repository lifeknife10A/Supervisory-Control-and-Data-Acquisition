// Shapes returned by the bridge's /api/predictions and /api/alerts (backend/ml_engine.py, alerts.py).

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface MLAlert {
  alert_id: number;
  kind: string;
  severity: AlertSeverity;
  message: string;
  details: Record<string, number | string | null>;
  raised_at: string;
  last_seen: string;
}

export interface AlertEvent extends MLAlert {
  event: 'raised' | 'cleared';
  timestamp: string;
}

export interface AnomalyPrediction {
  score: number | null;
  detected: boolean | null;
  envelope_score: number | null;
  iforest_score: number | null;
}

export interface FaultPrediction {
  label: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface PumpHealthPrediction {
  health: number;
  label: 'GOOD' | 'DEGRADING' | 'SERVICE SOON';
  updated_at: string;
}

export interface GasPrediction {
  ppm_calibrated: number;
  ppm_uncompensated: number;
  rs_r0_ratio: number;
  compensated: boolean;
  method: 'model' | 'datasheet';
}

export interface ForecastEntry {
  value: number;
  rate_per_min: number;
  predicted: number;
  eta_warning_s: number | null;
  eta_trip_s: number | null;
}

export interface Forecast {
  tank_level: ForecastEntry;
  temperature: ForecastEntry;
  gas_ppm: ForecastEntry;
  horizon_s: number;
}

export interface ModelStatus {
  profile: string;
  anomaly_envelope: boolean;
  anomaly_iforest: boolean;
  fault_classifier: boolean;
  pump_health: boolean;
  gas_calibration: 'model' | 'datasheet';
}

export interface Predictions {
  operating_mode: 'filling' | 'draining' | 'idle';
  anomaly: AnomalyPrediction;
  fault: FaultPrediction | null;
  pump_health: PumpHealthPrediction | null;
  gas: GasPrediction | null;
  forecast: Forecast | null;
  models: ModelStatus;
}

export interface PredictionsResponse {
  predictions: Predictions | null;
  alerts: MLAlert[];
  models: ModelStatus;
  timestamp: string;
}
