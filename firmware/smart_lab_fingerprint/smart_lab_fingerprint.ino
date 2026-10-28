/**
 * ============================================================================
 * KARE SMART LAB EQUIPMENT MANAGEMENT SYSTEM
 * ESP32 Production Hardware Firmware: Optical Fingerprint Scanner Controller
 * ============================================================================
 * Hardware Setup (Strictly 4 Wires, No External LEDs or Buzzer Required):
 *   Sensor VCC (Red)          --> ESP32 VIN (5V)
 *   Sensor GND (Black)        --> ESP32 GND
 *   Sensor TXD (Yellow/Green) --> ESP32 GPIO 16 (RX2)
 *   Sensor RXD (White/Blue)   --> ESP32 GPIO 17 (TX2)
 * 
 * Onboard LED (GPIO 2) on the ESP32 board is used for subtle status blinks.
 * Realtime events print directly to the Serial Monitor (115200 baud).
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Adafruit_Fingerprint.h>
#include <ArduinoJson.h>

// --- Wi-Fi Credentials ---
const char* WIFI_SSID     = "POCO X6 5G";
const char* WIFI_PASSWORD = "1234567890";

// --- Cloud Backend Configuration ---
const char* BASE_URL     = "https://smartlabsystem-main.onrender.com";
const char* DEVICE_TOKEN = "1007d4fe45634146fd958879620e997ad95b72e62a1032bb8cf73d7687f25abc";
const char* DEVICE_ID    = "esp32-lab-01";

// --- Fingerprint Sensor Pins (HardwareSerial 2) ---
#define SENSOR_RX_PIN   16   // ESP32 RX2 connects to Sensor TX
#define SENSOR_TX_PIN   17   // ESP32 TX2 connects to Sensor RX

// Optional Built-in LED on ESP32 DevKit board (No external components needed)
#define ONBOARD_LED     2

// --- Operational Timers ---
const unsigned long HEARTBEAT_INTERVAL_MS   = 30000; // Heartbeat every 30s
const unsigned long WIFI_RETRY_INTERVAL_MS   = 10000; // Retry WiFi every 10s

unsigned long lastHeartbeatTime = 0;
unsigned long lastWiFiRetryTime = 0;
bool sensorDetected = false;

// Hardware Serial 2 for fingerprint sensor
HardwareSerial fingerSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fingerSerial);

// ----------------------------------------------------------------------------
// Simple Status Blink using ESP32 Onboard LED
// ----------------------------------------------------------------------------
void blinkOnboardLed(int times, int durationMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(ONBOARD_LED, HIGH);
    delay(durationMs);
    digitalWrite(ONBOARD_LED, LOW);
    if (i < times - 1) delay(durationMs);
  }
}

// ----------------------------------------------------------------------------
// Wi-Fi Connection Manager
// ----------------------------------------------------------------------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println();
  Serial.print("[WiFi] Connecting to: ");
  Serial.println(WIFI_SSID);

  WiFi.disconnect(true);
  delay(200);
  WiFi.mode(WIFI_STA);
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    digitalWrite(ONBOARD_LED, !digitalRead(ONBOARD_LED));
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(ONBOARD_LED, HIGH);
    Serial.println("[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("[WiFi] Signal (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    digitalWrite(ONBOARD_LED, LOW);
    Serial.println("[WiFi] ERROR: Connection failed or timed out.");
    Serial.println("[WiFi] IMPORTANT: Ensure hotspot is 2.4 GHz band (ESP32 does NOT support 5 GHz)!");
  }
}

// ----------------------------------------------------------------------------
// HTTPS POST Dispatcher
// ----------------------------------------------------------------------------
bool sendHttpsPost(const String& path, const String& jsonBody, String& responseOut) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return false;
  }

  WiFiClientSecure client;
  client.setInsecure(); // Cloud TLS connection

  HTTPClient http;
  String fullUrl = String(BASE_URL) + path;

  if (!http.begin(client, fullUrl)) {
    Serial.println("[HTTP] ERROR: Failed to begin HTTPS request.");
    return false;
  }

  http.setTimeout(10000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);

  int statusCode = http.POST(jsonBody);
  bool ok = false;

  if (statusCode > 0) {
    responseOut = http.getString();
    if (statusCode >= 200 && statusCode < 300) {
      ok = true;
    } else {
      Serial.printf("[HTTP] POST %s -> Status: %d\n", path.c_str(), statusCode);
      Serial.printf("[HTTP] Response: %s\n", responseOut.c_str());
    }
  } else {
    Serial.printf("[HTTP] POST %s -> Failed: %s\n", path.c_str(), http.errorToString(statusCode).c_str());
  }

  http.end();
  return ok;
}

// ----------------------------------------------------------------------------
// 1. Telemetry Heartbeat (Keeps ESP32 "Online" on Web Dashboard)
// ----------------------------------------------------------------------------
void dispatchHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  String body = "{\"deviceId\":\"" + String(DEVICE_ID) + "\","
                + "\"uptimeSeconds\":" + String(millis() / 1000) + ","
                + "\"freeHeap\":" + String(ESP.getFreeHeap()) + ","
                + "\"rssi\":" + String(WiFi.RSSI()) + ","
                + "\"ipAddress\":\"" + WiFi.localIP().toString() + "\","
                + "\"firmwareVersion\":\"1.3.0\"}";

  String response;
  if (sendHttpsPost("/api/device/heartbeat", body, response)) {
    Serial.println("[Heartbeat] Heartbeat acknowledged -> Website Status: ONLINE");
  }
}

// ----------------------------------------------------------------------------
// 2. Transmit Scan Event (Matches Student in Web Portal)
// ----------------------------------------------------------------------------
bool sendScanEvent(int templateId, int confidence) {
  String body = "{\"templateId\":" + String(templateId) + ","
                + "\"confidence\":" + String(confidence) + ","
                + "\"deviceId\":\"" + String(DEVICE_ID) + "\"}";

  Serial.printf("\n>>> [Scan] Transmitting Scan Event -> Template ID: %d (Confidence: %d) <<<\n", templateId, confidence);

  String response;
  bool ok = sendHttpsPost("/api/scan-event", body, response);
  if (ok) {
    Serial.println("[Scan] Match processed by cloud server!");
    Serial.println("[Scan] Server response: " + response);
    blinkOnboardLed(2, 80);
  } else {
    Serial.println("[Scan] Server failed to record scan.");
  }
  return ok;
}

// ----------------------------------------------------------------------------
// 3. Hardware Fingerprint Scanning
// ----------------------------------------------------------------------------
void handleFingerprintScanning() {
  if (!sensorDetected) return;

  int p = finger.getImage();
  if (p == FINGERPRINT_NOFINGER) return; // No finger placed

  if (p != FINGERPRINT_OK) {
    Serial.println("[Scan] Sensor read error.");
    return;
  }

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    Serial.println("[Scan] Could not extract fingerprint features.");
    return;
  }

  // Search local sensor database (1:N matching)
  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_OK) {
    Serial.printf("\n[Scan] Match Found! Template ID: #%d (Confidence: %d)\n", finger.fingerID, finger.confidence);
    sendScanEvent(finger.fingerID, finger.confidence);
  } else if (p == FINGERPRINT_NOTFOUND) {
    Serial.println("\n[Scan] Fingerprint not recognized (Unregistered student).");
    sendScanEvent(0, 0); // Sentinel ID 0 for unrecognized student scan
  } else {
    Serial.println("[Scan] Sensor search error.");
  }

  delay(1500); // Debounce delay
}

// ----------------------------------------------------------------------------
// 4. Serial Monitor Input (Keyboard Simulation Test)
// ----------------------------------------------------------------------------
void handleSerialInput() {
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.length() > 0) {
      bool valid = true;
      for (unsigned int i = 0; i < input.length(); i++) {
        if (!isDigit(input[i])) {
          valid = false;
          break;
        }
      }

      if (valid) {
        long value = input.toInt();
        if (value >= 0 && value <= 1000) {
          Serial.printf("\n[Serial Test] Simulating scan for Template ID: %ld\n", value);
          sendScanEvent((int)value, 100);
        } else {
          Serial.println("Enter a Template ID between 0 and 1000.");
        }
      } else {
        Serial.println("Please enter numeric template ID digits only.");
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Setup
// ----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(ONBOARD_LED, OUTPUT);
  digitalWrite(ONBOARD_LED, LOW);

  Serial.println("\n========================================================");
  Serial.println(" KARE SMART LAB EQUIPMENT MANAGEMENT SYSTEM");
  Serial.println(" ESP32 Controller & Fingerprint Scanner (Production v1.3.0)");
  Serial.println("========================================================");

  // Initialize Fingerprint Sensor on Serial2 (RX=16, TX=17)
  fingerSerial.begin(57600, SERIAL_8N1, SENSOR_RX_PIN, SENSOR_TX_PIN);
  finger.begin(57600);

  if (finger.verifyPassword()) {
    sensorDetected = true;
    Serial.println("[Sensor] Fingerprint Sensor verified & ready!");
    finger.getParameters();
    Serial.printf("[Sensor] Capacity: %d templates | Security Level: %d\n", finger.capacity, finger.security_level);
  } else {
    sensorDetected = false;
    Serial.println("[Sensor] WARNING: Fingerprint sensor NOT detected!");
    Serial.println("[Sensor] Verify 4 physical connections:");
    Serial.println("         Sensor VCC (Red)          -> ESP32 VIN (5V)");
    Serial.println("         Sensor GND (Black)        -> ESP32 GND");
    Serial.println("         Sensor TXD (Yellow/Green) -> ESP32 GPIO 16 (RX2)");
    Serial.println("         Sensor RXD (White/Blue)   -> ESP32 GPIO 17 (TX2)");
    Serial.println("[Sensor] (You can test scans by typing template ID in Serial Monitor)");
  }

  // Connect to Wi-Fi
  connectWiFi();

  // Send initial bootup heartbeat
  dispatchHeartbeat();

  Serial.println("\n[Ready] System is active and listening!");
  Serial.println("[Ready] Place finger on sensor to scan, OR type a template number in Serial Monitor.\n");
}

// ----------------------------------------------------------------------------
// Main Operational Loop
// ----------------------------------------------------------------------------
void loop() {
  unsigned long currentMillis = millis();

  // 1. Maintain Wi-Fi connection
  if (WiFi.status() != WL_CONNECTED) {
    if (currentMillis - lastWiFiRetryTime >= WIFI_RETRY_INTERVAL_MS) {
      lastWiFiRetryTime = currentMillis;
      connectWiFi();
    }
  }

  // 2. Periodic Heartbeat (Every 30s) -> Keeps ESP32 "Online" on Website
  if (currentMillis - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTime = currentMillis;
    dispatchHeartbeat();
  }

  // 3. Fast Fingerprint Scanning Loop
  handleFingerprintScanning();

  // 4. Serial Monitor keyboard input for manual simulation
  handleSerialInput();

  delay(20);
}
