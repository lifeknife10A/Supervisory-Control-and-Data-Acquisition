/*
 * SCADA Industrial Process Control - Edge Node Hardware Verification
 * Target: ESP32 DevKit V1 (30-Pin)
 * Serial Baud: 115200 | Framework: Arduino Core for ESP32
 * 
 * Pinout Architecture (Locked & Verified via TRACKER.md):
 * - Status Green LED:     GPIO 23
 * - Alarm Red LED:        GPIO 13
 * - 4-Ch Relay IN1 (Pump):GPIO 26 (Active LOW)
 * - 4-Ch Relay IN2 (Valve):GPIO 27 (Active LOW)
 * - 4-Ch Relay IN3 (Fan): GPIO 14 (Active LOW)
 * - HC-SR04 Ultrasonic:   TRIG=GPIO 25, ECHO=GPIO 34 (via 3.0V divider)
 * - DS18B20 Temp Probe:   GPIO 4 (with 4.7k pull-up)
 * - MQ-2 Gas Analog AO:   GPIO 32 (via 2.5V 15k/15k divider)
 * - ACS712 Current OUT:   GPIO 33 (ADC1_CH5)
 * - 0-25V Voltage Sensor: GPIO 35 (ADC1_CH7, 5:1 divider)
 * - I2C Bus:              SDA=GPIO 21, SCL=GPIO 22
 *   - 16x2 LCD Display:   I2C 0x27 (or 0x3F)
 *   - GYBM BME/BMP280:    I2C 0x76 (or 0x77)
 */

#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <Adafruit_BMP280.h>

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

// --- PERIPHERAL OBJECTS ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
bool lcdFound = false;

OneWire oneWire(PIN_ONEWIRE_TEMP);
DallasTemperature ds18b20(&oneWire);
bool ds18b20Found = false;

Adafruit_BME280 bme;
Adafruit_BMP280 bmp;
bool bmeFound = false;
bool bmpFound = false;

// Calibration & Divider Scaling
const float V_REF = 3.3f;
const float ADC_RES = 4095.0f;
const float MQ2_DIVIDER_RATIO = (15.0f + 15.0f) / 15.0f; // 2.0x (15k/15k divider)
const float VOLT_SENSOR_RATIO = 5.0f;                    // 5:1 internal divider
const float ACS712_ZERO_V = 2.5f;                        // 2.5V quiescent zero-point
const float ACS712_SENSITIVITY = 0.185f;                 // 185 mV/A for 5A model

void scanI2C() {
  Serial.println("\n[I2C] Scanning I2C Bus on SDA=21, SCL=22...");
  byte count = 0;
  for (byte i = 1; i < 127; i++) {
    Wire.beginTransmission(i);
    if (Wire.endTransmission() == 0) {
      Serial.printf("[I2C] Device detected at 0x%02X", i);
      if (i == 0x27 || i == 0x3F) Serial.print(" (16x2 LCD Display)");
      if (i == 0x76 || i == 0x77) Serial.print(" (GYBM BME280/BMP280 Sensor)");
      Serial.println();
      count++;
      if (i == 0x27 || i == 0x3F) {
        lcd = LiquidCrystal_I2C(i, 16, 2);
        lcdFound = true;
      }
    }
  }
  if (count == 0) {
    Serial.println("[I2C] No I2C devices responded. Check SDA/SCL pull-ups.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=======================================================");
  Serial.println("  SCADA PROCESS CONTROL - EDGE NODE HARDWARE VERIFIER  ");
  Serial.println("=======================================================");

  // 1. Immediately secure all Relays to OFF (Active LOW relays: HIGH = OFF)
  pinMode(PIN_RELAY_PUMP, OUTPUT);
  pinMode(PIN_RELAY_VALVE, OUTPUT);
  pinMode(PIN_RELAY_FAN, OUTPUT);
  digitalWrite(PIN_RELAY_PUMP, HIGH);
  digitalWrite(PIN_RELAY_VALVE, HIGH);
  digitalWrite(PIN_RELAY_FAN, HIGH);
  Serial.println("[RELAY] All 3 Actuator channels initialized to OFF (Safe State).");

  // 2. Initialize Indicator LEDs
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  Serial.println("[LED] Cycling Indicator LEDs...");
  for (int i = 0; i < 2; i++) {
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_RED, LOW);
    delay(150);
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, HIGH);
    delay(150);
  }
  digitalWrite(PIN_LED_GREEN, HIGH); // Normal green run indicator on
  digitalWrite(PIN_LED_RED, LOW);
  Serial.println("[LED] Green Status LED ON, Red Alarm LED OFF.");

  // 3. Initialize Sensors
  pinMode(PIN_US_TRIG, OUTPUT);
  pinMode(PIN_US_ECHO, INPUT);
  digitalWrite(PIN_US_TRIG, LOW);

  // Initialize I2C Bus
  Wire.begin(21, 22);
  scanI2C();

  // Initialize LCD
  if (lcdFound) {
    lcd.init();
    lcd.backlight();
    lcd.setCursor(0, 0);
    lcd.print("SCADA NODE INIT");
    lcd.setCursor(0, 1);
    lcd.print("Sensors Online..");
    Serial.println("[LCD] 16x2 LCD initialized successfully.");
  }

  // Initialize BME280 / BMP280
  if (bme.begin(0x76, &Wire) || bme.begin(0x77, &Wire)) {
    bmeFound = true;
    Serial.println("[ENV] BME280 sensor initialized.");
  } else if (bmp.begin(0x76) || bmp.begin(0x77)) {
    bmpFound = true;
    Serial.println("[ENV] BMP280 sensor initialized.");
  } else {
    Serial.println("[ENV] Note: BME/BMP280 not detected (check 3.3V rail).");
  }

  // Initialize Dallas DS18B20 1-Wire
  ds18b20.begin();
  if (ds18b20.getDeviceCount() > 0) {
    ds18b20Found = true;
    Serial.printf("[TEMP] DS18B20 probe detected (%d sensor found).\n", ds18b20.getDeviceCount());
  } else {
    Serial.println("[TEMP] Note: DS18B20 probe not detected (check pull-up).");
  }

  // Configure ADC Attenuation for 0 - 3.3V Range
  analogSetAttenuation(ADC_11db);

  Serial.println("\n[SYSTEM] Initialization Complete. Starting Live Telemetry Stream...\n");
  delay(1000);
}

