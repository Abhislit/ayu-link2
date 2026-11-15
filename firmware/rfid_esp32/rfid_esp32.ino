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
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char *API_BASE = "http://192.168.1.50:8000";
const char *DEVICE_KEY = "dev-device-key-1";
const char *UID_OVERRIDE = "";

// Root CA used to verify https:// API calls: ISRG Root X1 (Let's Encrypt).
// Only needed when API_BASE starts with https://.
static const char ROOT_CA[] = R"PEM(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
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
