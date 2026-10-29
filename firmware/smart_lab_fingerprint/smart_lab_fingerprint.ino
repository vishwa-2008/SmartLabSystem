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
const char* WIFI_SSID     = "VISHWA";
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
const unsigned long HEARTBEAT_INTERVAL_MS         = 30000; // Heartbeat every 30s
const unsigned long WIFI_RETRY_INTERVAL_MS        = 10000; // Retry WiFi every 10s
const unsigned long ENROLL_TASK_CHECK_INTERVAL_MS = 5000;  // Check web enrollment task every 5s

unsigned long lastHeartbeatTime       = 0;
unsigned long lastWiFiRetryTime       = 0;
unsigned long lastEnrollTaskCheckTime = 0;
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
// HTTPS GET Dispatcher (for polling enrollment tasks)
// ----------------------------------------------------------------------------
bool sendHttpsGet(const String& path, String& responseOut) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String fullUrl = String(BASE_URL) + path;

  if (!http.begin(client, fullUrl)) {
    return false;
  }

  http.setTimeout(8000);
  http.addHeader("X-Device-Token", DEVICE_TOKEN);

  int statusCode = http.GET();
  bool ok = false;

  if (statusCode >= 200 && statusCode < 300) {
    responseOut = http.getString();
    ok = true;
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
                + "\"firmwareVersion\":\"2.0.0\"}";

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

  if (templateId > 0) {
    Serial.printf("\n>>> [Scan] Transmitting Scan Event -> Template ID: %d (Confidence: %d) <<<\n", templateId, confidence);
  } else {
    Serial.println("\n>>> [Scan] Transmitting Unrecognized Fingerprint Event <<<");
  }

  String response;
  bool ok = sendHttpsPost("/api/scan-event", body, response);
  if (ok) {
    Serial.println("[Scan] Match processed by cloud server!");
    Serial.println("[Scan] Server response: " + response);

    // Parse the JSON response to give clear feedback
    StaticJsonDocument<1024> doc;
    DeserializationError err = deserializeJson(doc, response);
    if (!err) {
      bool success = doc["success"] | false;
      const char* status = doc["event"]["status"] | "unknown";
      
      if (success && String(status) == "matched") {
        const char* studentName = doc["student"]["full_name"] | "";
        const char* regNumber   = doc["student"]["reg_number"] | "";
        const char* dept        = doc["student"]["department"] | "";
        Serial.println("================================================================");
        Serial.println("[Scan] *** STUDENT IDENTIFIED ***");
        Serial.printf ("[Scan] Name      : %s\n", studentName);
        Serial.printf ("[Scan] Reg No    : %s\n", regNumber);
        Serial.printf ("[Scan] Department: %s\n", dept);
        Serial.println("[Scan] Portal is now displaying student details for equipment issue.");
        Serial.println("================================================================");
        blinkOnboardLed(3, 100); // 3 quick blinks = success
      } else if (String(status) == "not_found") {
        int tplId = doc["event"]["template_id"] | templateId;
        if (tplId > 0) {
          Serial.println("================================================================");
          Serial.printf ("[Scan] WARNING: Template #%d recognized by sensor but NOT linked\n", tplId);
          Serial.println("[Scan] to any student in the database!");
          Serial.println("[Scan] ACTION REQUIRED: Go to Students page -> click fingerprint");
          Serial.printf ("[Scan] icon -> enter Slot #%d to link this fingerprint.\n", tplId);
          Serial.println("================================================================");
        } else {
          Serial.println("[Scan] Unrecognized finger — not enrolled in sensor database.");
        }
        blinkOnboardLed(1, 500); // 1 long blink = not found
      }
    }
  } else {
    Serial.println("[Scan] ERROR: Server failed to record scan. Check network/token.");
    blinkOnboardLed(2, 250);
  }
  return ok;
}

// ----------------------------------------------------------------------------
// 3. Hardware Fingerprint Scanning (1:N match on sensor flash)
// ----------------------------------------------------------------------------
void handleFingerprintScanning() {
  if (!sensorDetected) return;

  int p = finger.getImage();
  if (p == FINGERPRINT_NOFINGER) return;

  if (p != FINGERPRINT_OK) {
    Serial.println("[Scan] Sensor read error.");
    return;
  }

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    Serial.println("[Scan] Could not extract fingerprint features.");
    return;
  }

  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_OK) {
    Serial.printf("\n[Scan] Match Found! Template ID: #%d (Confidence: %d)\n", finger.fingerID, finger.confidence);
    sendScanEvent(finger.fingerID, finger.confidence);
  } else if (p == FINGERPRINT_NOTFOUND) {
    Serial.println("\n[Scan] Fingerprint NOT recognized — student is not enrolled on this sensor.");
    Serial.println("[Scan] Ask the student to enroll via the Lab Portal first.");
    // Send 0 so server logs it as unrecognized (server now accepts templateId=0)
    sendScanEvent(0, 0);
  } else {
    Serial.println("[Scan] Sensor search error.");
  }

  delay(1500);
}

