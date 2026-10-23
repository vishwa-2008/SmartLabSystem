# KARE Smart Laboratory ESP32 Firmware & Hardware Guide

This directory contains the production-ready firmware for the ESP32 microcontroller integrated with optical and capacitive fingerprint sensors (AS608, R307, R503, DY50).

---

## 1. Bill of Materials (BOM)

| Component | Specification | Quantity | Description |
| :--- | :--- | :--- | :--- |
| **Microcontroller** | ESP32 DevKit V1 (30-pin or 38-pin) | 1 | Dual-core Tensilica Xtensa 32-bit LX6 with 2.4GHz Wi-Fi |
| **Fingerprint Sensor** | AS608 / R307 / R503 Optical or Capacitive | 1 | 57600 baud UART, onboard DSP feature extractor |
| **Status LEDs** | 5mm LEDs (Green, Red, Blue) | 3 | Visual state indicators with 220Ω current-limiting resistors |
| **Piezo Buzzer** | 5V Active Buzzer | 1 | Audio feedback for scan confirmation & errors |
| **Power Supply** | 5V / 2A Micro-USB or External PSU | 1 | Stable 5V DC source (Sensor peak draw ~120mA during scan) |
| **Jumper Wires** | Female-to-Female / Male-to-Female | 10 | Breadboard or PCB prototyping connections |

---

## 2. Hardware Wiring & Pinout

```
+-------------------------------------------------------+
|                     ESP32 DevKit V1                   |
|                                                       |
|  [3V3]   [GND]   [GPIO 16 (RX2)]   [GPIO 17 (TX2)]    |
+----|-------|------------|-----------------|-----------+
     |       |            |                 |
     |       |       (Yellow/Green)    (White/Blue)
     |       |            |                 |
+----|-------|------------|-----------------|-----------+
|   VCC     GND          TXD               RXD          |
|         AS608 / R307 / R503 Fingerprint Sensor        |
+-------------------------------------------------------+

Additional Peripherals:
- Green LED (Scan Success)   : GPIO 2  --> 220Ω --> Anode | Cathode --> GND
- Red LED (Scan Error)       : GPIO 4  --> 220Ω --> Anode | Cathode --> GND
- Blue LED (WiFi/Enrollment) : GPIO 5  --> 220Ω --> Anode | Cathode --> GND
- Buzzer (Audio Feedback)    : GPIO 18 --> Positive Pin   | Negative --> GND
```

> [!IMPORTANT]
> Some older optical fingerprint modules require 5V VCC instead of 3.3V. If the red optical prism LED does not illuminate on startup, connect the sensor VCC to the ESP32 **VIN** pin (providing 5V from USB). Sensor logic levels (TX/RX) are 3.3V-tolerant.

---

## 3. Arduino IDE Setup & Required Libraries

1. Install [Arduino IDE](https://www.arduino.cc/en/software) (version 2.2+ recommended).
2. Add ESP32 Board Support:
   - Go to **File > Preferences**
   - Add URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Open **Tools > Board > Boards Manager**, search for `esp32` by Espressif, and install.
3. Install the required libraries via **Sketch > Include Library > Manage Libraries**:
   - `Adafruit Fingerprint Sensor Library` (by Adafruit)
   - `ArduinoJson` (by Benoit Blanchon, version 6.x or 7.x)
   - Built-in `WiFi` and `HTTPClient` (bundled with ESP32 core)

---

## 4. Configuration & Flashing

1. Copy `config.h.example` to `config.h`:
   ```bash
   cp config.h.example config.h
   ```
2. Update the credentials in `config.h`:
   - `WIFI_SSID` and `WIFI_PASSWORD`
   - `API_HOST`: Development IP (e.g., `192.168.1.100`) or production domain (`api.smartlab.klu.ac.in`)
   - `API_PORT`: `3000` for development or `443` for production
   - `DEVICE_TOKEN`: Must strictly match `DEVICE_TOKEN` in `server/.env`
3. Select your board: **Tools > Board > ESP32 Arduino > ESP32 Dev Module**.
4. Select the COM port under **Tools > Port**.
5. Click **Upload**.
6. Open **Tools > Serial Monitor** set to **115200 baud** to verify sensor initialization and Wi-Fi connection.

---

## 5. Security & Device Token Rotation

- The device authenticates all HTTP POST requests using the `X-Device-Token` header.
- To rotate the token:
  1. Generate a new high-entropy token: `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`
  2. Update `DEVICE_TOKEN` in `server/.env` and restart the Express server.
  3. Update `DEVICE_TOKEN` in `firmware/config.h` and flash the ESP32 device.
- For production HTTPS:
  - Set `USE_HTTPS true` in `config.h`.
  - Use `WiFiClientSecure` and load the root CA certificate of your server's SSL certificate to prevent MITM attacks.
