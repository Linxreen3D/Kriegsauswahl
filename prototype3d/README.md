# 3D-Prototyp (Low-Poly-Look)

Prozedural erzeugte Low-Poly-Szenen mit Three.js. Sie dienen als Stilvorlage für die 3D-Version.
Die gerenderten Bilder liegen in `docs/preview/`.

```bash
cd prototype3d
npm install
python3 -m http.server 8099
# im Browser: http://localhost:8099/index.html?scene=stone   (stone | medieval | modern | eras | hud)
```

- `assets.js` – Modelle: Gelände-Deko, Bäume, Minen, Gebäude je Epoche, Einheiten, Effekte
- `scenes.js` – Szenen, Licht, Schatten, Ambient Occlusion, Bloom

## v2 – detaillierter, halbrealistischer Stil (aktuell)

`v2/` ersetzt den Low-Poly-Look: prozedurale Texturen (Gras, Erde, Fels, Mauerwerk, Ziegel, Stroh, Holz, Putz),
Gelände mit Textur-Überblendung, spiegelndes Wasser, physikalischer Himmel, instanzierte Bäume/Gras/Büsche,
detaillierte Gebäude und Einheiten, Feuer/Rauch, Ambient Occlusion, Bloom und Farbkorrektur, dazu ein UI-Entwurf
mit aus 3D-Modellen gerenderten Symbolen und echter Minimap.

http://localhost:8099/v2/index.html?scene=siege&ui=1   (siege | village | eastern, `ui=1` blendet die Oberfläche ein)
