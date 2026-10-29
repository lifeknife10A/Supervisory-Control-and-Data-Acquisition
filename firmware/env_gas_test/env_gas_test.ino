/*
 * SCADA Environmental & Gas Safety Interlock Test
 * Target: ESP32 DevKit V1 (30-Pin)
 * Serial Baud: 115200 | Framework: Arduino Core for ESP32
 * 
 * Features:
 * - Live MQ-2 Gas & Smoke Concentration monitoring (GPIO 32)
 * - Live GYBM (BME280/BMP280) Barometric Pressure, Temp & Humidity (I2C)
 * - Automatic Industrial Safety Interlock:
 *   If Gas exceeds safety threshold -> Red Alarm LED Blinks + Exhaust Fan (Relay 3) kicks ON!
 *   When air clears -> Fan turns OFF + Green Status LED returns.
 */

#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <Adafruit_BMP280.h>

#define PIN_LED_GREEN      23
#define PIN_LED_RED        13
#define PIN_RELAY_FAN      14
#define PIN_RELAY_PUMP     26
#define PIN_RELAY_VALVE    27

#define PIN_ADC_GAS        32
#define PIN_ADC_VOLTAGE    35

LiquidCrystal_I2C lcd(0x27, 16, 2);
bool lcdFound = false;

Adafruit_BME280 bme;
Adafruit_BMP280 bmp;
bool bmeFound = false;
bool bmpFound = false;

const float V_REF = 3.3f;
const float ADC_RES = 4095.0f;
const float MQ2_DIVIDER_RATIO = 2.0f; // 15k/15k divider
const float VOLT_SENSOR_RATIO = 5.0f;

// Gas Alarm Threshold (in sensor Volts, clean air is ~0.4V - 0.7V)
const float GAS_ALARM_VOLTS = 1.3f; 

float getBusVoltage() {
  int raw = analogRead(PIN_ADC_VOLTAGE);
  return (raw / ADC_RES) * V_REF * VOLT_SENSOR_RATIO;
}

float getGasVoltage() {
  int raw = analogRead(PIN_ADC_GAS);
  float adcVolts = (raw / ADC_RES) * V_REF;
  return adcVolts * MQ2_DIVIDER_RATIO;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=======================================================");
  Serial.println("  SCADA MQ-2 GAS & GYBM ENVIRONMENTAL MONITOR & INTERLOCK ");
  Serial.println("=======================================================");

  // Relays safe OFF (Active LOW: HIGH = OFF)
  pinMode(PIN_RELAY_PUMP, OUTPUT);
  pinMode(PIN_RELAY_VALVE, OUTPUT);
  pinMode(PIN_RELAY_FAN, OUTPUT);
  digitalWrite(PIN_RELAY_PUMP, HIGH);
  digitalWrite(PIN_RELAY_VALVE, HIGH);
  digitalWrite(PIN_RELAY_FAN, HIGH);

  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_RED, LOW);

  analogSetAttenuation(ADC_11db);

  // Initialize I2C Bus with anti-lock timeout
  Wire.begin(21, 22);
  Wire.setTimeOut(50);

  // Detect LCD
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
    lcd.print("ENV & GAS TEST");
    lcd.setCursor(0, 1);
    lcd.print("Calibrating...");
  }

  // Detect GYBM (BME280 / BMP280)
  if (bme.begin(0x76, &Wire) || bme.begin(0x77, &Wire)) {
    bmeFound = true;
    Serial.println("[GYBM] BME280 Detected (Pressure, Temp, Humidity)");
  } else if (bmp.begin(0x76) || bmp.begin(0x77)) {
    bmpFound = true;
    Serial.println("[GYBM] BMP280 Detected (Pressure, Temp)");
  } else {
    Serial.println("[GYBM] Note: BME/BMP280 not responding on 0x76/0x77.");
  }

  delay(1500);
}

void loop() {
  float gasVolts = getGasVoltage();
  float busVoltage = getBusVoltage();

  float ambTempC = 0.0f;
  float pressureHpa = 0.0f;
  float humidityPct = 0.0f;

  if (bmeFound) {
    ambTempC = bme.readTemperature();
    pressureHpa = bme.readPressure() / 100.0f;
    humidityPct = bme.readHumidity();
  } else if (bmpFound) {
    ambTempC = bmp.readTemperature();
    pressureHpa = bmp.readPressure() / 100.0f;
  }

  // Calculate intuitive Gas Index (0% - 100%)
  // Baseline clean air is ~0.4V, max hazardous gas is ~3.0V
  int gasPercent = (int)(((gasVolts - 0.4f) / (3.0f - 0.4f)) * 100.0f);
  if (gasPercent < 0) gasPercent = 0;
  if (gasPercent > 100) gasPercent = 100;

  // --- AUTOMATED SAFETY INTERLOCK ---
  bool gasAlarm = (gasVolts >= GAS_ALARM_VOLTS);

  if (gasAlarm) {
    // EMERGENCY GAS VENTILATION
    digitalWrite(PIN_RELAY_FAN, LOW);  // Turn ON 12V Exhaust Fan!
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, (millis() / 250) % 2); // Fast alarm blink

    Serial.printf("[ALARM! GAS DETECTED] Gas: %4.2fV (%d%%) -> EXHAUST FAN ACTIVE!\n", gasVolts, gasPercent);

    if (lcdFound) {
      lcd.setCursor(0, 0);
      lcd.printf("ALARM: GAS %3d%% ", gasPercent);
      lcd.setCursor(0, 1);
      lcd.printf("FAN ON! V:%4.1fV", busVoltage);
    }
  } else {
    // NORMAL CLEAN AIR STATUS
    digitalWrite(PIN_RELAY_FAN, HIGH); // Exhaust Fan OFF
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_RED, LOW);

    Serial.printf("[NORMAL] Gas: %4.2fV (%d%%) | Amb T: %4.1fC | Press: %5.0fhPa | Hum: %3.0f%% | Bus: %4.1fV\n",
                  gasVolts, gasPercent, ambTempC, pressureHpa, humidityPct, busVoltage);

    if (lcdFound) {
      lcd.setCursor(0, 0);
      if (bmeFound) {
        lcd.printf("GAS:%2d%% H:%2.0f%%   ", gasPercent, humidityPct);
      } else {
        lcd.printf("GAS:%2d%% T:%2.0fC   ", gasPercent, ambTempC);
      }

      lcd.setCursor(0, 1);
      lcd.printf("P:%4.0fhPa V:%4.1fV", pressureHpa, busVoltage);
    }
  }

  delay(400);
}
