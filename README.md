# Frontlinien

Ein Echtzeit-Strategiespiel im Browser für dich und deine Freunde: Wähle ein Startgebiet auf der Weltkarte,
schick deine Armeen los und erobere die Welt. Bots füllen leere Plätze auf.

## Features

- **295 Regionen** auf einer echten Weltkarte. Große Länder wie die USA, Russland, China, Kanada, Brasilien,
  Australien oder Indien sind in mehrere benannte Regionen aufgeteilt.
- **Land- und Seewege**: Seewege (gestrichelt) sind langsamer, Alaska ↔ Tschukotka führt über die Datumsgrenze.
- **Private Räume** mit 5-stelligem Code oder Einladungslink, bis zu 12 Teilnehmer, mit Lobby-Chat.
- **KI-Bots** in drei Stufen: leicht, normal und schwer.
- **Wirtschaft & Gebäude**: Gold aus Regionen; Fabrik (mehr Gold), Kaserne (mehr Truppen und Kapazität),
  Festung (mehr Verteidigung), jeweils 3 Stufen.
- **Spezialfähigkeiten**: Luftschlag, Mobilmachung, Luftlandung und Sabotage.
- **Hauptstädte**: Sie verteidigen besser. Wer eine Hauptstadt erobert, erbeutet die Hälfte des Goldes ihres Besitzers.
- **Diplomatie**: Bündnisse anbieten, annehmen und brechen. Verbündete können sich Truppen schicken,
  und es gibt einen eigenen Bündnis-Chat.
- **Sammelangriffe** aus mehreren Regionen gleichzeitig (mit Shift auswählen).
- **Einstellungen**: Spieltempo, Siegbedingung, Zeitlimit, Friedensphase, Starttruppen, Stärke der neutralen
  Länder und Nebel des Krieges.
- **Wiederverbinden**: Wer die Seite neu lädt oder kurz die Verbindung verliert, ist sofort wieder im Spiel.
- **Endstatistik** mit Verlaufsdiagramm, danach „Zurück zur Lobby“ für eine Revanche.
- **Läuft auf Handy, Tablet und PC**: Zoomen per Pinch oder Mausrad, mit Minimap.

### Performance

- Der Server rechnet mit 10 Ticks pro Sekunde (≈0,1 ms pro Tick) und schickt nur geänderte Regionen.
- Armeen werden einmal beim Start übertragen und danach im Browser animiert.
- Statische Inhalte und die Karte werden komprimiert ausgeliefert (Karte ≈ 90 KB).
- Die Karte wird nur bei Änderungen neu gezeichnet. Ansonsten läuft pro Frame nur eine leichte Overlay-Ebene (< 1 ms).

## Steuerung

| Aktion | Maus / Touch | Taste |
|---|---|---|
| Region auswählen | Klick / Tippen | |
| Angreifen / verlegen | Eigene Region → Ziel klicken, oder vom eigenen Gebiet aufs Ziel ziehen | |
| Mehrere Regionen auswählen | Shift + Klick | Strg+A = alle |
| Truppenanteil | Buttons oben rechts | 1–4 (25/50/75/100 %) |
| Fähigkeiten | Leiste unten | Q W E R |
| Zur Hauptstadt springen | | Leertaste |
| Ganze Welt zeigen | | F |
| Chat | | Enter |
| Abbrechen | Rechtsklick | Esc |

## Starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 18.

```bash
npm install
npm start
```

Danach http://localhost:3000 öffnen. Der Port lässt sich mit `PORT=8080 npm start` ändern.

## Mit Freunden spielen

Einer startet den Server, alle anderen öffnen den Link im Browser. Einen Account braucht niemand.

1. **Im selben WLAN**: Die anderen öffnen `http://<deine-lokale-IP>:3000`, z. B. `http://192.168.1.20:3000`.
2. **Über das Internet, ohne Router-Einstellungen**: Starte zusätzlich einen kostenlosen Tunnel, zum Beispiel
   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   ```
   Den angezeigten `https://….trycloudflare.com`-Link schickst du deinen Freunden.
   Alternativ geht auch [Tailscale](https://tailscale.com).
3. **Dauerhaft online**: Das Projekt läuft auf jedem Node-Hoster (z. B. Render, Railway, Fly.io) oder
   per Docker:
   ```bash
   docker build -t frontlinien .
   docker run -p 3000:3000 frontlinien
   ```
   Auf Render reicht ein „Web Service“ mit Build-Befehl `npm install` und Start-Befehl `npm start`.

Im Spiel: **Neuen Raum erstellen** → **Einladungslink kopieren** → Link an Freunde schicken → Bots
hinzufügen (optional) → **Spiel starten**.

## Projektstruktur

```
server/index.js    HTTP- und WebSocket-Server, Räume
server/game.js     Spiellogik (autoritativ): Produktion, Kämpfe, Fähigkeiten, Diplomatie, Sieg
server/bot.js      KI-Gegner
shared/rules.js    Regeln und Zahlenwerte (von Server und Client genutzt)
public/            Client: index.html, style.css, js/main.js (UI/Netz), js/render.js (Karte), js/sound.js
public/map.json    Vorberechnete Karte (Polygone, Nachbarschaften, Werte)
tools/build-map.mjs  Erzeugt map.json aus Natural-Earth-Daten
```

### Karte anpassen

In `tools/build-map.mjs` stehen in `SPLITS` die Aufteilungen großer Länder (Längengrad, Breitengrad, Name).
Nach einer Änderung neu erzeugen:

```bash
npm install          # inkl. Entwicklungsabhängigkeiten
npm run build:map
```

### Balancing

Alle Zahlenwerte (Produktion, Kosten, Abklingzeiten, Verteidigungsboni) stehen in `shared/rules.js`.

Kartendaten: [Natural Earth](https://www.naturalearthdata.com) (gemeinfrei) über das Paket `world-atlas`.
