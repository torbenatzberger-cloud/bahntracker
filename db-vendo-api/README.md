# DB Vendo API für BahnTracker

Eigener API-Server mit db-vendo-client für zuverlässigen Zugriff auf DB-Daten.

## Installation auf Server (152.53.123.81)

### 1. Dateien auf Server kopieren

```bash
# Vom lokalen Rechner aus:
scp -r db-vendo-api root@152.53.123.81:/opt/
```

### 2. Auf Server einrichten

```bash
ssh root@152.53.123.81

# Dependencies installieren
cd /opt/db-vendo-api
npm install

# Systemd Service einrichten
cp db-vendo-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable db-vendo-api
systemctl start db-vendo-api

# Status prüfen
systemctl status db-vendo-api
```

### 3. Testen

```bash
# Health Check
curl http://152.53.123.81:3000/health

# Departures Frankfurt Hbf
curl "http://152.53.123.81:3000/stops/8000105/departures?duration=120&results=10"
```

## Endpoints

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /health` | Health Check |
| `GET /stops/:stopId/departures` | Abfahrten einer Station |
| `GET /trips/:tripId` | Trip-Details mit Stopovers |
| `GET /locations?query=...` | Stationen suchen |

## Logs

```bash
journalctl -u db-vendo-api -f
```