float readUltrasonicDistance() {
  digitalWrite(PIN_US_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_US_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_US_TRIG, LOW);
  long duration = pulseIn(PIN_US_ECHO, HIGH, 30000); // 30ms timeout (~5m)
  if (duration == 0) return -1.0f; // Timeout / out of range
  return (duration * 0.0343f) / 2.0f; // Distance in cm
}

void loop() {
  // 1. Read Ultrasonic Water Level
  float distanceCm = readUltrasonicDistance();

  // 2. Read MQ-2 Gas Sensor
  int rawGas = analogRead(PIN_ADC_GAS);
  float gasAdcVolts = (rawGas / ADC_RES) * V_REF;
  float gasSensorVolts = gasAdcVolts * MQ2_DIVIDER_RATIO;

  // 3. Read 0-25V DC Voltage Sensor
  int rawVolt = analogRead(PIN_ADC_VOLTAGE);
  float voltAdcVolts = (rawVolt / ADC_RES) * V_REF;
  float busVoltage = voltAdcVolts * VOLT_SENSOR_RATIO;

  // 4. Read ACS712 Current Sensor
  int rawCurr = analogRead(PIN_ADC_CURRENT);
  float currAdcVolts = (rawCurr / ADC_RES) * V_REF;
  float pumpCurrent = (currAdcVolts - ACS712_ZERO_V) / ACS712_SENSITIVITY;
  if (abs(pumpCurrent) < 0.05f) pumpCurrent = 0.0f; // Deadband filter

  // 5. Read DS18B20 Water Temperature
  float waterTempC = -999.0f;
  if (ds18b20Found) {
    ds18b20.requestTemperatures();
    waterTempC = ds18b20.getTempCByIndex(0);
  }

  // 6. Read Ambient Temp & Pressure (BME280 / BMP280)
  float ambTempC = 0.0f, pressureHpa = 0.0f, humidityPct = 0.0f;
  if (bmeFound) {
    ambTempC = bme.readTemperature();
    pressureHpa = bme.readPressure() / 100.0f;
    humidityPct = bme.readHumidity();
  } else if (bmpFound) {
    ambTempC = bmp.readTemperature();
    pressureHpa = bmp.readPressure() / 100.0f;
  }

  // 7. Output Formatted Serial Log & JSON
  Serial.printf("[TELEMETRY] Level: %5.1f cm | Gas: %4.2f V | DC Bus: %4.1f V | Current: %4.2f A | Water T: %4.1f C\n",
                distanceCm, gasSensorVolts, busVoltage, pumpCurrent, waterTempC);

  // 8. Update Local LCD Display
  if (lcdFound) {
    lcd.clear();
    lcd.setCursor(0, 0);
    if (distanceCm >= 0) {
      lcd.printf("LVL:%3.0fcm T:%2.0fC", distanceCm, (waterTempC > -100) ? waterTempC : ambTempC);
    } else {
      lcd.printf("LVL:--cm T:%2.0fC", (waterTempC > -100) ? waterTempC : ambTempC);
    }

    lcd.setCursor(0, 1);
    lcd.printf("V:%4.1fV I:%4.2fA", busVoltage, pumpCurrent);
  }

  delay(1000);
}
