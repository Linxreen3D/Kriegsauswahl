# Übergabe: Weiterarbeit auf dem Windows-PC

Stand: Version 0.9.0, Branch `claude/warselection-game-rebuild-mrifwu`. Das Spiel ist inhaltlich fertig und in Simulationen stabil. Offen sind die Schritte, die einen echten Windows-PC, Steam oder Menschen brauchen.

## Einmalig einrichten
1. Git für Windows, Node.js (LTS) und die Claude-App installieren.
2. In der Eingabeaufforderung oder in Git Bash:
   ```
   git clone https://github.com/Linxreen3D/Kriegsauswahl.git
   cd Kriegsauswahl
   git checkout claude/warselection-game-rebuild-mrifwu
   npm install
   npm run desktop
   ```

## Als Nächstes zu tun (Reihenfolge)
1. **Windows-Test:** `npm run desktop` starten und eine Partie gegen Bots spielen. Fehlerprotokoll: Optionen → „Protokolle öffnen“.
2. **Windows-Paket bauen:** `npm run dist:win` erzeugt den Installer in `dist/`. `npm run dist:steam-win` erzeugt den Ordner für Steam (`dist/win-unpacked`).
3. **Steam:** Steamworks-Konto anlegen und App-Gebühr (100 $) bezahlen. Danach die App-ID in `desktop/steam.json` eintragen (dort steht noch die Test-ID 480). Errungenschaften laut `docs/STEAM.md` im Backend anlegen und Auto-Cloud einrichten.
4. **Steam-Test mit zwei PCs:** Raum erstellen → „Steam-Freunde einladen“, Beitritt, Chat, Errungenschaften.
5. **Hochladen:** steamcmd installieren und `steam/upload.sh` in Git Bash ausführen (Anleitung in `docs/STEAM.md`).
6. **Rechtliches:** A.H. als Staatsführer vor dem Release in Deutschland prüfen lassen. Plan B ist eingebaut: `FL_HIDE_AH=1`.

## Wichtige Vorgaben
- Keine NS-Symbole (Hakenkreuz, SS-Runen) – nirgends. A.H. nur als Schattenriss.
- Widmung bleibt: „In Erinnerung an Celo. Für Ljilje, Antonija und Marija.“
- Commits nur auf den Branch oben pushen.

## Wo was steht
- `README.md` – Überblick, Starten, Steuerung
- `docs/STEAM.md` – Steam-Plan, Stand, Upload, Rechtliches
- `docs/STORE.md` – Texte für die Store-Seite
- `docs/SPIELDESIGN.md` – Spieldesign
- `shared/rules.js` – alle Spielwerte (Balancing)
