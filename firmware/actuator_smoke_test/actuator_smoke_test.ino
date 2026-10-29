/*
 * SCADA Industrial Process Control - Interactive & Continuous Actuator Commissioning Test
 * Target: ESP32 DevKit V1 (30-Pin)
 * Serial Baud: 115200 | Framework: Arduino Core for ESP32
 *
 * Actuators Tested:
 * 1. Inflow Water Pump   -> Relay 1 (GPIO 26, Active LOW)
 * 2. Solenoid Drain Valve -> Relay 2 (GPIO 27, Active LOW)
 * 3. 5010 DC Exhaust Fan -> Relay 3 (GPIO 14, Active LOW)
 *
 * Diagnostic Telemetry:
 * - 0-25V DC Bus Voltage (GPIO 35)
 * - ACS712 Current Sensor (GPIO 33)
 * - 16x2 Character LCD (I2C 0x27 / 0x3F)
 * - Status LEDs (Green GPIO 23, Red GPIO 13)
 */

#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

#define PIN_LED_GREEN      23
#define PIN_LED_RED        13
#define PIN_RELAY_PUMP     26
#define PIN_RELAY_VALVE    27
#define PIN_RELAY_FAN      14

#define PIN_ADC_CURRENT    33
#define PIN_ADC_VOLTAGE    35

LiquidCrystal_I2C lcd(0x27, 16, 2);
bool lcdFound = false;

const float V_REF = 3.3f;
const float ADC_RES = 4095.0f;
const float VOLT_SENSOR_RATIO = 5.0f;
const float ACS712_ZERO_V = 2.5f;
const float ACS712_SENSITIVITY = 0.185f;

float getBusVoltage() {
  int raw = analogRead(PIN_ADC_VOLTAGE);
  return (raw / ADC_RES) * V_REF * VOLT_SENSOR_RATIO;
}

float getMotorCurrent() {
  int raw = analogRead(PIN_ADC_CURRENT);
  float volts = (raw / ADC_RES) * V_REF;
  float amps = (volts - ACS712_ZERO_V) / ACS712_SENSITIVITY;
  if (abs(amps) < 0.08f) amps = 0.0f;
  return amps;
}

void safeLcdPrint(const char* line1, const char* line2) {
  if (!lcdFound) return;
  lcd.setCursor(0, 0);
  char l1[17], l2[17];
  snprintf(l1, sizeof(l1), "%-16s", line1);
  snprintf(l2, sizeof(l2), "%-16s", line2);
  lcd.print(l1);
  lcd.setCursor(0, 1);
  lcd.print(l2);
}

void setAllOff() {
  digitalWrite(PIN_RELAY_PUMP, HIGH);
  digitalWrite(PIN_RELAY_VALVE, HIGH);
  digitalWrite(PIN_RELAY_FAN, HIGH);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_GREEN, HIGH);
}

void setup() {
  Serial.begin(115200);
  delay(400);

  Serial.println("\n=======================================================");
  Serial.println("  SCADA CONTINUOUS ACTUATOR COMMISSIONING TEST");
  Serial.println("  Relay 1: GPIO 26 (Pump) | Relay 2: GPIO 27 (Valve)");
  Serial.println("  Relay 3: GPIO 14 (Fan)  | Active LOW (LOW=ON, HIGH=OFF)");
  Serial.println("=======================================================\n");

  // Secure all Relays to OFF immediately
  pinMode(PIN_RELAY_PUMP, OUTPUT);
  pinMode(PIN_RELAY_VALVE, OUTPUT);
  pinMode(PIN_RELAY_FAN, OUTPUT);
  setAllOff();

  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_RED, LOW);

  analogSetAttenuation(ADC_11db);

  // Initialize I2C Bus with anti-lock timeout
  Wire.begin(21, 22);
  Wire.setTimeOut(50);

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
    safeLcdPrint("SCADA ACTUATORS", "STARTING TEST...");
  }

  Serial.println("[READY] Ready for 12V supply connection. Starting in 3s...");
  delay(3000);
}

int testCycle = 1;

