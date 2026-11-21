# Frontlinien

Echtzeitstrategie von der Steinzeit bis zum Kalten Krieg – mit Freunden oder gegen Bots.
Alle starten in der Steinzeit auf einer zufällig erzeugten Karte und führen ihr Volk durch acht Epochen.

**In Erinnerung an Celo. Für Ljilje, Antonija und Marija.**

## Spielinhalt

- **8 Epochen**: Steinzeit, Bronzezeit, Eisenzeit, Frühes und Spätes Mittelalter, 1. und 2. Industrielle Revolution (mit zweiter Stufe „Moderne Kriegsführung“), Kalter Krieg.
- **4 Kulturen, 12 Nationen** mit Boni, eigenem Baustil, eigenem Weltwunder und rund 90 historischen Nationaleinheiten.
- **52 Staatsführer** (Epochen VII und VIII) mit zwei Dauerboni und einer Fähigkeit.
- **Diplomatie**: Botschafter, privater Chat, Verträge (Rohstoffe, Provinzen, Truppen, Tribute, Bündnisse, Pakte), Ansehen, Spionage, Ereignisse, Chronik.
- **Friedenskonferenz** mit Pause, Galerie, Vermittler, Garantien, Sanktionen, entmilitarisierter Zone und Abrüstung.
- **Eisenbahn** (Truppen-, Güter- und Panzerzüge, Eisenbahngeschütze), **Seekrieg** (Fischerei, Transporter, Kriegsschiffe, U-Boote, Landungen), **Luftkrieg** (Jäger, Bomber, Hubschrauber, Fallschirmjäger, Flak).
- **Atomwaffen** nur für historische Atommächte, mit Raketenabwehr, Bunkern, Aufklärung und Zweitschlag.
- **Gelände und Klima**: Hügel, Wald, Flüsse und Furten, Brücken, Straßen, Jahreszeiten, Provinzen, Nachschub und Moral, Veteranenränge, Formationen.
- **Kartentypen**: Kontinent, Seenplatte, Hochland, Urwald, Inseln. **Spielmodi**: Jeder gegen jeden, Teams, Armageddon.
- **Bots** in drei Stufen. Sie nutzen Wirtschaft, Eisenbahn, Flotten mit Landungen, Luftwaffe, Führer und Konferenzen.
- **Tutorial**, **Spielhandbuch** (F1), **Speichern/Fortsetzen**, **Bot-Vertretung** bei Verbindungsabbruch, **Deutsch und Englisch**.

Planung und Hintergrund: [`docs/SPIELDESIGN.md`](docs/SPIELDESIGN.md) · Steam-Release: [`docs/STEAM.md`](docs/STEAM.md) · Store-Texte: [`docs/STORE.md`](docs/STORE.md)

## Starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 18.

```bash
npm install
npm run desktop     # als Desktop-Programm (Electron), mit eingebautem Server
npm start           # oder als Webserver: http://localhost:3000 (Port mit PORT=8080 ändern)
```

**Desktop-Pakete:**
- `npm run dist:linux` erzeugt ein AppImage.
- `npm run dist:win` erzeugt einen Windows-Installer; das geht nur unter Windows.
- Alternativ: GitHub → Actions → „Desktop-Build“ (liefert auch die Ordner für den Steam-Upload).
- Hochladen zu Steam: `steam/upload.sh`, siehe [`docs/STEAM.md`](docs/STEAM.md).

## Mit Freunden spielen

- **Steam** (Desktop-Programm mit laufendem Steam): Raum erstellen und „Steam-Freunde einladen“ wählen. Freunde nehmen die Einladung im Overlay an, die Verbindung läuft über Steam.
- **LAN** (Desktop-Programm): Freunde geben deine IP-Adresse im Startbildschirm ein, dann den Raumcode.
- **Browser**: Die anderen öffnen `http://<deine-IP>:3000`.
  - Über das Internet ohne Router-Einstellungen: `npx cloudflared tunnel --url http://localhost:3000` starten und den Link weitergeben.
  - Dauerhaft online geht es mit jedem Node-Hoster oder per Docker: `docker build -t frontlinien . && docker run -p 3000:3000 frontlinien`.

## Steuerung

| Aktion | Eingabe |
|---|---|
| Auswählen | Linksklick, Rahmen ziehen, Shift = hinzufügen, Doppelklick = alle gleichen auf dem Bildschirm |
| Befehl (bewegen, angreifen, sammeln, bauen, Sammelpunkt) | Rechtsklick |
| Befehlsleiste | Q W E R T / A S D F G / Y X C V B (Plätze von links oben) |
| Angriffsbewegung / Stopp / Löschen | A + Klick / S / Entf |
| Kontrollgruppen | Strg+1–9 speichern, 1–9 wählen, zweimal = hinspringen |
| Untätiger Arbeiter / Haupthaus / letzte Warnung | . / H / Leertaste |
| Diplomatie / Führer-Fähigkeit / Nationen / Chat / Menü / Handbuch | P / L / Tab / Enter / F10 / F1 |
| Kamera | Pfeiltasten, Bildschirmrand, mittlere Maustaste, Mausrad, Minimap |

Alle Tasten lassen sich unter **Optionen → Tastenbelegung** ändern.

## Technik

- Der Server ist autoritativ (10 Ticks pro Sekunde) mit Flow-Field-Wegfindung. Jeder Spieler bekommt nur, was er sehen kann; so sind Karten-Hacks ausgeschlossen.
- Der Client zeichnet in 3D mit Three.js (Instancing, Schatten, Nebel des Krieges im Shader). Blender-Modelle (`.glb`) in `public/assets/models/` ersetzen die Platzhalter automatisch.
- Symbole kommen von game-icons.net und Lucide. Die Schriften liegen lokal, so läuft alles offline.

```
server/       Spielserver: world.js (Simulation), room.js (Lobby/Netzwerk), ai.js (Bots), mapgen.js,
              diplomacy.js, conference.js, leaders.js, rail.js, naval.js, air.js, nukes.js, celo.js
shared/       rules.js – alle Spielwerte (hier wird balanciert)
public/       Client: index.html, style.css, js/ (main, render3d, diplomacy, conference, tutorial, i18n, music …)
desktop/      Electron-Programm, Steam-Anbindung (steam.mjs) und Relais (relay.mjs)
tools/        build-ui-assets.mjs (Symbole/Schriften), i18n-extract.mjs / i18n-merge.mjs (Übersetzung)
docs/         Spieldesign, Steam-Plan, Store-Texte, Blender-Anleitung
```

Lizenzen fremder Bestandteile: [`CREDITS.md`](CREDITS.md)
