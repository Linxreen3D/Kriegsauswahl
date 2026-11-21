# Frontlinien auf Steam – Plan

## 1. Entscheidung: Engine

**Empfehlung: bei der eigenen Web-Technik bleiben (Three.js + Node.js) und das Spiel mit Electron als Desktop-Programm ausliefern. Kein Wechsel zu Unity oder Unreal.**

| | Electron (bestehender Code) | Unity | Unreal Engine | Godot |
|---|---|---|---|---|
| Aufwand bis Steam | Wochen | Neuentwicklung, viele Monate | Neuentwicklung, viele Monate | Neuentwicklung, viele Monate |
| Bestehende Spiellogik (Server, Bots, Diplomatie, Bahn …) | bleibt unverändert | muss in C# neu geschrieben werden | muss in C++/Blueprints neu geschrieben werden | muss in GDScript/C# neu geschrieben werden |
| Blender-Modelle (`.glb`) | laufen schon | ja | ja | ja |
| Grafikqualität | gut (WebGL), für RTS-Draufsicht ausreichend | sehr gut | herausragend, aber für RTS überdimensioniert | gut |
| Viele Einheiten gleichzeitig | gut (Instancing ist schon eingebaut) | sehr gut | mittel (eher für wenige, detaillierte Figuren gebaut) | gut |
| Mehrspieler | eigener Server läuft schon | neu bauen | neu bauen | neu bauen |
| Kosten | keine | Lizenz ab einer Umsatzschwelle | Umsatzbeteiligung ab einer Umsatzschwelle | keine |
| Steam Deck / Linux | ja | ja | ja | ja |

**Warum:** Alles, was das Spiel ausmacht, ist fertig und getestet: 8 Epochen, 12 Nationen, Diplomatie, Konferenzen, Eisenbahn, See, Luft, Atomwaffen, Bots, Speichern. Ein Engine-Wechsel würde nichts davon mitnehmen, nur die Modelle.
Unreal lohnt sich für Shooter und Nahaufnahmen, nicht für eine Strategie-Draufsicht mit Hunderten Einheiten.
Unity wäre die einzige ernsthafte Alternative, aber erst, wenn die Web-Technik spürbar an Grenzen stößt (sehr große Schlachten, Spitzengrafik). Diese Entscheidung kann später fallen, wenn das Spiel schon Käufer hat.

**Bekannte Grenzen von Electron** (und was wir dagegen tun):
- Größerer Download (rund 100–150 MB Grundlast) – für Steam unkritisch.
- WebGL statt nativer Grafik – Schatten, Umgebungsverdeckung und Instancing sind schon da; Grafikstufen im Optionsmenü anbieten.
- Steam-Overlay (Umschalt+Tab) braucht in Electron eine Sonderbehandlung – früh testen.

## 2. Technische Schritte

### Phase A – Desktop-Version (ca. 2–3 Wochen)
1. **Electron-Hülle:** Ein Fenster lädt das Spiel. Der Spielserver (`server/`) läuft im selben Programm, der Gastgeber ist also selbst Server („Listen-Server“).
2. **Spielstände und Einstellungen** in den Benutzerordner verlegen statt `saves/` im Programmordner.
3. **Optionsmenü:** Grafikstufe, Auflösung und Vollbild, Lautstärke, Tastenbelegung, Sprache.
4. **Offline-fähig:** Schriften und Symbole liegen schon lokal. Nichts darf mehr aus dem Internet geladen werden.
5. **Einzelspieler-Start ohne Raumcode:** direkt gegen Bots.
6. **Builds** für Windows, Linux (Steam Deck) und optional macOS, z. B. mit electron-builder.

### Phase B – Steam-Anbindung (ca. 2–4 Wochen)
1. **Steamworks** über `steamworks.js` (Node-Anbindung für Electron).
2. **Mehrspieler über Steam:**
   - Steam-Lobbys und Freunde einladen statt Raumcode (der Raumcode bleibt für LAN).
   - Verbindung über **Steam Networking** (Steam übernimmt NAT und Relay): Freunde müssen keine Ports öffnen, und wir brauchen keine eigenen Server.
   - Vor dem Umbau prüfen, welche Steam-Netzwerkfunktionen `steamworks.js` abdeckt; sonst einen eigenen Relay-Server als Plan B.
