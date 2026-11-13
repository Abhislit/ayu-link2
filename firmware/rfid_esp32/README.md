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
| RST         | GPIO22    | Reset (`RST_PIN`)              |
| 3.3V        | 3V3       | 3.3 V supply, never 5 V        |
| GND         | GND       | Common ground                  |
| IRQ         | -         | Not used                       |

## Install and flash

1. Install the Arduino IDE and the ESP32 board support.
2. Install the **MFRC522** library by *GithubCommunity* (Library Manager).
3. Select board **ESP32 Dev Module** and the correct serial port.
4. Open `rfid_esp32.ino`, set the constants below, then upload.

## Configuration

Edit the constants at the top of `rfid_esp32.ino`:

| Constant        | Meaning                                                              |
| --------------- | -------------------------------------------------------------------- |
| `WIFI_SSID`     | WiFi network name the ESP32 joins                                    |
| `WIFI_PASSWORD` | WiFi password                                                        |
| `API_BASE`      | Backend base URL reachable from the ESP32, e.g. `http://192.168.1.50:8000` |
| `DEVICE_KEY`    | The ambulance's `device_key` (dev seed: `dev-device-key-1`)          |
| `UID_OVERRIDE`  | Optional literal UID to send instead of the scanned card UID         |

Use the laptop's LAN IPv4 address, not `localhost` — `localhost` on the ESP32
is the ESP32. Start the API listening on the network with
`--host 0.0.0.0` (the AYU-LINK VS Code task does this), and allow inbound port
8000 on the computer's private-network firewall if prompted. The ESP32 must
connect to a 2.4 GHz Wi-Fi network; it cannot connect to 5 GHz Wi-Fi.
Keep the API and ESP32 on the same trusted LAN, and do not expose this
development API to the public internet.

`DEVICE_KEY` must match an active ambulance's `device_key`; the backend rejects
missing or unknown keys with 401.

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
- `HTTP <code>` and the response body for each request, and
- `Retrying scan` followed by one retry when the request fails.

Repeated reads of the same card within 3 seconds are ignored.
