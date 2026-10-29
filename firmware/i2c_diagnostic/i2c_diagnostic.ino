/*
 * SCADA I2C Diagnostic & Live BME/BMP280 Reader
 * Clean non-overlapping display
 */

#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <Adafruit_BMP280.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
Adafruit_BME280 bme;
Adafruit_BMP280 bmp;

bool lcdFound = false;
bool sensorFound = false;
bool isBme = false;

void setup() {
  Serial.begin(115200);
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
    lcd.print("I2C SCANNER...");
  }
}

void loop() {
  byte foundAddrs[8];
  byte count = 0;

  for (byte i = 1; i < 127; i++) {
    Wire.beginTransmission(i);
    if (Wire.endTransmission() == 0) {
      if (count < 8) {
        foundAddrs[count++] = i;
      }
    }
  }

  // Check if 0x76 or 0x77 is present
  bool has76 = false;
  bool has77 = false;
  for (byte j = 0; j < count; j++) {
    if (foundAddrs[j] == 0x76) has76 = true;
    if (foundAddrs[j] == 0x77) has77 = true;
  }

  byte targetAddr = has76 ? 0x76 : (has77 ? 0x77 : 0);

  if (targetAddr != 0 && !sensorFound) {
    if (bme.begin(targetAddr, &Wire)) {
      sensorFound = true;
      isBme = true;
    } else if (bmp.begin(targetAddr)) {
      sensorFound = true;
      isBme = false;
    }
  }

  if (lcdFound) {
    lcd.clear();
    lcd.setCursor(0, 0);
    if (sensorFound) {
      float temp = isBme ? bme.readTemperature() : bmp.readTemperature();
      float press = (isBme ? bme.readPressure() : bmp.readPressure()) / 100.0f;
      lcd.printf("T:%4.1fC P:%4.0f", temp, press);
    } else {
      char listBuf[17] = "";
      for (byte k = 0; k < count; k++) {
        char h[6];
        snprintf(h, sizeof(h), "%02X ", foundAddrs[k]);
        strcat(listBuf, h);
      }
      lcd.printf("ADDRS: %s", listBuf);
    }

    lcd.setCursor(0, 1);
    if (sensorFound) {
      if (isBme) {
        lcd.printf("HUM:%2.0f%% GYBM:OK", bme.readHumidity());
      } else {
        lcd.printf("GYBM:OK BMP280");
      }
    } else {
      if (targetAddr != 0) {
        lcd.printf("FOUND 0x%02X INIT..", targetAddr);
      } else {
        lcd.printf("NO SENSOR DETECT");
      }
    }
  }

  delay(700);
}
