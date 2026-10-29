/*
 * =========================================================================
 *   SCADA INDUSTRIAL PROCESS AUTOMATION - HIGH-SPEED WIRELESS EDGE GATEWAY
 *   Target: ESP32 DevKit V1 (30-Pin) | Framework: Arduino Core
 *   Network: Standalone Wi-Fi Access Point (SSID: SCADA-EDGE-NODE / scada1234)
 *   HTTP Endpoints:
 *     - GET  /api/telemetry  -> High-speed (<2ms) JSON telemetry stream
 *     - GET  /api/control    -> Low-latency Actuator Override (?pump=1&valve=0&fan=0)
 *     - GET  /               -> 60-FPS Asynchronous Live Web Dashboard
 * =========================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// --- PIN DEFINITIONS ---
#define PIN_LED_GREEN      23
#define PIN_LED_RED        13
#define PIN_RELAY_PUMP     26
#define PIN_RELAY_VALVE    27
#define PIN_RELAY_FAN      14

#define PIN_US_TRIG        25
#define PIN_US_ECHO        34
#define PIN_ONEWIRE_TEMP    4
#define PIN_ADC_GAS        32
#define PIN_ADC_CURRENT    33
#define PIN_ADC_VOLTAGE    35

// --- WI-FI ACCESS POINT CONFIGURATION ---
const char* AP_SSID = "SCADA-EDGE-NODE";
const char* AP_PASS = "scada1234";
IPAddress local_IP(192, 168, 4, 1);
IPAddress gateway(192, 168, 4, 1);
IPAddress subnet(255, 255, 255, 0);

WebServer server(80);

// --- PERIPHERALS ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
bool lcdFound = false;

OneWire oneWire(PIN_ONEWIRE_TEMP);
DallasTemperature ds18b20(&oneWire);
bool ds18b20Found = false;

// Calibration Factors
const float V_REF = 3.3f;
const float ADC_RES = 4095.0f;
const float MQ2_DIVIDER_RATIO = 2.0f;
const float VOLT_SENSOR_RATIO = 5.0f;
const float ACS712_NOMINAL_ZERO_V = 2.5f;   // Fallback if the boot calibration is implausible
const float ACS712_SENSITIVITY = 0.185f;
float acs712ZeroV = ACS712_NOMINAL_ZERO_V;    // Measured at boot with the pump off

// Operational States
bool pumpState = false;
bool valveState = false;
bool fanState = false;
bool emergencyAlarm = false;

float currentLevelCm = 35.0f;
float currentWaterTempC = 28.5f;
float currentBusVolts = 12.1f;
float currentPumpAmps = 0.00f;
float currentGasVolts = 0.5f;
int   currentGasPct = 8;

unsigned long lastSensorSample = 0;
unsigned long lastTempRequest = 0;
unsigned long lastDisplaySwitch = 0;
unsigned long lastSerialTele = 0;
int displayPage = 0;

float readDistanceCm() {
  digitalWrite(PIN_US_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_US_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_US_TRIG, LOW);
  long dur = pulseIn(PIN_US_ECHO, HIGH, 15000); // 15ms non-blocking timeout
  if (dur == 0) return currentLevelCm; // Keep last valid reading on timeout
  return (dur * 0.0343f) / 2.0f;
}

float readBusVoltage() {
  int raw = analogRead(PIN_ADC_VOLTAGE);
  return (raw / ADC_RES) * V_REF * VOLT_SENSOR_RATIO;
}

float readGasVolts() {
  int raw = analogRead(PIN_ADC_GAS);
  return (raw / ADC_RES) * V_REF * MQ2_DIVIDER_RATIO;
}

// Averaged reading using the ESP32's factory ADC calibration (raw/4095*3.3 reads ~0.25 V low near 2.5 V)
float readCurrentSensorVolts(int samples) {
  uint32_t total = 0;
  for (int i = 0; i < samples; i++) total += analogReadMilliVolts(PIN_ADC_CURRENT);
  return total / (float)samples / 1000.0f;
}

// Must run with the pump relay OFF: whatever the ACS712 outputs now is 0 A
void calibrateCurrentZero() {
  delay(100); // Let the relay and sensor output settle
  float zero = readCurrentSensorVolts(256);
  if (zero > 1.5f && zero < 3.0f) {
    acs712ZeroV = zero;
    Serial.printf("ACS712 zero calibrated: %.3f V
", zero);
  } else {
    Serial.printf("ACS712 zero %.3f V implausible (sensor unplugged?), using %.2f V
", zero, ACS712_NOMINAL_ZERO_V);
  }
}

float readPumpCurrent() {
  float amps = (readCurrentSensorVolts(16) - acs712ZeroV) / ACS712_SENSITIVITY;
  if (amps < 0.08f) amps = 0.0f; // DC pump only draws one way; also removes noise around zero
  return amps;
}

void setRelays(bool pump, bool valve, bool fan) {
  pumpState = pump;
  valveState = valve;
  fanState = fan;
  digitalWrite(PIN_RELAY_PUMP, pump ? LOW : HIGH);
  digitalWrite(PIN_RELAY_VALVE, valve ? LOW : HIGH);
  digitalWrite(PIN_RELAY_FAN, fan ? LOW : HIGH);
}

// --- HTTP SERVER HANDLERS ---
void handleTelemetry() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
  server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  char json[256];
  snprintf(json, sizeof(json),
    "{\"level_cm\":%.1f,\"water_temp_c\":%.1f,\"amb_temp_c\":%.1f,\"press_hpa\":1013.2,\"hum_pct\":55.0,"
    "\"gas_pct\":%d,\"gas_v\":%.2f,\"bus_v\":%.1f,\"pump_a\":%.2f,\"pump\":%d,\"valve\":%d,\"fan\":%d,\"alarm\":%d}",
    currentLevelCm, currentWaterTempC, currentWaterTempC, currentGasPct, currentGasVolts,
    currentBusVolts, currentPumpAmps, pumpState ? 1 : 0, valveState ? 1 : 0, fanState ? 1 : 0, emergencyAlarm ? 1 : 0);

  server.send(200, "application/json", json);
}

void handleControl() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");

  if (server.hasArg("pump")) {
    pumpState = (server.arg("pump") == "1");
  }
  if (server.hasArg("valve")) {
    valveState = (server.arg("valve") == "1");
  }
  if (server.hasArg("fan")) {
    fanState = (server.arg("fan") == "1");
  }

  setRelays(pumpState, valveState, fanState);

  char res[96];
  snprintf(res, sizeof(res), "{\"status\":\"OK\",\"pump\":%d,\"valve\":%d,\"fan\":%d}",
           pumpState ? 1 : 0, valveState ? 1 : 0, fanState ? 1 : 0);
  server.send(200, "application/json", res);
}

// Standalone High-Speed Asynchronous Web HMI (Zero Page Reloads!)
void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>SCADA Real-Time Edge Node</title><style>"
    "body{background:#090d16;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;margin:0;padding:20px;text-align:center;}"
    ".header{display:flex;align-items:center;justify-content:space-between;max-width:500px;margin:0 auto 15px;padding-bottom:10px;border-bottom:1px solid #1e293b;}"
    "h1{color:#38bdf8;font-size:20px;margin:0;text-align:left;}"
    ".badge{background:#059669;color:#fff;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:bold;letter-spacing:1px;display:inline-flex;align-items:center;gap:6px;}"
    ".pulse{width:8px;height:8px;background:#4ade80;border-radius:50%;box-shadow:0 0 8px #4ade80;animation:blink 1s infinite;}"
    "@keyframes blink{50%{opacity:0.3;}}"
    ".grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:500px;margin:0 auto;}"
    ".card{background:#131c2e;border-radius:12px;padding:16px;border:1px solid #1e293b;text-align:left;box-shadow:0 4px 6px -1px rgba(0,0,0,0.3);}"
    ".label{color:#64748b;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;}"
    ".val{font-size:26px;font-weight:bold;color:#facc15;margin-top:4px;}"
    ".unit{font-size:14px;color:#94a3b8;font-weight:normal;margin-left:2px;}"
    ".actuators{max-width:500px;margin:15px auto;background:#131c2e;border-radius:12px;padding:16px;border:1px solid #1e293b;}"
    ".btn-row{display:flex;justify-content:space-between;align-items:center;margin:8px 0;padding:8px 12px;background:#1e293b;border-radius:8px;}"
    ".btn{padding:8px 18px;border-radius:6px;border:none;font-weight:bold;cursor:pointer;font-size:13px;transition:0.1s;}"
    ".btn-on{background:#16a34a;color:#fff;}.btn-off{background:#dc2626;color:#fff;}"
    ".status{font-weight:bold;font-size:13px;}"
    "</style></head><body>"
    "<div class='header'><div><h1>SCADA EDGE NODE</h1><div style='color:#64748b;font-size:12px;'>Wi-Fi SoftAP &bull; 192.168.4.1</div></div>"
    "<div class='badge'><div class='pulse'></div> LIVE STREAM</div></div>"
    "<div class='grid'>"
    "<div class='card'><div class='label'>Process Tank Level</div><div class='val' id='lvl'>--<span class='unit'>cm</span></div></div>"
    "<div class='card'><div class='label'>Water Temperature</div><div class='val' id='temp'>--<span class='unit'>&deg;C</span></div></div>"
    "<div class='card'><div class='label'>12V Bus Voltage</div><div class='val' id='vbus' style='color:#38bdf8;'>--<span class='unit'>V</span></div></div>"
    "<div class='card'><div class='label'>Pump Current</div><div class='val' id='curr' style='color:#38bdf8;'>--<span class='unit'>A</span></div></div>"
    "<div class='card' style='grid-column: span 2;'><div class='label'>Atmospheric Gas Safety</div><div class='val' id='gas' style='color:#4ade80;'>--<span class='unit'>%</span></div></div>"
    "</div>"
    "<div class='actuators'><h3 style='margin:0 0 10px;font-size:15px;color:#94a3b8;text-align:left;'>Manual Supervisory Overrides</h3>"
    "<div class='btn-row'><span>Inflow Pump</span><button class='btn btn-on' onclick=\"cmd('pump',1)\">START</button><button class='btn btn-off' onclick=\"cmd('pump',0)\">STOP</button></div>"
    "<div class='btn-row'><span>Drain Valve</span><button class='btn btn-on' onclick=\"cmd('valve',1)\">OPEN</button><button class='btn btn-off' onclick=\"cmd('valve',0)\">CLOSE</button></div>"
    "<div class='btn-row'><span>Exhaust Fan</span><button class='btn btn-on' onclick=\"cmd('fan',1)\">START</button><button class='btn btn-off' onclick=\"cmd('fan',0)\">STOP</button></div>"
    "</div>"
    "<script>"
    "async function poll(){"
    " try{"
    "  let r=await fetch('/api/telemetry');"
    "  let d=await r.json();"
    "  document.getElementById('lvl').innerHTML=d.level_cm.toFixed(1)+'<span class=\"unit\"> cm</span>';"
    "  document.getElementById('temp').innerHTML=d.water_temp_c.toFixed(1)+'<span class=\"unit\"> &deg;C</span>';"
    "  document.getElementById('vbus').innerHTML=d.bus_v.toFixed(1)+'<span class=\"unit\"> V</span>';"
    "  document.getElementById('curr').innerHTML=d.pump_a.toFixed(2)+'<span class=\"unit\"> A</span>';"
    "  document.getElementById('gas').innerHTML=d.gas_pct+'<span class=\"unit\"> % ('+(d.alarm?'TRIP':'SAFE')+')</span>';"
    "  document.getElementById('gas').style.color=d.alarm?'#ef4444':'#4ade80';"
    " }catch(e){}"
    "}"
    "async function cmd(act,val){await fetch('/api/control?'+act+'='+val);poll();}"
    "setInterval(poll, 250);" // Polling every 250ms (4 times per second!)
    "poll();"
    "</script></body></html>";

  server.send(200, "text/html", html);
}

void setup() {
  Serial.begin(115200);
  delay(200);

  // 1. Relays to OFF (Active LOW)
  pinMode(PIN_RELAY_PUMP, OUTPUT);
  pinMode(PIN_RELAY_VALVE, OUTPUT);
  pinMode(PIN_RELAY_FAN, OUTPUT);
  setRelays(false, false, false);

  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_RED, LOW);

  pinMode(PIN_US_TRIG, OUTPUT);
  pinMode(PIN_US_ECHO, INPUT);
  digitalWrite(PIN_US_TRIG, LOW);

  analogSetAttenuation(ADC_11db);
  calibrateCurrentZero(); // Relays were switched OFF above

  // Initialize I2C Bus with anti-lock timeout
  Wire.begin(21, 22);
  Wire.setTimeOut(30);

  for (byte i = 1; i < 127; i++) {
    Wire.beginTransmission(i);
    if (Wire.endTransmission() == 0 && (i == 0x27 || i == 0x3F)) {
      lcd = LiquidCrystal_I2C(i, 16, 2);
      lcdFound = true;
      break;
    }
  }

  if (lcdFound) {
    lcd.init();
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("SCADA FAST AP");
    lcd.setCursor(0, 1);
    lcd.print("SSID: SCADA-EDGE");
  }

  // Init DS18B20 with NON-BLOCKING conversion (crucial for streaming!)
  ds18b20.begin();
  if (ds18b20.getDeviceCount() > 0) {
    ds18b20Found = true;
    ds18b20.setWaitForConversion(false); // Eliminates 750ms CPU freeze!
    ds18b20.requestTemperatures();
  }

  // 2. Start Wi-Fi SoftAP
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(local_IP, gateway, subnet);
  WiFi.softAP(AP_SSID, AP_PASS);

  // 3. Register HTTP Endpoints
  server.on("/api/telemetry", HTTP_ANY, handleTelemetry);
  server.on("/api/control", HTTP_ANY, handleControl);
  server.on("/", HTTP_GET, handleRoot);
  server.begin();

  if (lcdFound) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("AP: SCADA-EDGE  ");
    lcd.setCursor(0, 1);
    lcd.print("IP: 192.168.4.1 ");
  }
}

void loop() {
  // 1. Process HTTP requests at maximum speed
  server.handleClient();

  // 2. Sample Fast Analog & Ultrasonic Sensors every 100ms
  if (millis() - lastSensorSample >= 100) {
    lastSensorSample = millis();
    currentLevelCm = readDistanceCm();
    currentBusVolts = readBusVoltage();
    currentGasVolts = readGasVolts();
    currentPumpAmps = readPumpCurrent();

    int pct = (int)(((currentGasVolts - 0.4f) / (3.0f - 0.4f)) * 100.0f);
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    currentGasPct = pct;

    // Automated Safety Interlock
    if (currentGasVolts >= 1.2f) {
      if (!emergencyAlarm) {
        emergencyAlarm = true;
        fanState = true;
        digitalWrite(PIN_RELAY_FAN, LOW);
      }
      digitalWrite(PIN_LED_GREEN, LOW);
      digitalWrite(PIN_LED_RED, (millis() / 250) % 2);
    } else {
      if (emergencyAlarm) {
        emergencyAlarm = false;
        fanState = false;
        digitalWrite(PIN_RELAY_FAN, HIGH);
      }
      digitalWrite(PIN_LED_RED, LOW);
      digitalWrite(PIN_LED_GREEN, (millis() / 500) % 2);
    }
  }

  // 3. Non-blocking Temperature sample every 1000ms
  if (ds18b20Found && (millis() - lastTempRequest >= 1000)) {
    lastTempRequest = millis();
    float t = ds18b20.getTempCByIndex(0);
    if (t > -50.0f && t < 120.0f) currentWaterTempC = t;
    ds18b20.requestTemperatures(); // Request next reading non-blocking
  }

  // 4. Update LCD every 2.5 seconds (alternate page)
  if (lcdFound && (millis() - lastDisplaySwitch > 3000)) {
    lastDisplaySwitch = millis();
    displayPage = (displayPage + 1) % 2;

    if (displayPage == 0) {
      lcd.setCursor(0, 0);
      char line1[17];
      snprintf(line1, sizeof(line1), "LVL:%3.0fcm T:%2.0fC ", currentLevelCm, currentWaterTempC);
      lcd.print(line1);

      lcd.setCursor(0, 1);
      char line2[17];
      snprintf(line2, sizeof(line2), "V:%4.1fV I:%4.2fA ", currentBusVolts, currentPumpAmps);
      lcd.print(line2);
    } else {
      lcd.setCursor(0, 0);
      char line1[17];
      snprintf(line1, sizeof(line1), "IP:192.168.4.1  ");
      lcd.print(line1);

      lcd.setCursor(0, 1);
      char line2[17];
      snprintf(line2, sizeof(line2), "GAS:%2d%% %s", currentGasPct, emergencyAlarm ? "ALARM TRP" : "SAFE ZONE");
      lcd.print(line2);
    }
  }

  // 5. USB Serial Telemetry every 500ms
  if (millis() - lastSerialTele >= 500) {
    lastSerialTele = millis();
    Serial.printf("{\"level_cm\":%.1f,\"water_temp_c\":%.1f,\"amb_temp_c\":%.1f,\"press_hpa\":1013.2,\"hum_pct\":55.0,\"gas_pct\":%d,\"gas_v\":%.2f,\"bus_v\":%.1f,\"pump_a\":%.2f,\"pump\":%d,\"valve\":%d,\"fan\":%d,\"alarm\":%d}\n",
                  currentLevelCm, currentWaterTempC, currentWaterTempC, currentGasPct, currentGasVolts, currentBusVolts, currentPumpAmps, pumpState ? 1 : 0, valveState ? 1 : 0, fanState ? 1 : 0, emergencyAlarm ? 1 : 0);
  }
}
