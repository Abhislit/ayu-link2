#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <hd44780.h>
#include <hd44780ioClass/hd44780_I2Cexp.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>

// --- Configuration: edit these, everything else can stay as is -------------
const char *WIFI_SSID = "DPSR";
const char *WIFI_PASSWORD = "12345678";
const char *API_BASE = "https://ayu-link.onrender.com";
const char *DEVICE_KEY = "dev-device-key-1";
const char *UID_OVERRIDE = "";

// Root CA used to verify https:// API calls: GTS Root R4 (Google Trust
// Services), which signs Render's onrender.com certificate. Valid to 2036.
// Replace it if the API moves to a host with a different root.
static const char ROOT_CA[] = R"PEM(
-----BEGIN CERTIFICATE-----
MIICCTCCAY6gAwIBAgINAgPlwGjvYxqccpBQUjAKBggqhkjOPQQDAzBHMQswCQYD
VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG
A1UEAxMLR1RTIFJvb3QgUjQwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw
WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz
IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjQwdjAQBgcqhkjOPQIBBgUrgQQAIgNi
AATzdHOnaItgrkO4NcWBMHtLSZ37wWHO5t5GvWvVYRg1rkDdc/eJkTBa6zzuhXyi
QHY7qca4R9gq55KRanPpsXI5nymfopjTX15YhmUPoYRlBtHci8nHc8iMai/lxKvR
HYqjQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBSATNbrdP9JNqPV2Py1PsVq8JQdjDAKBggqhkjOPQQDAwNpADBmAjEA6ED/g94D
9J+uHXqnLrmvT/aDHQ4thQEd0dlq7A/Cr8deVl5c1RxYIigL9zC2L7F8AjEA8GE8
p/SgguMh1YQdc4acLa/KNJvxn7kjNuK8YAOdgLOaVsjh4rsUecrNIdSUtUlD
-----END CERTIFICATE-----
)PEM";

const uint8_t SS_PIN = 5;
const uint8_t RST_PIN = 27;
const unsigned long DUPLICATE_WINDOW_MS = 3000;
const unsigned long HEARTBEAT_INTERVAL_MS = 15000;
const unsigned long WIFI_TIMEOUT_MS = 20000;

MFRC522 rfid(SS_PIN, RST_PIN);
hd44780_I2Cexp lcd;
String lastUid;
unsigned long lastUidAt = 0;
unsigned long lastHeartbeatAt = 0;
bool lcdReady = false;

// HTTPS needs a verified clock before the CA check can pass.
static WiFiClientSecure tlsClient;
static WiFiClient plainClient;
static bool tlsReady = false;

static void syncClock() {
  if (!String(API_BASE).startsWith("https://") || time(nullptr) > 1700000000) {
    return;
  }
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  for (int i = 0; i < 20 && time(nullptr) < 1700000000; i++) {
    delay(250);
  }
}

static WiFiClient &httpClient(const String &url) {
  if (!url.startsWith("https://")) {
    return plainClient;
  }
  if (!tlsReady) {
    tlsClient.setCACert(ROOT_CA);
    tlsReady = true;
  }
  return tlsClient;
}

void showLine(uint8_t row, const String &text) {
  if (!lcdReady) {
    return;
  }
  String clipped = text.substring(0, 16);
  lcd.setCursor(0, row);
  lcd.print(clipped);
  for (size_t i = clipped.length(); i < 16; i++) {
    lcd.print(' ');
  }
}

void showDisplay(const String &firstLine, const String &secondLine) {
  showLine(0, firstLine);
  showLine(1, secondLine);
}

String readUidHex() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      uid += "0";
    }
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }
  showDisplay("Connecting WiFi", "Please wait...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < WIFI_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected, IP ");
    Serial.println(WiFi.localIP());
    syncClock();
    showDisplay("WiFi connected", "Scan RFID card");
  } else {
    Serial.println("WiFi connection timed out");
    showDisplay("WiFi unavailable", "Check settings");
  }
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  HTTPClient http;
  String url = String(API_BASE) + "/api/rfid/heartbeat";
  if (!http.begin(httpClient(url), url)) {
    Serial.println("Invalid heartbeat URL");
    return;
  }
  http.setTimeout(8000);
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int code = http.POST("");
  http.end();
  Serial.print("RFID heartbeat HTTP ");
  Serial.println(code);
}

int postScan(const String &uid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi unavailable, scan not sent");
    showDisplay("WiFi unavailable", "Check connection");
    return -1;
  }
  HTTPClient http;
  String url = String(API_BASE) + "/api/rfid/scans";
  if (!http.begin(httpClient(url), url)) {
    Serial.println("Invalid API URL");
    showDisplay("Invalid API URL", "Check settings");
    return -1;
  }
  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int code = http.POST("{\"uid\":\"" + uid + "\"}");
  String response = code > 0 ? http.getString() : "";
  http.end();

  Serial.print("HTTP ");
  Serial.println(code);
  if (code >= 200 && code < 300) {
    StaticJsonDocument<1024> document;
    DeserializationError error = deserializeJson(document, response);
    if (error) {
      Serial.println("Could not read patient response");
      showDisplay("Scan received", "Invalid response");
      return code;
    }

    const char *name = document["patient"]["name"] | "Patient found";
    const char *bloodGroup = document["patient"]["blood_group"] | "";
    int age = document["patient"]["age"] | 0;
    int caseId = document["case"]["id"] | 0;
    String secondLine;
    if (age > 0) {
      secondLine = String(age) + "y";
    }
    if (bloodGroup[0] != '\0') {
      if (secondLine.length() > 0) secondLine += " ";
      secondLine += bloodGroup;
    }
    if (caseId > 0) {
      if (secondLine.length() > 0) secondLine += " ";
      secondLine += "#" + String(caseId);
    }
    if (secondLine.length() == 0) {
      secondLine = "Scan successful";
    }
    showDisplay(name, secondLine);
    Serial.println("Patient and case loaded");
  } else if (code == 401) {
    showDisplay("Device not auth", "Check device key");
  } else if (code == 404) {
    showDisplay("Card not found", "Check card UID");
  } else if (code < 0) {
    showDisplay("API unavailable", "Check WiFi / URL");
  } else {
    showDisplay("Scan failed", "HTTP " + String(code));
  }
  return code;
}

void setup() {
  Serial.begin(115200);
  delay(200);
  int lcdStatus = lcd.begin(16, 2);
  if (lcdStatus == 0) {
    lcdReady = true;
    lcd.backlight();
    showDisplay("AYU-LINK RFID", "Starting up...");
  } else {
    Serial.print("LCD initialization failed, status ");
    Serial.println(lcdStatus);
  }
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("AYU-LINK RFID reader ready");
  connectWifi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }
  if (WiFi.status() == WL_CONNECTED &&
      (lastHeartbeatAt == 0 || millis() - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS)) {
    lastHeartbeatAt = millis();
    sendHeartbeat();
  }
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }
  String uid = String(UID_OVERRIDE).length() > 0 ? String(UID_OVERRIDE) : readUidHex();
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  unsigned long now = millis();
  if (uid == lastUid && now - lastUidAt < DUPLICATE_WINDOW_MS) {
    return;
  }
  lastUid = uid;
  lastUidAt = now;
  Serial.print("Card UID ");
  Serial.println(uid);
  int code = postScan(uid);
  if (code <= 0) {
    Serial.println("Retrying scan");
    delay(500);
    postScan(uid);
  }
}