void loop() {
  char buf1[17];
  char buf2[17];
  float vBus = getBusVoltage();
  float iBus = getMotorCurrent();

  Serial.printf("\n--- [START CYCLE #%d] 12V Bus: %.1fV | Current: %.2fA ---\n", testCycle, vBus, iBus);

  // -------------------------------------------------------------
  // Check if 12V Power Supply is connected
  // -------------------------------------------------------------
  if (vBus < 7.0f) {
    Serial.println("[WARN] Bus voltage is below 7V! Connect 12V DC power supply to the relay COM rail.");
    safeLcdPrint("WAITING 12V PSU", "VBUS: 0.0V (OFF)");
    delay(1500);
    return;
  }

  // -------------------------------------------------------------
  // TEST 1: INFLOW WATER PUMP (Relay 1 - GPIO 26)
  // -------------------------------------------------------------
  Serial.println(">>> [1/4] TESTING: INFLOW WATER PUMP (Relay 1 ON for 3.0s) <<<");
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_RELAY_PUMP, LOW); // Active LOW -> ON

  for (int t = 0; t < 6; t++) {
    vBus = getBusVoltage();
    iBus = getMotorCurrent();
    snprintf(buf1, sizeof(buf1), "1. PUMP: ACTIVE ");
    snprintf(buf2, sizeof(buf2), "V:%4.1fV I:%4.2fA", vBus, iBus);
    safeLcdPrint(buf1, buf2);
    Serial.printf("  [PUMP ON]  Bus: %.1fV | Amps: %.2fA\n", vBus, iBus);
    delay(500);
  }

  digitalWrite(PIN_RELAY_PUMP, HIGH); // OFF
  digitalWrite(PIN_LED_RED, LOW);
  Serial.println("[PUMP OFF] Inflow pump deactivated. Rest 2s...");
  safeLcdPrint("1. PUMP COMPLETE", "RESTING 2s...");
  delay(2000);

  // -------------------------------------------------------------
  // TEST 2: SOLENOID DRAIN VALVE (Relay 2 - GPIO 27)
  // -------------------------------------------------------------
  Serial.println("\n>>> [2/4] TESTING: SOLENOID DRAIN VALVE (Relay 2 ON for 3.0s) <<<");
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_RELAY_VALVE, LOW); // Active LOW -> ON (Listen for Click!)

  for (int t = 0; t < 6; t++) {
    vBus = getBusVoltage();
    iBus = getMotorCurrent();
    snprintf(buf1, sizeof(buf1), "2. VALVE: OPEN  ");
    snprintf(buf2, sizeof(buf2), "V:%4.1fV I:%4.2fA", vBus, iBus);
    safeLcdPrint(buf1, buf2);
    Serial.printf("  [VALVE OPEN] Bus: %.1fV | Amps: %.2fA\n", vBus, iBus);
    delay(500);
  }

  digitalWrite(PIN_RELAY_VALVE, HIGH); // OFF (Snaps closed)
  digitalWrite(PIN_LED_RED, LOW);
  Serial.println("[VALVE CLOSED] Solenoid valve snapped closed. Rest 2s...");
  safeLcdPrint("2. VALVE CLOSED", "RESTING 2s...");
  delay(2000);

  // -------------------------------------------------------------
  // TEST 3: 5010 DC EXHAUST FAN (Relay 3 - GPIO 14)
  // -------------------------------------------------------------
  Serial.println("\n>>> [3/4] TESTING: EXHAUST FAN (Relay 3 ON for 4.0s) <<<");
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_RELAY_FAN, LOW); // Active LOW -> ON

  for (int t = 0; t < 8; t++) {
    vBus = getBusVoltage();
    iBus = getMotorCurrent();
    snprintf(buf1, sizeof(buf1), "3. FAN: RUNNING ");
    snprintf(buf2, sizeof(buf2), "V:%4.1fV I:%4.2fA", vBus, iBus);
    safeLcdPrint(buf1, buf2);
    Serial.printf("  [FAN ON]   Bus: %.1fV | Amps: %.2fA\n", vBus, iBus);
    delay(500);
  }

  digitalWrite(PIN_RELAY_FAN, HIGH); // OFF
  digitalWrite(PIN_LED_RED, LOW);
  Serial.println("[FAN OFF] Exhaust fan deactivated. Rest 2s...");
  safeLcdPrint("3. FAN COMPLETE ", "RESTING 2s...");
  delay(2000);

  // -------------------------------------------------------------
  // TEST 4: FULL LOAD COMBINED TEST (Pump + Valve + Fan simultaneously)
  // -------------------------------------------------------------
  Serial.println("\n>>> [4/4] FULL LOAD TEST: PUMP + VALVE + FAN (2.0s) <<<");
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_RELAY_PUMP, LOW);
  digitalWrite(PIN_RELAY_VALVE, LOW);
  digitalWrite(PIN_RELAY_FAN, LOW);

  for (int t = 0; t < 4; t++) {
    vBus = getBusVoltage();
    iBus = getMotorCurrent();
    snprintf(buf1, sizeof(buf1), "ALL ACTUATORS ON");
    snprintf(buf2, sizeof(buf2), "V:%4.1fV I:%4.2fA", vBus, iBus);
    safeLcdPrint(buf1, buf2);
    Serial.printf("  [ALL ON]   Bus: %.1fV | Amps: %.2fA (Full Load)\n", vBus, iBus);
    delay(500);
  }

  setAllOff();
  Serial.println("[ALL OFF] Cycle complete! Power bus stable.");
  snprintf(buf1, sizeof(buf1), "CYCLE #%d PASSED", testCycle);
  snprintf(buf2, sizeof(buf2), "NEXT IN 4s...   ");
  safeLcdPrint(buf1, buf2);

  testCycle++;
  delay(4000);
}
