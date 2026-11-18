# Frontlinien

Ein Echtzeitstrategiespiel für den Browser, das du privat mit Freunden spielst. Alle starten in der Steinzeit
auf einer zufällig erzeugten Karte. Ihr sammelt Rohstoffe, baut eure Basis aus, steuert eure Armeen selbst und
führt euer Volk durch sieben Epochen bis in die Moderne.

## Spielprinzip

- **Zufallskarten** in vier Typen: Kontinent, Seenplatte, Hochland und Urwald. Die Größe richtet sich nach der Spielerzahl.
- **Wirtschaft**: Arbeiter sammeln Nahrung (Beeren, Felder), Holz, Stein und Gold und bringen sie zum Haupthaus
  oder Lager. Häuser erhöhen die Bevölkerungsgrenze (maximal 200).
- **Sieben Epochen**: Steinzeit, Bronzezeit, Antike, Mittelalter, Renaissance, Industriezeit und Moderne. Jede Epoche
  macht die Einheiten stärker und schaltet neue Gebäude und Einheiten frei. Auch die Gebäude werden robuster.
- **Kultur und Nation**: In der Bronzezeit wählst du eine von 4 Kulturen, im Mittelalter eine von 3 Nationen
  dieser Kultur.
  - Jede Kultur bringt eigene Boni und eine Spezialeinheit mit.
  - Jede Nation gibt einen zusätzlichen Bonus.
- **Einheitenlinien**, die mit den Epochen aufsteigen:
  - Nahkampf: vom Keulenträger bis zum Soldaten
  - Fernkampf: vom Steinschleuderer bis zum MG-Schützen
  - Reiterei: vom Streitwagen bis zum Panzer
  - Belagerung: vom Katapult bis zur Artillerie
  - Ein Stein-Schere-Papier-System bestimmt den Schaden. Speere schlagen Reiter, Reiter schlagen Schützen,
    Belagerungswaffen zerstören Gebäude.
- **Gebäude**: Haupthaus, Haus, Lager, Feld, Kaserne, Schießplatz, Stall, Werkstatt, Wachturm und Palisade
  (ab dem Mittelalter Steinmauer).
- **Spielmodi**:
  - Jeder gegen jeden
  - Teams
  - Armageddon: Ab einer einstellbaren Minute schlagen Meteore bei den schwächsten Nationen ein.
- **KI-Gegner** in drei Stufen (leicht, normal, schwer). Sie bauen eine Wirtschaft auf, steigen in die nächsten
  Epochen auf, verteidigen sich und greifen an.
- **Nebel des Krieges**: Erkundete Gebiete bleiben sichtbar, gegnerische Gebäude bleiben als Erinnerung stehen.
- Lobby mit Raumcode und Einladungslink für bis zu 24 Teilnehmer, dazu Chat (mit `/t` nur ans Team),
  Wiederverbinden nach einem Neuladen der Seite, Zuschauen nach dem Ausscheiden und eine Endstatistik.

## Steuerung

| Aktion | Eingabe |
|---|---|
| Auswählen | Linksklick, Rahmen ziehen, Shift = hinzufügen, Doppelklick = alle gleichen auf dem Bildschirm |
| Befehl (bewegen, angreifen, sammeln, bauen/reparieren, Sammelpunkt) | Rechtsklick |
| Angriffsbewegung / Stopp / Löschen | A + Klick / S / Entf |
| Gebäude bauen | Arbeiter wählen → Hotkey (Q Haus, W Lager, E Feld, R Kaserne, T Schießplatz, D Stall, G Turm, V Werkstatt, C Palisade, Y Haupthaus) → platzieren. Mit Shift mehrere platzieren, Mauern durch Ziehen |
| Einheiten ausbilden | Gebäude wählen → Q (Shift+Q = 5×). Im Haupthaus ist W der Epochenaufstieg |
| Kontrollgruppen | Strg+1–9 speichern, 1–9 auswählen, zweimal drücken = Kamera hinbewegen |
| Untätiger Arbeiter / Haupthaus / letzte Warnung | . / H / Leertaste |
| Kamera | Pfeiltasten, Bildschirmrand, mittlere Maustaste, Mausrad (Zoom), Minimap |
| Nationen-Übersicht / Chat / Menü | Tab / Enter / F10 |

