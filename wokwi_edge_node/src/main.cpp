/*
 * SCADA Industrial Automation & Process Control Node
 * Target: ESP32 DevKit V1 (30-pin) | Framework: Arduino Core for ESP32
 * Features: Modbus TCP Server (Port 502), Dallas DS18B20 1-Wire, HC-SR04 Ultrasonic,
 *           MQ-2 Gas ADC, ACS712 Current ADC, LCD1602 I2C Display, Safety Interlocks
 */

#include <WiFi.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ModbusIP_ESP8266.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// --- PIN ASSIGNMENTS (Synchronized with HARDWARE_PINS) ---
#define PIN_LED_GREEN     2   // Green Normal Operation Status LED
#define PIN_LED_RED      12   // Red Critical Alarm Trip LED
#define PIN_RELAY_PUMP   26   // Inflow Submersible Pump Relay (Driver IN)
#define PIN_VALVE_DRIVER 27   // Emergency Drain Valve Relay (Driver IN)
#define PIN_FAN_DRIVER   14   // Toxic Gas Exhaust Safety Fan (Driver IN)

#define PIN_US_TRIG      25   // HC-SR04 Ultrasonic Trigger Pulse (Output)
#define PIN_US_ECHO      34   // HC-SR04 Ultrasonic Echo Pulse (Input via 5V->3.3V Divider)
#define PIN_ONEWIRE_TEMP  4   // DS18B20 1-Wire Bus (with 4.7kΩ Pull-up)
#define PIN_ADC_GAS      32   // MQ-2 Gas Sensor Analog Output (ADC1_CH4)
#define PIN_ADC_CURRENT  33   // ACS712-05B Current Sensor Output (ADC1_CH5)

// --- MODBUS REGISTERS & COILS SPECIFICATION ---
// Protocol Offset 0-based mapping to Standard 4xxxx / 0xxxx PLC Addresses:
const int REG_OFFSET_TANK_LEVEL  = 0; // 40001: Tank Level (x10 %) [Offset 0]
const int REG_OFFSET_TEMPERATURE = 1; // 40002: Temperature (x10 °C) [Offset 1]
const int REG_OFFSET_GAS_PPM     = 2; // 40003: Gas Concentration (PPM) [Offset 2]
const int REG_OFFSET_CURRENT     = 3; // 40004: Motor Current (x100 A) [Offset 3]

const int COIL_OFFSET_PUMP       = 0; // 00001: Pump Relay State [Offset 0]
const int COIL_OFFSET_VALVE      = 1; // 00002: Valve Relay State [Offset 1]
const int COIL_OFFSET_FAN        = 2; // 00003: Exhaust Fan State [Offset 2]

// --- PERIPHERALS & NETWORKING ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
ModbusIP mb;
OneWire oneWire(PIN_ONEWIRE_TEMP);
DallasTemperature sensors(&oneWire);

const char* ssid     = "SCADA_VLAN_10";
const char* password = "IndustrialSecretKey#2026";
const float TANK_DEPTH_CM = 100.0f; // Max ultrasonic measurement depth

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n[BOOT] ESP32 SCADA Node starting up...");

  // Initialize GPIOs
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_RELAY_PUMP, OUTPUT);
  pinMode(PIN_VALVE_DRIVER, OUTPUT);
  pinMode(PIN_FAN_DRIVER, OUTPUT);
  pinMode(PIN_US_TRIG, OUTPUT);
  pinMode(PIN_US_ECHO, INPUT);

  digitalWrite(PIN_US_TRIG, LOW);
  digitalWrite(PIN_RELAY_PUMP, HIGH);   // Initial fill
  digitalWrite(PIN_VALVE_DRIVER, LOW);  // Valve closed
  digitalWrite(PIN_FAN_DRIVER, LOW);    // Fan off
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_RED, LOW);

  // Initialize Dallas 1-Wire Temperature
  sensors.begin();

  // Initialize I2C LCD
  Wire.begin(21, 22); // SDA=21, SCL=22
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("SCADA NODE INIT");
  lcd.setCursor(0, 1);
  lcd.print("WiFi Connecting..");

  // Connect to Plant Wi-Fi
  WiFi.begin(ssid, password);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(250);
    Serial.print(".");
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Standalone Mode (AP fallback)");
  }

  // Setup Modbus TCP Server
  mb.server();
  mb.addHreg(REG_OFFSET_TANK_LEVEL);
  mb.addHreg(REG_OFFSET_TEMPERATURE);
  mb.addHreg(REG_OFFSET_GAS_PPM);
  mb.addHreg(REG_OFFSET_CURRENT);
  mb.addCoil(COIL_OFFSET_PUMP, true);
  mb.addCoil(COIL_OFFSET_VALVE, false);
  mb.addCoil(COIL_OFFSET_FAN, false);

  Serial.println("[MODBUS] Modbus TCP Server Ready on Port 502 (Slave ID: 1)");
}

