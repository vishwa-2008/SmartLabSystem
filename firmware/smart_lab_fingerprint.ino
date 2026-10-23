/**
 * ============================================================================
 * KARE SMART LAB EQUIPMENT MANAGEMENT SYSTEM
 * ESP32 Hardware Controller & Fingerprint Scanner Firmware
 * ============================================================================
 * Hardware Supported: ESP32 DevKit V1 (30 or 38 pin)
 * Sensor Supported: Optical/Capacitive Fingerprint Sensor (AS608, R307, R503, DY50)
 * 
 * Features:
 *  - Secure Wi-Fi connectivity with auto-reconnection
 *  - Genuine HardwareSerial UART communication with sensor (RX2=16, TX2=17)
 *  - Heartbeat telemetry dispatcher (uptime, free heap, RSSI, status)
 *  - Real-time fingerprint matching against onboard template storage
 *  - Secure HTTP POST transmission to Express API with X-Device-Token authentication
 *  - Hardware enrollment routine supporting two-stage finger verification
 *  - Acoustic and visual feedback (LED and Buzzer state signaling)
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <Adafruit_Fingerprint.h>
#include <ArduinoJson.h>

// Load configuration header (copy config.h.example -> config.h)
#if __has_include("config.h")
  #include "config.h"
#else
  #include "config.h.example"
#endif

// Hardware Serial 2 for fingerprint sensor
HardwareSerial fingerSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fingerSerial);

// Operational timing state
unsigned long lastHeartbeatTime = 0;
unsigned long lastEnrollCheckTime = 0;
bool isEnrolling = false;

// ----------------------------------------------------------------------------
// Audio and Visual Feedback Helpers
// ----------------------------------------------------------------------------
void toneFeedback(int frequency, int durationMs) {
  #if defined(BUZZER_PIN)
    tone(BUZZER_PIN, frequency, durationMs);
    delay(durationMs);
    noTone(BUZZER_PIN);
  #endif
}

void signalSuccess() {
  digitalWrite(LED_GREEN_PIN, HIGH);
  toneFeedback(2000, 100);
  delay(50);
  toneFeedback(2500, 150);
  digitalWrite(LED_GREEN_PIN, LOW);
}

void signalError() {
  digitalWrite(LED_RED_PIN, HIGH);
  toneFeedback(800, 350);
  digitalWrite(LED_RED_PIN, LOW);
}

void signalPending() {
  digitalWrite(LED_BLUE_PIN, HIGH);
  toneFeedback(1500, 80);
  digitalWrite(LED_BLUE_PIN, LOW);
}

// ----------------------------------------------------------------------------
// Wi-Fi Connection Manager
// ----------------------------------------------------------------------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println(F("[WiFi] Connecting to network..."));
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttemptTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < WIFI_TIMEOUT_MS) {
    digitalWrite(LED_BLUE_PIN, !digitalRead(LED_BLUE_PIN));
    delay(300);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_BLUE_PIN, HIGH);
    Serial.print(F("[WiFi] Connected! IP Address: "));
    Serial.println(WiFi.localIP());
  } else {
    digitalWrite(LED_BLUE_PIN, LOW);
    digitalWrite(LED_RED_PIN, HIGH);
    Serial.println(F("[WiFi] Connection failed. Will retry in loop."));
  }
}

// ----------------------------------------------------------------------------
// HTTP Dispatcher Helper
// ----------------------------------------------------------------------------
bool sendJsonPost(const String& endpoint, const JsonDocument& doc, String& responseBody) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return false;
  }

  WiFiClient client;
  HTTPClient http;

  String url = String("http://") + API_HOST + ":" + String(API_PORT) + endpoint;
  if (!http.begin(client, url)) {
    Serial.println(F("[HTTP] Failed to initialize connection"));
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.setTimeout(8000);

  String requestJson;
  serializeJson(doc, requestJson);

  int httpCode = http.POST(requestJson);
  bool success = false;

  if (httpCode > 0) {
    responseBody = http.getString();
    Serial.printf("[HTTP] POST %s -> Response code: %d\n", endpoint.c_str(), httpCode);
    if (httpCode == 200 || httpCode == 201) {
      success = true;
    }
  } else {
    Serial.printf("[HTTP] POST %s failed: %s\n", endpoint.c_str(), http.errorToString(httpCode).c_str());
  }

  http.end();
  return success;
}

// ----------------------------------------------------------------------------
// Telemetry Heartbeat
// ----------------------------------------------------------------------------
void dispatchHeartbeat() {
  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["uptimeSeconds"] = millis() / 1000;
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["rssi"] = WiFi.RSSI();
  doc["ipAddress"] = WiFi.localIP().toString();
  doc["firmwareVersion"] = "1.2.0";

  String response;
  bool ok = sendJsonPost(ENDPOINT_HEARTBEAT, doc, response);
  if (ok) {
    Serial.println(F("[Heartbeat] Heartbeat acknowledged by server."));
  }
}

// ----------------------------------------------------------------------------
// Fingerprint Enrollment Routine (2-Step Verification)
// ----------------------------------------------------------------------------
bool enrollFingerprint(uint16_t id) {
  int p = -1;
  Serial.printf("[Enrollment] Enrolling slot ID #%d\n", id);
  digitalWrite(LED_BLUE_PIN, HIGH);

  // Step 1: Wait for finger placement
  Serial.println(F("[Enrollment] Place finger on sensor..."));
  toneFeedback(1200, 100);

  unsigned long startTime = millis();
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (millis() - startTime > 15000) {
      Serial.println(F("[Enrollment] Timeout waiting for finger."));
      digitalWrite(LED_BLUE_PIN, LOW);
      return false;
    }
    delay(50);
  }

  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    Serial.println(F("[Enrollment] Image conversion error 1"));
    signalError();
    digitalWrite(LED_BLUE_PIN, LOW);
    return false;
  }

  toneFeedback(1800, 150);
  Serial.println(F("[Enrollment] Remove finger..."));
  delay(1500);

  // Ensure finger is removed
  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    p = finger.getImage();
    delay(50);
  }

  // Step 2: Place same finger again
  Serial.println(F("[Enrollment] Place the SAME finger again..."));
  toneFeedback(1200, 100);

  p = -1;
  startTime = millis();
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (millis() - startTime > 15000) {
      Serial.println(F("[Enrollment] Timeout waiting for second scan."));
      digitalWrite(LED_BLUE_PIN, LOW);
      return false;
    }
    delay(50);
  }

  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    Serial.println(F("[Enrollment] Image conversion error 2"));
    signalError();
    digitalWrite(LED_BLUE_PIN, LOW);
    return false;
  }

  // Create model
  p = finger.createModel();
  if (p != FINGERPRINT_OK) {
    Serial.println(F("[Enrollment] Fingerprints did not match."));
    signalError();
    digitalWrite(LED_BLUE_PIN, LOW);
    return false;
  }

  // Store model in flash slot
  p = finger.storeModel(id);
  if (p != FINGERPRINT_OK) {
    Serial.println(F("[Enrollment] Flash storage error"));
    signalError();
    digitalWrite(LED_BLUE_PIN, LOW);
    return false;
  }

  Serial.printf("[Enrollment] Template #%d successfully enrolled!\n", id);
  signalSuccess();
  digitalWrite(LED_BLUE_PIN, LOW);
  return true;
}

// ----------------------------------------------------------------------------
// Check for Pending Enrollment Tasks from Portal
// ----------------------------------------------------------------------------
void checkEnrollmentTask() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;
  String url = String("http://") + API_HOST + ":" + String(API_PORT) + ENDPOINT_ENROLL_TASK;

  if (http.begin(client, url)) {
    http.addHeader("X-Device-Token", DEVICE_TOKEN);
    int httpCode = http.GET();

    if (httpCode == 200) {
      String payload = http.getString();
      StaticJsonDocument<512> doc;
      DeserializationError err = deserializeJson(doc, payload);

      if (!err && doc["hasTask"] == true) {
        String sessionId = doc["sessionId"].as<String>();
        uint16_t targetId = doc["targetTemplateId"].as<uint16_t>();

        Serial.printf("[Enrollment] Received enrollment task for Session: %s, Template: %d\n", sessionId.c_str(), targetId);
        isEnrolling = true;
        bool ok = enrollFingerprint(targetId);
        isEnrolling = false;

        // Report result back to server
        StaticJsonDocument<256> resultDoc;
        resultDoc["sessionId"] = sessionId;
        resultDoc["templateId"] = targetId;
        resultDoc["status"] = ok ? "enrolled" : "failed";
        resultDoc["errorMessage"] = ok ? "" : "Biometric enrollment timeout or mismatch";

        String reportResponse;
        sendJsonPost(ENDPOINT_ENROLL_DONE, resultDoc, reportResponse);
      }
    }
    http.end();
  }
}

// ----------------------------------------------------------------------------
// Standard Fingerprint Verification Routine
// ----------------------------------------------------------------------------
void handleFingerprintScanning() {
  int p = finger.getImage();
  if (p == FINGERPRINT_NOFINGER) {
    return; // No finger placed
  }

  if (p != FINGERPRINT_OK) {
    Serial.println(F("[Scan] Sensor communication error"));
    return;
  }

  // Convert image to template
  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    Serial.println(F("[Scan] Could not extract features"));
    signalError();
    return;
  }

  // Search flash database
  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_OK) {
    Serial.printf("[Scan] Match found! Template ID: %d (Confidence: %d)\n", finger.fingerID, finger.confidence);
    signalSuccess();

    // Transmit scan event to API
    StaticJsonDocument<256> doc;
    doc["templateId"] = finger.fingerID;
    doc["confidence"] = finger.confidence;
    doc["deviceId"] = DEVICE_ID;

    String response;
    sendJsonPost(ENDPOINT_SCAN, doc, response);
  } else if (p == FINGERPRINT_NOTFOUND) {
    Serial.println(F("[Scan] Fingerprint not recognized"));
    signalError();

    // Transmit unknown scan event
    StaticJsonDocument<256> doc;
    doc["templateId"] = 999999; // Sentinel unknown ID
    doc["deviceId"] = DEVICE_ID;

    String response;
    sendJsonPost(ENDPOINT_SCAN, doc, response);
  } else {
    Serial.println(F("[Scan] Search error"));
    signalError();
  }

  // Prevent multiple fast triggers while finger remains on the glass
  delay(1000);
}

// ----------------------------------------------------------------------------
// System Setup
// ----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n========================================================"));
  Serial.println(F(" KARE SMART LAB EQUIPMENT MANAGEMENT SYSTEM"));
  Serial.println(F(" ESP32 Hardware Controller Initializing..."));
  Serial.println(F("========================================================"));

  // Initialize GPIO Pins
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(LED_BLUE_PIN, OUTPUT);
  #if defined(BUZZER_PIN)
    pinMode(BUZZER_PIN, OUTPUT);
  #endif

  digitalWrite(LED_GREEN_PIN, LOW);
  digitalWrite(LED_RED_PIN, LOW);
  digitalWrite(LED_BLUE_PIN, LOW);

  // Initialize Fingerprint Sensor Serial
  fingerSerial.begin(SENSOR_BAUDRATE, SERIAL_8N1, SENSOR_RX_PIN, SENSOR_TX_PIN);
  finger.begin(57600);

  if (finger.verifyPassword()) {
    Serial.println(F("[Sensor] AS608/R307 Fingerprint Sensor verified successfully!"));
    finger.getParameters();
    Serial.printf("[Sensor] Capacity: %d templates | Security Level: %d\n", finger.capacity, finger.security_level);
  } else {
    Serial.println(F("[Sensor] ERROR: Fingerprint sensor not detected! Check wiring."));
    digitalWrite(LED_RED_PIN, HIGH);
  }

  // Connect to Wi-Fi
  connectWiFi();

  // Send bootup heartbeat
  dispatchHeartbeat();
  toneFeedback(2200, 200);
}

// ----------------------------------------------------------------------------
// Main Operational Loop
// ----------------------------------------------------------------------------
void loop() {
  unsigned long currentMillis = millis();

  // Periodic heartbeat transmission
  if (currentMillis - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTime = currentMillis;
    dispatchHeartbeat();
  }

  // Periodic check for remote enrollment requests from portal
  if (!isEnrolling && (currentMillis - lastEnrollCheckTime >= ENROLL_CHECK_INTERVAL_MS)) {
    lastEnrollCheckTime = currentMillis;
    checkEnrollmentTask();
  }

  // Main biometric matching routine (when not in enrollment mode)
  if (!isEnrolling) {
    handleFingerprintScanning();
  }

  delay(20);
}
