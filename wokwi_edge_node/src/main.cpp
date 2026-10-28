/*
 * SCADA Industrial Automation & Process Control Node
 * Target: ESP32 DevKit V1 (30-pin) | Framework: Arduino Core for ESP32
 * Features: Modbus TCP Server (Port 502), Dallas DS18B20 1-Wire, HC-SR04 Ultrasonic,
 *           MQ-2 Gas ADC, ACS712 Current ADC, BME280 Ambient I2C, 0-25V Supply Sensor,
 *           LCD1602 I2C Display, Fail-safe Safety Interlocks
 * Build:    pio run -e esp32dev (physical board) | pio run -e wokwi (Wokwi simulator)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <math.h>
#include <LiquidCrystal_I2C.h>
#include <ModbusIP_ESP8266.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_BME280.h>

// Real credentials live in src/secrets.h (gitignored; copy secrets.example.h).
#if __has_include("secrets.h")
#include "secrets.h"
#else
#define WIFI_SSID     "Wokwi-GUEST"
#define WIFI_PASSWORD ""
#endif

// --- PIN ASSIGNMENTS (Synchronized with HARDWARE_PINS and TRACKER.md) ---
#define PIN_LED_GREEN    23   // Green Normal Operation Status LED
#define PIN_LED_RED      13   // Red Critical Alarm Trip LED
#define PIN_RELAY_PUMP   26   // Inflow Submersible Pump Relay (Driver IN)
#define PIN_VALVE_DRIVER 27   // Emergency Drain Valve Relay (Driver IN)
#define PIN_FAN_DRIVER   14   // Toxic Gas Exhaust Safety Fan (Driver IN)

#define PIN_US_TRIG      25   // HC-SR04 Ultrasonic Trigger Pulse (Output)
#define PIN_US_ECHO      34   // HC-SR04 Ultrasonic Echo Pulse (Input via 5V->3.0V Divider)
#define PIN_ONEWIRE_TEMP  4   // DS18B20 1-Wire Bus (with 4.7kΩ Pull-up)
#define PIN_ADC_GAS      32   // MQ-2 Gas Sensor Analog Output via 15k/15k divider (ADC1_CH4)
#define PIN_ADC_CURRENT  33   // ACS712-05B Current Sensor Output (ADC1_CH5)
#define PIN_ADC_SUPPLY   35   // 0-25V Voltage Sensor Module S pin (ADC1_CH7)

// --- MODBUS REGISTERS & COILS SPECIFICATION ---
// Protocol Offset 0-based mapping to Standard 4xxxx / 0xxxx PLC Addresses.
// Signed values are int16 two's complement: read them as I16 in LabVIEW.
const int REG_OFFSET_TANK_LEVEL   = 0; // 40001: Tank Level (x10 %)
const int REG_OFFSET_TEMPERATURE  = 1; // 40002: Process Temperature (x10 °C, I16)
const int REG_OFFSET_GAS_PPM      = 2; // 40003: Gas Concentration (PPM, LPG curve)
const int REG_OFFSET_CURRENT      = 3; // 40004: Motor Current (x100 A)
const int REG_OFFSET_AMBIENT_TEMP = 4; // 40005: BME280 Ambient Temperature (x10 °C, I16)
const int REG_OFFSET_HUMIDITY     = 5; // 40006: BME280 Relative Humidity (x10 %)
const int REG_OFFSET_PRESSURE     = 6; // 40007: BME280 Pressure (x10 hPa)
const int REG_OFFSET_SUPPLY_V     = 7; // 40008: Supply Voltage (x100 V)
const int REG_OFFSET_GAS_MV       = 8; // 40009: MQ-2 AO at the sensor (mV), for calibration
const int REG_COUNT               = 9;
// Written instead of a reading when its sensor is faulty, missing or warming up.
// 32767 is out of every engineering range for both U16 and I16 reads, so the bridge rejects it.
const uint16_t REG_SENSOR_FAULT   = 0x7FFF;

const int COIL_OFFSET_PUMP        = 0; // 00001: Pump Relay State
const int COIL_OFFSET_VALVE       = 1; // 00002: Valve Relay State
const int COIL_OFFSET_FAN         = 2; // 00003: Exhaust Fan State

// --- SENSOR CALIBRATION (measure these on your own rig) ---
const float TANK_DEPTH_CM        = 100.0f;  // Sensor face to empty-tank bottom
const int   ADC_SAMPLES          = 16;      // Averaged per analog reading

const float ACS712_MV_PER_A      = 185.0f;  // ACS712-05B sensitivity at 5V supply
const float ACS712_DIVIDER_RATIO = 1.0f;    // Set to (R1+R2)/R2 if a divider is added on OUT
const float ACS712_MIN_SENSOR_MV = 1500.0f; // Below this the 2.5V-centred output is disconnected

const float SUPPLY_DIVIDER_RATIO = 5.0f;    // 0-25V module is a 30k/7.5k divider

const float MQ2_DIVIDER_RATIO    = 2.0f;    // 15k/15k divider halves AO into the ADC
const float MQ2_SUPPLY_MV        = 5000.0f;
const float MQ2_RL_KOHM          = 1.0f;    // Module load resistor: "102" = 1k, "472" = 4.7k
const float MQ2_R0_KOHM          = 10.0f;   // Clean-air R0 printed on Serial as "[MQ2] R0 estimate"
const float MQ2_LPG_A            = 574.25f; // Datasheet LPG curve: ppm = A * (Rs/R0)^B
const float MQ2_LPG_B            = -2.222f;
const unsigned long MQ2_WARMUP_MS = 120000; // Heater warm-up; gas reported as fault until done

const unsigned long DS18B20_CONVERSION_MS = 750; // 12-bit conversion time

// --- PERIPHERALS & NETWORKING ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
ModbusIP mb;
OneWire oneWire(PIN_ONEWIRE_TEMP);
DallasTemperature sensors(&oneWire);
Adafruit_BME280 bme;
bool bmePresent = false;
float acs712ZeroSensorMv = 2500.0f;
float lastTemperature = DEVICE_DISCONNECTED_C;
unsigned long lastTempRequest = 0;

uint16_t encodeTenths(float value) {
  return (uint16_t)(int16_t)lroundf(value * 10.0f);
}

float readAdcMilliVolts(int pin) {
  uint32_t total = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) total += analogReadMilliVolts(pin);
  return (float)total / ADC_SAMPLES;
}

uint8_t readI2cChipId(uint8_t address) {
  Wire.beginTransmission(address);
  Wire.write(0xD0); // Bosch chip-id register
  if (Wire.endTransmission() != 0 || Wire.requestFrom(address, (uint8_t)1) != 1) return 0;
  return Wire.read();
}

void setupBme280() {
  for (uint8_t address : {0x76, 0x77}) {
    if (bme.begin(address, &Wire)) {
      bmePresent = true;
      Serial.printf("[BME280] Found at 0x%02X\n", address);
      return;
    }
    uint8_t chipId = readI2cChipId(address);
    if (chipId == 0x58) {
      Serial.printf("[BME280] 0x%02X is a BMP280 (no humidity); ambient registers report fault\n", address);
      return;
    }
  }
  Serial.println("[BME280] Not found; ambient registers report fault");
}

// Zero-current offset, measured with the pump relay open before anything is energised.
void calibrateAcs712() {
#ifndef WOKWI_SIM
  float sensorMv = 0.0f;
  for (int i = 0; i < 8; i++) sensorMv += readAdcMilliVolts(PIN_ADC_CURRENT) * ACS712_DIVIDER_RATIO;
  sensorMv /= 8;
  if (sensorMv > 2200.0f && sensorMv < 2800.0f) {
    acs712ZeroSensorMv = sensorMv;
    Serial.printf("[ACS712] Zero offset %.0f mV\n", sensorMv);
  } else {
    Serial.printf("[ACS712] Zero offset %.0f mV implausible; using nominal 2500 mV\n", sensorMv);
  }
#endif
}

// Returns amps, or NAN when the sensor is disconnected.
float readMotorAmps() {
  float pinMv = readAdcMilliVolts(PIN_ADC_CURRENT);
#ifdef WOKWI_SIM
  return constrain(pinMv / 3300.0f * 5.0f, 0.0f, 5.0f); // Potentiometer stand-in
#else
  float sensorMv = pinMv * ACS712_DIVIDER_RATIO;
  if (sensorMv < ACS712_MIN_SENSOR_MV) return NAN;
  return constrain((sensorMv - acs712ZeroSensorMv) / ACS712_MV_PER_A, 0.0f, 5.0f);
#endif
}

// Returns PPM, or NAN while the heater is still warming up.
float readGasPpm(float sensorMv) {
#ifdef WOKWI_SIM
  return constrain(sensorMv / MQ2_DIVIDER_RATIO / 3300.0f * 1000.0f, 0.0f, 1000.0f);
#else
  if (millis() < MQ2_WARMUP_MS) return NAN;
  if (sensorMv <= 1.0f) return 0.0f;
  if (sensorMv >= MQ2_SUPPLY_MV) return 1000.0f;
  float rsKohm = MQ2_RL_KOHM * (MQ2_SUPPLY_MV - sensorMv) / sensorMv;
  return constrain(MQ2_LPG_A * powf(rsKohm / MQ2_R0_KOHM, MQ2_LPG_B), 0.0f, 1000.0f);
#endif
}

void printMq2Calibration(float sensorMv) {
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint < 10000 || sensorMv <= 1.0f) return;
  lastPrint = millis();
  float rsKohm = MQ2_RL_KOHM * (MQ2_SUPPLY_MV - sensorMv) / sensorMv;
  // Rs/R0 is 9.83 in clean air (datasheet); copy this into MQ2_R0_KOHM after warm-up.
  Serial.printf("[MQ2] AO %.0f mV | Rs %.2f kOhm | R0 estimate (clean air) %.2f kOhm\n",
                sensorMv, rsKohm, rsKohm / 9.83f);
}

// Returns level %, or NAN when the echo times out.
float readTankLevel() {
  digitalWrite(PIN_US_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_US_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_US_TRIG, LOW);
  long echoDuration = pulseIn(PIN_US_ECHO, HIGH, 30000); // 30ms timeout
  if (echoDuration <= 0) return NAN;
  float distanceCm = (echoDuration * 0.0343f) / 2.0f;
  return constrain(((TANK_DEPTH_CM - distanceCm) / TANK_DEPTH_CM) * 100.0f, 0.0f, 100.0f);
}

// Non-blocking DS18B20: keeps the last reading while the next conversion runs.
float readTemperature() {
  if (millis() - lastTempRequest >= DS18B20_CONVERSION_MS) {
    lastTemperature = sensors.getTempCByIndex(0);
    sensors.requestTemperatures();
    lastTempRequest = millis();
  }
  return lastTemperature;
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n[BOOT] ESP32 SCADA Node starting up...");

  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_RELAY_PUMP, OUTPUT);
  pinMode(PIN_VALVE_DRIVER, OUTPUT);
  pinMode(PIN_FAN_DRIVER, OUTPUT);
  pinMode(PIN_US_TRIG, OUTPUT);
  pinMode(PIN_US_ECHO, INPUT);

  // Everything de-energised until sensors are calibrated.
  digitalWrite(PIN_US_TRIG, LOW);
  digitalWrite(PIN_RELAY_PUMP, LOW);
  digitalWrite(PIN_VALVE_DRIVER, LOW);
  digitalWrite(PIN_FAN_DRIVER, LOW);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, HIGH);
  analogSetAttenuation(ADC_11db);

  // Initialize Dallas 1-Wire Temperature (non-blocking conversions)
  sensors.begin();
  sensors.setWaitForConversion(false);
  sensors.requestTemperatures();
  lastTempRequest = millis();

  // Initialize I2C bus: LCD + BME280
  Wire.begin(21, 22); // SDA=21, SCL=22
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("SCADA NODE INIT");
  lcd.setCursor(0, 1);
  lcd.print("WiFi Connecting..");
  setupBme280();
  calibrateAcs712();

  // Connect to Plant Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(250);
    Serial.print(".");
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Not connected; Modbus unreachable until Wi-Fi recovers");
  }

  // Setup Modbus TCP Server
  mb.server();
  for (int reg = 0; reg < REG_COUNT; reg++) mb.addHreg(reg, REG_SENSOR_FAULT);
  mb.addCoil(COIL_OFFSET_PUMP, true);
  mb.addCoil(COIL_OFFSET_VALVE, false);
  mb.addCoil(COIL_OFFSET_FAN, false);

  Serial.println("[MODBUS] Modbus TCP Server Ready on Port 502 (Slave ID: 1)");
}

void loop() {
  // Service Modbus TCP Requests
  mb.task();

  // 1. Acquire process sensors (NAN = faulty / missing / warming up)
  float tankLevel = readTankLevel();
  float temperature = readTemperature();
  bool tempSensorFault = (temperature == DEVICE_DISCONNECTED_C || temperature < -55.0f);
  float gasSensorMv = readAdcMilliVolts(PIN_ADC_GAS) * MQ2_DIVIDER_RATIO;
  float gasPpm = readGasPpm(gasSensorMv);
  float motorAmps = readMotorAmps();
  float supplyVolts = readAdcMilliVolts(PIN_ADC_SUPPLY) * SUPPLY_DIVIDER_RATIO / 1000.0f;
  printMq2Calibration(gasSensorMv);

  bool levelFault = isnan(tankLevel);
  bool gasFault = isnan(gasPpm);
  bool currentFault = isnan(motorAmps);
  bool sensorFault = levelFault || tempSensorFault || gasFault || currentFault;

  // Supervisory & Master Safety Policy
  bool pumpState = mb.Coil(COIL_OFFSET_PUMP);
  bool valveState = mb.Coil(COIL_OFFSET_VALVE);
  bool fanState = mb.Coil(COIL_OFFSET_FAN);

  // Check Critical Alarm Conditions (a faulty sensor never raises or clears its own alarm)
  bool highLevelAlarm = (!levelFault && tankLevel >= 88.0f);
  bool lowLevelAlarm = (!levelFault && tankLevel <= 25.0f);
  bool highGasAlarm = (!gasFault && gasPpm >= 250.0f);
  bool fanTrigger = (!gasFault && gasPpm > 80.0f);
  bool overTempAlarm = (!tempSensorFault && temperature >= 70.0f);
  bool overCurrentAlarm = (!currentFault && motorAmps >= 3.8f);

  bool masterTrip = highLevelAlarm || highGasAlarm || overTempAlarm || overCurrentAlarm;

  if (masterTrip) {
    // Interlock: Emergency shutdown of feed pump
    pumpState = false;
    if (highLevelAlarm) {
      valveState = true; // Open relief drain
    }
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, (millis() / 250) % 2); // Fast Red strobe
  } else if (sensorFault) {
    // Fail-safe: never run the pump blind, ventilate while gas is unknown.
    pumpState = false;
    if (gasFault) fanState = true;
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, HIGH); // Solid red = sensor fault
  } else {
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_RED, LOW);
    if (lowLevelAlarm) {
      pumpState = true;
      valveState = false;
    }
  }

  // Exhaust Fan Control
  if (fanTrigger) {
    fanState = true;
  } else if (!gasFault && gasPpm < 45.0f) {
    fanState = false;
  }

  // Write Physical Outputs
  digitalWrite(PIN_RELAY_PUMP, pumpState ? HIGH : LOW);
  digitalWrite(PIN_VALVE_DRIVER, valveState ? HIGH : LOW);
  digitalWrite(PIN_FAN_DRIVER, fanState ? HIGH : LOW);

  // Update Modbus Registers & Coils
  mb.Hreg(REG_OFFSET_TANK_LEVEL, levelFault ? REG_SENSOR_FAULT : (uint16_t)lroundf(tankLevel * 10));
  mb.Hreg(REG_OFFSET_TEMPERATURE, tempSensorFault ? REG_SENSOR_FAULT : encodeTenths(temperature));
  mb.Hreg(REG_OFFSET_GAS_PPM, gasFault ? REG_SENSOR_FAULT : (uint16_t)lroundf(gasPpm));
  mb.Hreg(REG_OFFSET_CURRENT, currentFault ? REG_SENSOR_FAULT : (uint16_t)lroundf(motorAmps * 100));
  if (bmePresent) {
    mb.Hreg(REG_OFFSET_AMBIENT_TEMP, encodeTenths(bme.readTemperature()));
    mb.Hreg(REG_OFFSET_HUMIDITY, (uint16_t)lroundf(bme.readHumidity() * 10));
    mb.Hreg(REG_OFFSET_PRESSURE, (uint16_t)lroundf(bme.readPressure() / 10.0f)); // Pa -> x10 hPa
  }
  mb.Hreg(REG_OFFSET_SUPPLY_V, (uint16_t)lroundf(supplyVolts * 100));
  mb.Hreg(REG_OFFSET_GAS_MV, (uint16_t)lroundf(gasSensorMv));
  mb.Coil(COIL_OFFSET_PUMP, pumpState);
  mb.Coil(COIL_OFFSET_VALVE, valveState);
  mb.Coil(COIL_OFFSET_FAN, fanState);

  // Update 16x2 I2C LCD Display (500ms refresh rate)
  static unsigned long lastDisplay = 0;
  if (millis() - lastDisplay > 500) {
    lastDisplay = millis();
    lcd.setCursor(0, 0);
    if (levelFault) {
      lcd.printf("L:ERR  P:%s    ", pumpState ? "ON " : "OFF");
    } else {
      lcd.printf("L:%.1f%% P:%s   ", tankLevel, pumpState ? "ON " : "OFF");
    }
    lcd.setCursor(0, 1);
    char tempText[8], gasText[10];
    if (tempSensorFault) snprintf(tempText, sizeof(tempText), "ERR");
    else snprintf(tempText, sizeof(tempText), "%.0fC", temperature);
    if (gasFault) snprintf(gasText, sizeof(gasText), "WARMUP");
    else snprintf(gasText, sizeof(gasText), "%.0fppm", gasPpm);
    lcd.printf("T:%-4s G:%-7s", tempText, gasText);
  }

  delay(50);
}