// ----------------------------------------------------------------------------
// 4. Web-Initiated Fingerprint Enrollment
//    Lab In-charge triggers enrollment from the website.
//    ESP32 polls for tasks, guides the user through 2-touch enrollment,
//    stores the template on the sensor, and reports back to the server.
// ----------------------------------------------------------------------------
bool enrollFingerprint(int slotId) {
  if (!sensorDetected) {
    Serial.println("[Enroll] ERROR: Sensor not detected, cannot enroll.");
    return false;
  }

  Serial.printf("\n[Enroll] ============ ENROLLING SLOT #%d ============\n", slotId);
  Serial.println("[Enroll] Place the student's finger on the sensor...");
  blinkOnboardLed(3, 150);

  // --- First touch: capture image into CharBuffer 1 ---
  int p = -1;
  unsigned long startWait = millis();
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (p == FINGERPRINT_OK) {
      Serial.println("[Enroll] First image captured successfully.");
    } else if (p == FINGERPRINT_NOFINGER) {
      // Keep waiting, but timeout after 30 seconds
      if (millis() - startWait > 30000) {
        Serial.println("[Enroll] TIMEOUT: No finger detected after 30s. Aborting.");
        return false;
      }
      delay(100);
    } else {
      Serial.println("[Enroll] First image capture error.");
      return false;
    }
  }

  p = finger.image2Tz(1); // Store features in CharBuffer 1
  if (p != FINGERPRINT_OK) {
    Serial.println("[Enroll] Failed to extract features from first image.");
    return false;
  }

  Serial.println("[Enroll] Remove finger from sensor...");
  blinkOnboardLed(1, 300);
  delay(1500);

  // Wait for finger to be removed
  while (finger.getImage() != FINGERPRINT_NOFINGER) {
    delay(100);
  }

  // --- Second touch: capture image into CharBuffer 2 ---
  Serial.println("[Enroll] Place the SAME finger again...");
  blinkOnboardLed(3, 150);

  p = -1;
  startWait = millis();
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (p == FINGERPRINT_OK) {
      Serial.println("[Enroll] Second image captured successfully.");
    } else if (p == FINGERPRINT_NOFINGER) {
      if (millis() - startWait > 30000) {
        Serial.println("[Enroll] TIMEOUT: No finger detected for second touch. Aborting.");
        return false;
      }
      delay(100);
    } else {
      Serial.println("[Enroll] Second image capture error.");
      return false;
    }
  }

  p = finger.image2Tz(2); // Store features in CharBuffer 2
  if (p != FINGERPRINT_OK) {
    Serial.println("[Enroll] Failed to extract features from second image.");
    return false;
  }

  // --- Create model from both buffers ---
  p = finger.createModel();
  if (p != FINGERPRINT_OK) {
    Serial.println("[Enroll] Fingerprints did not match. Please try again.");
    return false;
  }
  Serial.println("[Enroll] Fingerprint model created successfully!");

  // --- Store the model in the sensor's flash at the target slot ---
  p = finger.storeModel(slotId);
  if (p != FINGERPRINT_OK) {
    Serial.printf("[Enroll] Failed to store model at slot #%d (error %d).\n", slotId, p);
    return false;
  }

  Serial.printf("[Enroll] *** SUCCESS! Template stored at Slot #%d ***\n", slotId);
  blinkOnboardLed(5, 80);
  return true;
}

void reportEnrollmentComplete(const String& sessionId, int templateId, bool success, const String& errorMsg) {
  String body = "{\"sessionId\":\"" + sessionId + "\","
                + "\"templateId\":" + String(templateId) + ","
                + "\"status\":\"" + (success ? "enrolled" : "failed") + "\"";
  if (!success && errorMsg.length() > 0) {
    body += ",\"errorMessage\":\"" + errorMsg + "\"";
  }
  body += "}";

  String response;
  sendHttpsPost("/api/device/enrollment-complete", body, response);
  Serial.println("[Enroll] Enrollment result reported to server.");
}

void checkAndRunEnrollmentTask() {
  if (WiFi.status() != WL_CONNECTED) return;

  String response;
  if (!sendHttpsGet("/api/device/enrollment-task", response)) return;

  // Minimal JSON parsing using ArduinoJson
  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, response);
  if (err) return;

  bool hasTask = doc["hasTask"] | false;
  if (!hasTask) return;

  const char* sessionId = doc["sessionId"] | "";
  int targetTemplateId  = doc["targetTemplateId"] | 0;

  if (targetTemplateId < 1 || strlen(sessionId) == 0) return;

  Serial.println("\n================================================================");
  Serial.printf("[Enroll] ** WEB ENROLLMENT REQUEST RECEIVED **\n");
  Serial.printf("[Enroll] Session: %s\n", sessionId);
  Serial.printf("[Enroll] Target Slot: #%d\n", targetTemplateId);
  Serial.println("================================================================");

  bool success = enrollFingerprint(targetTemplateId);

  reportEnrollmentComplete(
    String(sessionId),
    targetTemplateId,
    success,
    success ? "" : "Enrollment failed on device"
  );
}

// ----------------------------------------------------------------------------
// 5. Serial Monitor Input (Keyboard Simulation Test)
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
  Serial.println(" ESP32 Controller & Fingerprint Scanner (Production v2.0.0)");
  Serial.println(" Web-Initiated Enrollment + Scan Verification");
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
  Serial.println("[Ready] Place finger on sensor to scan, OR type a template number in Serial Monitor.");
  Serial.println("[Ready] Web-initiated enrollment is ENABLED — the website can trigger enrollment.\n");
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

  // 3. Check for web-initiated enrollment tasks (Every 5s)
  if (currentMillis - lastEnrollTaskCheckTime >= ENROLL_TASK_CHECK_INTERVAL_MS) {
    lastEnrollTaskCheckTime = currentMillis;
    checkAndRunEnrollmentTask();
  }

  // 4. Fast Fingerprint Scanning Loop
  handleFingerprintScanning();

  // 5. Serial Monitor keyboard input for manual simulation
  handleSerialInput();

  delay(20);
}
