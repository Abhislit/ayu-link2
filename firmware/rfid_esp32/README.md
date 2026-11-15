# ESP32 RFID reader (AYU-LINK)

Firmware for an ESP32 + MFRC522 reader that identifies a patient by card UID and
opens an emergency case through `POST /api/rfid/scans`.

The card carries only a UID. No patient data is stored on the card; the backend
maps the UID to the patient record.

## Wiring

MFRC522 modules are 3.3 V only. Connecting one to 5 V will damage it.

| MFRC522 pin | ESP32 pin | Notes                          |
| ----------- | --------- | ------------------------------ |
| SDA / SS    | GPIO5     | SPI chip select (`SS_PIN`)     |
| SCK         | GPIO18    | SPI clock                      |
| MOSI        | GPIO23    | SPI data to reader             |
| MISO        | GPIO19    | SPI data from reader           |
| RST         | GPIO27    | Reset (`RST_PIN`)              |
| 3.3V        | 3V3       | 3.3 V supply, never 5 V        |
| GND         | GND       | Common ground                  |
| IRQ         | -         | Not used                       |

For a 16x2 LCD with an I2C backpack:

| LCD pin | ESP32 pin | Notes |
| ------- | --------- | ----- |
| GND     | GND       | Common ground |
| VCC     | 3V3       | Only if the LCD backpack supports 3.3 V |
| SDA     | GPIO21    | I2C data |
| SCL     | GPIO22    | I2C clock |

Many LCD backpacks require 5 V. ESP32 pins are not 5 V tolerant: if the
backpack needs 5 V power, use a bidirectional I2C logic-level shifter on SDA
and SCL. Do not connect 5 V I2C signals directly to the ESP32. GPIO22 is now
the LCD clock, so the MFRC522 reset wire must use GPIO27 as shown above.

## Install and flash

1. Install the Arduino IDE and the ESP32 board support.
2. Install the **MFRC522** library by *GithubCommunity*, **hd44780** by *Bill
   Perry*, and **ArduinoJson** by *Benoit Blanchon* in Library Manager.
3. Select board **ESP32 Dev Module** and the correct serial port.
4. Open `rfid_esp32.ino`, set the constants below, then upload.

## Configuration

Everything lives in `rfid_esp32.ino`. Edit the block at the top of the file:

```c
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char *API_BASE = "http://192.168.1.50:8000";
const char *DEVICE_KEY = "dev-device-key-1";
const char *UID_OVERRIDE = "";
```

Do not commit real WiFi credentials to a public repository — keep them in your
local copy of the sketch.

`API_BASE` may be `http://` on a LAN or `https://` for a deployed API. HTTPS is
verified against the pinned `ROOT_CA` in the same file — GTS Root R4, the Google
Trust Services root that signs Render's `onrender.com` certificate. The board
syncs NTP time before its first TLS call. If you deploy behind a host with a
different root CA, replace `ROOT_CA`.

## Card UIDs and the demo card

By default the firmware sends the scanned card UID as uppercase hex with no
separators (for example `A1B2C3D4`). The dev seed registers the card UID
`CARD-1001`, which is not a hex UID, so a freshly flashed board will not match it.

Pick one:

- Set `UID_OVERRIDE` to `"CARD-1001"` to send the seeded UID and exercise the
  demo patient without touching the database, or
- Register your real card: set `RfidCard.uid` for the demo patient to the hex UID
  the board prints on the serial monitor.

After a successful scan, the ESP32 receives the patient and case response from
the API. If the ambulance dashboard is open and signed in for that device's
ambulance, its live connection loads the new case. Hospital staff see it after
the crew assigns their hospital. RFID scans authenticate with `DEVICE_KEY`, not
the driver's browser login.

## Serial monitor

Open the serial monitor at **115200 baud**. The board prints:

- `AYU-LINK RFID reader ready` once setup completes,
- the assigned IP after joining WiFi, or `WiFi connection timed out`,
- `Card UID <uid>` for each scan,
- `RFID heartbeat HTTP <code>` while the reader reports its connection,
- `HTTP <code>` and a short success/error status for each request, and
- `Retrying scan` followed by one retry when the request fails.

Repeated reads of the same card within 3 seconds are ignored.
