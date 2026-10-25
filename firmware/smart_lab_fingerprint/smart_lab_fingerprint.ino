#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "POCO X6 5G";
const char* WIFI_PASSWORD = "1234567890";

const char* API_URL =
  "https://smartlabsystem-main.onrender.com/api/scan-event";

const char* DEVICE_TOKEN =
  "1007d4fe45634146fd958879620e997ad95b72e62a1032bb8cf73d7687f25abc";

bool sendTestScan(int templateId) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("ERROR: Wi-Fi is disconnected.");
    return false;
  }

  WiFiClientSecure client;

  // Testing only. Replace with trusted CA certificate
  // validation before real student data is used.
  client.setInsecure();

  HTTPClient http;

  if (!http.begin(client, API_URL)) {
    Serial.println("ERROR: Could not start HTTPS request.");
    return false;
  }

  http.setTimeout(10000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);

  String body = "{\"templateId\":" + String(templateId) + "}";

  int statusCode = http.POST(body);

  Serial.print("HTTP status: ");
  Serial.println(statusCode);

  String response = http.getString();
  Serial.println("Server response:");
  Serial.println(response);

  http.end();

  return statusCode >= 200 && statusCode < 300;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");

  unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - start < 30000) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi connected.");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("ERROR: Wi-Fi connection timed out.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("Smart Lab Cloud Connection Test");

  connectWiFi();

  Serial.println();
  Serial.println("Type a test template ID, such as 1,");
  Serial.println("then press Enter in Serial Monitor.");
  Serial.println("This is a test event, not a fingerprint scan.");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi lost. Reconnecting...");
    connectWiFi();
  }

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

      if (!valid) {
        Serial.println("Enter digits only.");
        return;
      }

      long value = input.toInt();

      if (value < 1 || value > 1000000) {
        Serial.println("Template ID must be between 1 and 1000000.");
        return;
      }

      sendTestScan((int)value);
    }
  }

  delay(10);
}