3. **Steam Cloud** für Spielstände.
4. **Errungenschaften,** z. B. „Erste Eisenbahn“, „Frieden am Konferenztisch“, „Kalter Krieg erreicht“, „Weltwunder gehalten“.
5. **Mogeln:** Der Gastgeber rechnet alles, und Clients bekommen nur, was sie sehen dürfen (Nebel des Krieges). Damit sind Karten-Hacks schon ausgeschlossen. Zusätzliche Anti-Cheat-Software ist nicht nötig.

### Phase C – Inhalt und Feinschliff vor dem Verkauf
- **Englisch** als zweite Sprache: Steam lebt vom englischsprachigen Markt. Dafür alle Texte in eine Sprachdatei auslagern.
- **Tutorial:** eine geführte erste Partie (Steinzeit → Bronzezeit).
- **Echte Modelle** aus Blender statt Platzhalter, mindestens für Haupthaus, Häuser, Kasernen, Infanterie je Epoche.
- **Musik und Ton:** lizenzfrei oder in Auftrag; Lizenzen in `CREDITS.md` sammeln.
- **Führer-Porträts:** einheitlich gemalt, selbst erstellt oder beauftragt. A.H. bleibt Schattenriss.
- **Lange Testpartien** mit Menschen, danach Balancing.

## 3. Steam-Formalitäten

1. **Steamworks-Partnerkonto** anlegen: Firmen- oder Privatperson, Steuer- und Bankdaten, Identitätsprüfung.
2. **App-Gebühr** pro Spiel (Steam Direct, derzeit 100 US-$, wird nach ersten Umsätzen erstattet).
3. **Store-Seite** mit Kapselbildern, Screenshots, Trailer und Beschreibung. Valve prüft sie vorab.
4. **„Demnächst erhältlich“** mindestens zwei Wochen vor Veröffentlichung; in dieser Zeit Wunschlisten sammeln.
5. **Build-Prüfung** durch Valve vor dem Start.
6. **Steam Playtest** für eine geschlossene Testphase mit Freunden, kostenlos und getrennt von der Store-Seite.
7. **Früher Zugang (Early Access)** ist empfehlenswert: Das Spiel ist groß, und Spielerrückmeldungen helfen beim Balancing.
8. **Einnahmen:** Steam behält den üblichen Anteil (30 %, bei sehr hohen Umsätzen weniger).

### Rechtliches (vor dem Release klären)
- **Inhaltsfragebogen** bei Steam ehrlich ausfüllen: Kriegsgewalt, historische Diktatoren.
- **Deutschland:** Eine Figur wie A.H. ist in Spielen nur im Rahmen der Sozialadäquanz (§ 86a StGB) zulässig. Unser Konzept hilft dabei: keine verbotenen Symbole, nur Schattenriss, militärisch-sachliche Boni. Trotzdem vor dem Release **anwaltlich oder bei der USK prüfen lassen**. Notfalls gibt es einen Plan B für die deutsche Version (Führer ausgeblendet).
- **Lizenzen:** Alle Fremdbestandteile stehen in `CREDITS.md` und müssen im Spiel sichtbar sein (CC BY bei den Symbolen).
- **Widmung** an Celo und die Familie bleibt im Haupt- und Endbildschirm.

## 4. Grober Zeitplan

| Schritt | Dauer (Richtwert) |
|---|---|
| Phase A – Desktop-Version | 2–3 Wochen |
| Phase B – Steam-Anbindung | 2–4 Wochen |
| Store-Seite „Demnächst“ online | parallel zu Phase B |
| Phase C – Englisch, Tutorial, Modelle, Ton | 1–3 Monate (je nach Modellen) |
| Steam Playtest mit Freunden | 2–4 Wochen |
| Early-Access-Start | danach |

Die Modelle aus Blender sind der größte Unsicherheitsfaktor für den Zeitplan. Technik und Steam-Anbindung sind gut planbar.
