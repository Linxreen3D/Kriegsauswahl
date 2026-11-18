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
