# Mitwirkende und Lizenzen

**In Erinnerung an Celo. Für Ljilje, Antonija und Marija.**

## Fremde Bestandteile

| Bestandteil | Verwendung | Lizenz |
|---|---|---|
| [three.js](https://threejs.org) | 3D-Darstellung | MIT |
| [ws](https://github.com/websockets/ws) | Netzwerk | MIT |
| [game-icons.net](https://game-icons.net) – Symbole von Lorc, Delapouite und weiteren Autoren | Einheiten-, Gebäude- und Rohstoffsymbole | CC BY 3.0 |
| [Lucide](https://lucide.dev) | Bedienungssymbole | ISC |
| [Oswald](https://fonts.google.com/specimen/Oswald) (Vernon Adams u. a.) | Titel und Zahlen | SIL Open Font License 1.1 (`public/fonts/OFL-Oswald.txt`) |
| [IBM Plex Sans Condensed](https://www.ibm.com/plex/) | Fließtext | SIL Open Font License 1.1 (`public/fonts/OFL-IBM-Plex.txt`) |

Die Symbole werden mit `node tools/build-ui-assets.mjs` aus den Paketen `@iconify-json/game-icons` und `@iconify-json/lucide` nach `public/js/icons.js` übernommen.
Für den Steam-Release muss diese Liste im Spiel (Abspann/Credits) sichtbar sein – CC BY verlangt die Namensnennung.