Auf Touchgeräten: Tippen wählt aus, Tippen mit Auswahl gibt einen Befehl, Wischen verschiebt die Kamera,
zwei Finger zoomen.

## Starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 18.

```bash
npm install
npm start
```

Danach http://localhost:3000 öffnen. Den Port änderst du mit `PORT=8080 npm start`.

## Mit Freunden spielen

1. **Im selben WLAN**: Die anderen öffnen `http://<deine-lokale-IP>:3000`.
2. **Über das Internet ohne Router-Einstellungen**: Starte zusätzlich
   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   ```
   und schicke den angezeigten `https://….trycloudflare.com`-Link herum.
3. **Dauerhaft online**: Das Spiel läuft auf jedem Node-Hoster (Render, Railway, Fly.io usw.) oder per Docker:
   ```bash
   docker build -t frontlinien .
   docker run -p 3000:3000 frontlinien
   ```

Im Spiel: **Neuen Raum erstellen** → **Einladungslink kopieren** → Freunde treten bei → Bots und
Einstellungen wählen → **Spiel starten**.

## 3D-Grafik

Der Client rendert das Spiel in 3D mit Three.js. Der Spielserver ist unverändert.

- **Gelände** entsteht aus der Serverkarte, mit überblendeten Texturen für Gras, Erde, Fels und Sand, dazu Wasser,
  Gras und Bäume.
- **Einheiten** sind vorberechnete, detaillierte Figuren mit etwa 3.000 Dreiecken. Sie haben eine Lauf-, Angriffs- und
  Zielhaltung und werden pro Typ in einem Durchgang gezeichnet (Instancing). Sie tragen Kleidung und Wappen in der
  Teamfarbe.
- **Gebäude** wachsen beim Bau aus dem Boden, ab halbem Schaden brennen sie.
- **Nebel des Krieges** wird im Shader berechnet: Unerkundetes ist dunkel, Erkundetes entsättigt.
- **Grafikqualität**: In der Browser-Konsole `localStorage.fl_quality = 'low' | 'medium' | 'high'` setzen und neu laden.

Einheiten neu erzeugen (nach Änderungen an `prototype3d/v2/humans.js`):

```bash
cd prototype3d && npm install
python3 -m http.server 8099 &
node bake.cjs
```

## Technik

- Der Server ist autoritativ und rechnet mit 10 Ticks pro Sekunde.
  - Wegfindung über Flow-Fields mit Cache: Eine Gruppe teilt sich ein Wegefeld.
  - Ein Raster beschleunigt die Abfragen, wer in der Nähe steht.
  - Eine Partie mit 16 KI-Spielern und rund 450 Einheiten braucht etwa 5 ms pro Tick.
- Jeder Spieler bekommt nur, was er sehen kann (Schutz vor Cheats durch den Nebel des Krieges), und davon nur
  die Änderungen. Reine Positionsupdates werden kompakt gesendet, das sind etwa 1–5 KB/s pro Spieler.
- Der Client zeichnet das Gelände in gecachten Chunks und interpoliert die Bewegungen weich. Der Nebel wird
  weichgezeichnet. Grafik und Sounds werden prozedural erzeugt, es gibt keine externen Assets.

```
server/index.js    HTTP- und WebSocket-Server
server/room.js     Lobby, Spielablauf, Netzwerkversand
server/world.js    Simulation: Bewegung, Wegfindung, Sammeln, Bauen, Kampf, Epochen, Sicht, Armageddon
server/mapgen.js   Zufallskarten-Generator
server/ai.js       KI-Gegner
shared/rules.js    Alle Spielwerte (Einheiten, Gebäude, Epochen, Kulturen, Kosten) – hier wird balanciert
public/            Client (index.html, style.css, js/main.js, js/render.js, js/sound.js)
```