void loop() {
  // Service Modbus TCP Requests
  mb.task();

  // 1. Read Ultrasonic Level Sensor (HC-SR04)
  digitalWrite(PIN_US_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_US_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_US_TRIG, LOW);
  long echoDuration = pulseIn(PIN_US_ECHO, HIGH, 30000); // 30ms timeout
  float tankLevel = 0.0f;
  if (echoDuration > 0) {
    float distanceCm = (echoDuration * 0.0343f) / 2.0f;
    tankLevel = constrain(((TANK_DEPTH_CM - distanceCm) / TANK_DEPTH_CM) * 100.0f, 0.0f, 100.0f);
  }

  // 2. Read DS18B20 Digital Temperature
  sensors.requestTemperatures();
  float temperature = sensors.getTempCByIndex(0);
  bool tempSensorFault = (temperature == -127.0f || temperature < -55.0f);

  // 3. Read Analog MQ-2 Gas Sensor (12-bit ADC: 0-4095)
  uint16_t rawGas = analogRead(PIN_ADC_GAS);
  float gasPpm = constrain((rawGas / 4095.0f) * 1000.0f, 0.0f, 1000.0f);

  // 4. Read Analog ACS712 Current Sensor (12-bit ADC: 0-4095)
  uint16_t rawCurrent = analogRead(PIN_ADC_CURRENT);
  float motorAmps = constrain((rawCurrent / 4095.0f) * 5.0f, 0.0f, 5.0f);

  // Supervisory & Master Safety Policy
  bool pumpState = mb.Coil(COIL_OFFSET_PUMP);
  bool valveState = mb.Coil(COIL_OFFSET_VALVE);
  bool fanState = mb.Coil(COIL_OFFSET_FAN);

  // Check Critical Alarm Conditions
  bool highLevelAlarm = (tankLevel >= 88.0f);
  bool lowLevelAlarm = (tankLevel <= 25.0f);
  bool highGasAlarm = (gasPpm >= 250.0f);
  bool fanTrigger = (gasPpm > 80.0f);
  bool overTempAlarm = (!tempSensorFault && temperature >= 70.0f);
  bool overCurrentAlarm = (motorAmps >= 3.8f);

  bool masterTrip = highLevelAlarm || highGasAlarm || overTempAlarm || overCurrentAlarm;

  if (masterTrip) {
    // Interlock: Emergency shutdown of feed pump
    pumpState = false;
    if (highLevelAlarm) {
      valveState = true; // Open relief drain
    }
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, (millis() / 250) % 2); // Fast Red strobe
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
  } else if (gasPpm < 45.0f) {
    fanState = false;
  }

  // Write Physical Outputs
  digitalWrite(PIN_RELAY_PUMP, pumpState ? HIGH : LOW);
  digitalWrite(PIN_VALVE_DRIVER, valveState ? HIGH : LOW);
  digitalWrite(PIN_FAN_DRIVER, fanState ? HIGH : LOW);

  // Update Modbus Registers & Coils
  mb.Hreg(REG_OFFSET_TANK_LEVEL, (uint16_t)(tankLevel * 10));
  mb.Hreg(REG_OFFSET_TEMPERATURE, tempSensorFault ? 0 : (uint16_t)(temperature * 10));
  mb.Hreg(REG_OFFSET_GAS_PPM, (uint16_t)gasPpm);
  mb.Hreg(REG_OFFSET_CURRENT, (uint16_t)(motorAmps * 100));
  mb.Coil(COIL_OFFSET_PUMP, pumpState);
  mb.Coil(COIL_OFFSET_VALVE, valveState);
  mb.Coil(COIL_OFFSET_FAN, fanState);

  // Update 16x2 I2C LCD Display (500ms refresh rate)
  static unsigned long lastDisplay = 0;
  if (millis() - lastDisplay > 500) {
    lastDisplay = millis();
    lcd.setCursor(0, 0);
    lcd.printf("L:%.1f%% P:%s   ", tankLevel, pumpState ? "ON " : "OFF");
    lcd.setCursor(0, 1);
    if (tempSensorFault) {
      lcd.printf("T:ERR  G:%.0fppm", gasPpm);
    } else {
      lcd.printf("T:%.0fC G:%.0fppm", temperature, gasPpm);
    }
  }

  delay(50);
}
