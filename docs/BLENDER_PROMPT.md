# Prompt für Claude mit Blender-MCP (lokal auf dem Mac)

Den Block unten vollständig in die lokale Claude-Sitzung kopieren. Die Liste ist lang; am besten Phase für Phase abarbeiten lassen und zwischendurch die Ergebnisse ansehen.

---

```
Du modellierst in Blender (über die Blender-MCP-Verbindung) alle 3D-Modelle für mein Echtzeitstrategie-Spiel
„Frontlinien“ (Three.js im Browser, später Steam). Das Spiel geht von der Steinzeit bis 1990, hat 8 Epochen,
12 Nationen, bis zu 24 Spieler und Hunderte Einheiten gleichzeitig. Ziel: deutlich detaillierter und realistischer
als „War Selection“, aber performant. Arbeite Phase für Phase, zeig mir nach jedem Modell einen Screenshot
(Vorderansicht + 3/4-Ansicht aus RTS-Kamerawinkel von schräg oben) und die Dreieckszahl, bevor du exportierst.

=====================================================================
1. TECHNISCHE VORGABEN (für jedes Modell verbindlich)
=====================================================================
Format & Export
- glTF 2.0 binär (.glb), ein Modell pro Datei, Texturen eingebettet (PNG oder JPG).
- Maßstab: 1 Blender-Einheit = 1 Meter. Y ist oben (glTF-Standard), Modell blickt nach +Z (Vorderseite).
- Ursprung (Origin) unten mittig auf dem Boden. Alle Transformationen angewendet (Ctrl+A), keine negativen Skalierungen.
- Keine Kameras, Lichter, leeren Objekte oder versteckten Hilfsobjekte im Export.
- Normalen korrekt nach außen, keine doppelten Vertices, keine N-Gons im Export (triangulieren beim Export ist ok).

Materialien
- PBR (Principled BSDF): Base Color, Roughness, Metallic, optional Normal Map. Keine Blender-spezifischen Shader-Nodes,
  die glTF nicht kennt (keine Procedurals – alles in Texturen backen).
- Höchstens 3 Materialien pro Modell (weniger ist besser – jedes Material kostet einen Draw-Call).
- Teamfarbe: Alle Flächen, die die Spielerfarbe tragen sollen (Fahnen, Wappenröcke, Dachziegel-Akzente,
  Uniform-Abzeichen, Markierungen auf Fahrzeugen), bekommen ein eigenes Material mit dem exakten Namen „Team“
  und weißer/hellgrauer Base Color (Details als Graustufen-Textur). Das Spiel färbt dieses Material ein.
- Texturen als Atlas pro Modell, Kantenlänge Zweierpotenz.

Polygon- und Texturlimits (Dreiecke, LOD0 = nah)
| Kategorie                                   | LOD0     | LOD1   | LOD2  | Textur max. |
|---------------------------------------------|----------|--------|-------|-------------|
| Infanterist / Arbeiter / Sanitäter          | 3 000    | 1 000  | 300   | 512²        |
| Reiter inkl. Pferd                          | 5 000    | 1 800  | 500   | 1024²       |
| Fahrzeug (Panzer, Geschütz, LKW, Zug)       | 6 000    | 2 000  | 600   | 1024²       |
| Signatur-Einheit (Gustav, Yamato, Tu-160 …) | 15 000   | 5 000  | 1 500 | 2048²       |
| Flugzeug / Hubschrauber                     | 5 000    | 1 500  | 400   | 1024²       |
| Schiff                                      | 10 000   | 3 000  | 800   | 2048²       |
| Gebäude 2×2 Kacheln                          | 8 000    | 2 500  | 600   | 1024²       |
| Gebäude 3×3 Kacheln                          | 15 000   | 4 000  | 1 000 | 2048²       |
| Haupthaus je Epoche/Nation                  | 20 000   | 6 000  | 1 500 | 2048²       |
| Weltwunder                                  | 40 000   | 10 000 | 2 500 | 2048²       |
| Mauer-/Straßen-/Brückenabschnitt (modular)  | 800      | 250    | –     | 512²        |
| Baum                                        | 1 500    | 400    | 100   | 512² (Alpha)|
| Rohstoff (Gold, Stein, Beerenstrauch)       | 2 000    | 600    | 150   | 512²        |
- LODs als eigene Dateien: name.glb, name_lod1.glb, name_lod2.glb (LOD1/2 per Decimate, Silhouette erhalten).
- Prüfe die Dreieckszahl per Python im MCP (Summe aller Mesh-Polygone nach Triangulierung) und nenne sie mir.

Grundflächen (Gebäude müssen in dieses Quadrat passen; 1 Kachel = 4 m)
- 1×1 Kachel = 4 × 4 m: Mauer, Straße, Brücke
- 2×2 Kacheln = 8 × 8 m: Haus, Lager, Feld, Turm, Außenposten
- 3×3 Kacheln = 12 × 12 m: Haupthaus, Kaserne, Schießplatz, Stall, Werkstatt
- Weltwunder: 3×3-Grundfläche, darf aber höher und bis 18 × 18 m breit sein.
Gebäudehöhe realistisch, aber gut lesbar aus der RTS-Kamera (Dächer, Silhouetten, Eingänge betonen).

Animationen (nur für Einheiten mit Figuren)
- Ein gemeinsames Skelett für ALLE menschlichen Figuren (Name „HumanRig“, max. 30 Knochen), damit Animationen
  zwischen Einheiten geteilt werden. Ein gemeinsames Pferdeskelett „HorseRig“.
- Animationsnamen exakt so (Actions, als NLA-Spuren exportieren):
  Mensch: Idle, Walk, Run, AttackMelee, AttackShoot, Reload, Die, Gather (Hacken/Graben), Build (Hämmern), Carry, Heal
  Pferd: Idle, Walk, Gallop, Die
- Fahrzeuge: Knochen oder benannte Objekte „Turret“ (dreht um Y) und „Barrel“ (hebt um X), Räder/Ketten „Wheel_*“.
- Waffen als eigene Objekte, an den Handknochen geparentet, Namen „Weapon_R“ / „Weapon_L“ / „Shield“.

Dateistruktur (genau so ablegen – das Spiel lädt automatisch nach Namen)
assets/models/
  units/<linie>/<linie>_e<epoche>.glb                 z. B. units/inf/inf_e6.glb
  units/unique/<nation>_<einheit>.glb                 z. B. units/unique/germany_tiger.glb
  skins/<linie>_e<epoche>_<nation>.png                Uniform-Textur für das Basismodell (gleiche UV!)
  buildings/<typ>/<typ>_e<epoche>.glb                 z. B. buildings/barracks/barracks_e4.glb
  buildings/nations/<nation>/<typ>_e<epoche>.glb      Nationalstil, z. B. buildings/nations/russia/town_e5.glb
  wonders/<nation>_wonder.glb
  resources/<art>.glb, trees/<art>_<n>.glb
  special/celo.glb, special/celo_house.glb
Epochen-Nummern: e0 Steinzeit, e1 Bronzezeit, e2 Eisenzeit, e3 Frühes Mittelalter, e4 Spätes Mittelalter,
e5 1. Industrielle Revolution, e6 2. Industrielle Revolution (1860–1914), e6late (1914–1945), e7 Kalter Krieg.
Nationen-Schlüssel: usa, russia, germany, china, austria, yugoslavia, india, france, britain, italy, japan, ottoman

Skins (eigene Uniformen je Nation)
- Ab e5 (1. IR) tragen Truppen nationale Uniformen; das Modell bleibt gleich, nur die Textur wechselt.
  Deshalb: pro Linie und Epoche EIN Basismodell mit sauberer UV, dazu je Nation eine Uniform-Textur (skins/…png).
- Uniformfarben historisch korrekt (z. B. 1914: Deutschland feldgrau, Frankreich horizontblau/krapprot,
  Großbritannien khaki, Russland erdbraun-oliv, Österreich-Ungarn hechtgrau, Italien grigio-verde,
  Japan khaki-oliv, Osmanisches Reich khaki, USA oliv drab; Kalter Krieg: Flecktarn, Woodland usw.).

=====================================================================
2. RECHTLICHER RAHMEN – UNBEDINGT EINHALTEN (Deutschland/Österreich, Steam)
=====================================================================
Es geht um ein historisches Spielerlebnis, nicht um Verherrlichung. Wir distanzieren uns klar von NS-Symbolik.
VERBOTEN in jedem Modell, jeder Textur, jeder Fahne, jedem Abzeichen:
- Hakenkreuz (auch angedeutet, gespiegelt, stilisiert, auf Armbinden, Fahnen, Leitwerken, Dächern, Böden)
- SS-Runen, SS-Totenkopf, SS-Uniformen (schwarze SS-Uniform gar nicht modellieren)
- Reichsadler/Hoheitsadler mit Hakenkreuz (auch der Wehrmachtsadler auf Uniform/Helm – er enthält ein Hakenkreuz)
- Reichskriegsflagge ab 1935, NSDAP-Parteiadler, Parteiabzeichen, Runen-Symbole (Odal, Wolfsangel, Sig, Triskele …)
- Hitlergruß oder vergleichbare Posen in Animationen
- Ustaša-Symbole (das „U“, Wappen mit weißem erstem Feld in Ustaša-Form) – bei Kroatien/Jugoslawien nur das
  Schachbrett mit ROTEM erstem Feld (Wappen ab 1990) oder neutral ohne Wappen
ERLAUBT / so lösen:
- Deutsche Fahrzeuge 1914–1945: Balkenkreuz (Bundeswehr nutzt es heute noch) oder nur Teamfarbe.
- Deutsche Uniformen: Schnitt und Feldgrau historisch, aber ohne Brustadler, ohne Kragenrunen, ohne Armbinden.
- Gebäude der NS-Zeit (z. B. Zeppelintribüne auf dem Reichsparteitagsgelände Nürnberg) nur so, wie sie heute
  stehen: ohne Hakenkreuz (wurde 1945 gesprengt), ohne Adler, ohne Fahnen mit Symbolik. Fahnenmasten nur mit Teamfarbe.
- Sowjetischer Stern, Hammer und Sichel, Partisanenstern, Union Jack, US-Sterne usw. sind erlaubt.
- Faschistisches Liktorenbündel (Italien) und Kriegsflagge mit Strahlen (Japan) vermeiden – stattdessen Teamfarbe.
Bei jedem Zweifel: Symbol weglassen und Teamfarbe verwenden. Prüfe jede fertige Textur gezielt darauf.

=====================================================================
3. WAS ZU MODELLIEREN IST (nach Phasen, höchste Priorität zuerst)
=====================================================================
PHASE 1 – Allgemeine Truppen (alle Nationen, Basismodelle), Linien × Epochen:
| Linie (Ordner) | e0 | e1 | e2 | e3 | e4 | e5 | e6 | e6late | e7 |
|---|---|---|---|---|---|---|---|---|---|
| worker | Sammler | Arbeiter | Handwerker | Leibeigener | Bauer | Fabrikarbeiter | Arbeiter | – | Ingenieur |
| inf | Keulenträger | Axtkämpfer | Schwertkämpfer | Hauskrieger | Fußritter | Linieninfanterist | Schütze | Infanterist | Mechanisierte Infanterie (+ Schützenpanzer) |
| spear | – | Speerträger | Phalangit | Speerträger | Pikenier | Bajonettschütze | Panzerbüchsenschütze | Panzerabwehrtrupp | Lenkraketentrupp |
| rng | Steinschleuderer | Bogenschütze | Kompositbogner | Langbogenschütze | Armbrustschütze | Jäger | Scharfschütze | MG-Schütze | MG-Schütze |
| cav | – | Streitwagen | Reiter | Panzerreiter | Ritter | Husar | Panzerwagen | Panzer | Kampfpanzer |
| sie | – | – | Torsionsgeschütz | Blide | Bombarde | Belagerungsmörser | Schwerer Mörser | Schwere Haubitze | Raketenartillerie |
| art | – | – | – | – | – | Feldkanone | Feldgeschütz | Haubitze | Panzerhaubitze |
| med | – | Heiler | Feldarzt | Mönch | Feldscher | Sanitäter | Sanitäter | Sanitäter | Sanitäter |
Dazu: Pferd (2 Varianten: ungepanzert, gepanzert/Schabracke), Belagerungsgeräte, Rammbock.

PHASE 2 – Allgemeine Gebäude je Epoche (e0–e7), jeweils ein Modell:
haus (house), lager (storage), feld (farm), kaserne (barracks), schiessplatz (range), stall (stable, ab e5 Fahrzeughalle),
turm (tower, ab e5 Bunker/Geschützstellung), werkstatt (workshop, ab e5 Fabrik), haupthaus (town, neutral),
aussenposten (outpost), dazu modulare Abschnitte (je Epochengruppe e0–e2 / e3–e4 / e5–e7):
mauer (wall, Gerade + Ecke + Tor), strasse (road, Gerade, Kurve, Kreuzung), bruecke (bridge, Gerade + Brückenkopf:
Holzsteg e0–e1, Pontonbrücke e2, Steinbogen e3–e4, Eisenbrücke e5, Stahl-/Hängebrücke e6, Faltschwimmbrücke e7).
Rohstoffe: Goldvorkommen (3 Varianten + „erschöpft“-Variante), Steinvorkommen (3 + erschöpft), Beerenstrauch,
Bäume (Laubbaum 3, Nadelbaum 2, Herbstbaum 1, verschneiter Baum 2, Palme/Wüstenbusch 1, Sumpfbaum 1).

PHASE 3 – Haupthaus je Nation und Epoche (ab e3, USA ab e5) + Weltwunder
| Nation | e3 Frühes MA | e4 Spätes MA | e5 1. IR | e6 2. IR | e7 Kalter Krieg | Weltwunder |
|---|---|---|---|---|---|---|
| germany | Kaiserpfalz Aachen | Hanse-Rathaus mit Backsteingiebeln | Berliner Stadtschloss | Reichstagsgebäude (1894) – zusätzlich e6late-Variante: Zeppelintribüne Nürnberg OHNE jede Symbolik (nur wählbar mit Führer A.H.) | Palais Schaumburg / Bundeskanzleramt Bonn | Kölner Dom |
| austria | Babenberger-Burg | Wiener Hofburg (mittelalterlich) | Schloss Schönbrunn | Neue Burg Wien | UNO-City Wien | Parlament Budapest |
| russia | Kiewer Holzkreml | Moskauer Kreml (weiß, 15. Jh.) | Winterpalast | Kreml-Senatspalast | Lomonossow-Universität (Stalin-Hochhaus) | Basilius-Kathedrale |
| china | Tang-Palast (Daming) | Verbotene Stadt (Ming) | Qing-Sommerpalast | Präsidentenpalast Nanjing | Große Halle des Volkes | Himmelstempel |
| india | Tempelpalast (Chola) | Palast von Hampi | Mysore-Palast | Rashtrapati Bhavan (1929) | Sansad Bhavan (Parlament) | Taj Mahal |
| yugoslavia | Festung Klis | Festung Smederevo | Festung Petrovaradin | Alter Königspalast Belgrad | Palast der Föderation (Neu-Belgrad) | Tempel des hl. Sava |
| usa | – | – | Independence Hall | Kapitol / Weißes Haus | Pentagon | Freiheitsstatue mit Sternfort |
| france | Karolingische Pfalz | Cité von Carcassonne | Schloss Versailles | Hôtel de Ville Paris | Élysée-Palast | Eiffelturm |
| britain | Angelsächsische Halle | Tower of London | Buckingham Palace | Palace of Westminster | 10 Downing Street + Whitehall | Tower Bridge |
| italy | Langobardenburg | Palazzo Vecchio | Palazzo Reale di Caserta | Vittoriano (Rom) | Quirinalspalast | Petersdom |
| japan | Heian-Palast | Burg Himeji | Burg Edo | Nationales Parlamentsgebäude (1936) | Tokyo Tower mit Regierungsviertel | Tōdai-ji (Daibutsuden) |
| ottoman | Seldschuken-Karawanserei | Topkapı-Palast | Dolmabahçe-Palast | Parlament Ankara (1924) | Anıtkabir | Sultan-Ahmed-Moschee |
Wiedererkennbarkeit vor Detailtreue: die typische Silhouette (Kuppeln, Türme, Säulen, Dächer) muss aus der
RTS-Kamera sofort lesbar sein. Teamfarbe auf Fahnen/Dachakzenten.
Nationalstil auch für Haus, Turm und Mauer je Nation in e3–e4 und e5–e7 (je 2 Varianten pro Nation).

PHASE 4 – Nationale Spezialeinheiten (jeweils eigenes Modell)
- germany: Ottonischer Panzerreiter (e3), Landsknecht (e4), Preußischer Grenadier (e5), Krupp-Feldartillerie (e6),
  Tiger I (e6late), Schwerer Gustav – 80-cm-Eisenbahngeschütz (Signatur), Gepard-Flakpanzer (e7), Leopard 2 (e7, Signatur)
- austria: Magyarischer Bogenreiter, Ungarischer Husar, Kaiserlicher Kürassier, Tiroler Kaiserjäger, Zrínyi II,
  Škoda-30,5-cm-Mörser (Signatur), SK-105 Kürassier, Jagdkommando (Signatur)
- russia: Druschina, Strelize (mit Berdysch), Kosak, Ilja Muromez (Bomber 1913), T-34, Katjuscha BM-13 (Signatur),
  Mi-24 „Hind“, Tu-160 (Signatur)
- china: Repetierarmbrustschütze (Zhuge Nu), Raketenwerfer „Bienenstock“, Banner-Reiter, Panzerschiff Dingyuan +
  Soldat der Neuen Armee, Dadao-Schwertkämpfer, Guerilla der 8. Route-Armee (Signatur), Typ 59, HQ-2-Raketenstellung (Signatur)
- india: Kriegselefant (mit Howdah), Rajputen-Reiter, Mysore-Raketenträger, Elefanten-Batterie, Sikh-Infanterist,
  Gurkha (Signatur), Vijayanta, Flugzeugträger INS Vikrant + Prithvi-Raketenwerfer (Signatur)
- yugoslavia: Narentaner (Infanterist + Boot), Serbischer Panzerreiter, Pandur, Komitadschi, Partisan,
  Serbische Gebirgsbatterie (Signatur), M-84
- usa: Minuteman, Kentucky-Büchsenschütze, Rough Rider, M4 Sherman, Essex-Flugzeugträger + B-17 (Signatur),
  M1 Abrams, AH-64 Apache (Signatur)
- france: Fränkische Scara, Gendarme (Ritter), Grenadier der Alten Garde, Mitrailleuse, Renault FT,
  Maginot-Werk (Bunkergebäude, Signatur), Mirage III, Flugzeugträger Clemenceau + Fremdenlegionär (Signatur)
- britain: Huskarl, Langbogenschütze, Rotrock + Congreve-Raketengestell, HMS Dreadnought + Lee-Enfield-Schütze,
  Mark-IV-Panzer, Spitfire (Signatur), Harrier, SAS-Soldat (Signatur)
- italy: Langobardischer Reiter, Genuesischer Armbrustschütze (mit Setzschild), Bersagliere (mit Federbusch), Alpino,
  Folgore-Fallschirmjäger, Kampfschwimmer Decima MAS + Torpedoreiter (Signatur), Mod-56-Gebirgshaubitze, A129 Mangusta (Signatur)
- japan: Berittener Bogenkrieger (Bushi), Ashigaru mit Teppō, Samurai der Edo-Zeit, Schlachtschiff Mikasa +
  Meiji-Infanterist, A6M Zero, Yamato + Teishin-Fallschirmjäger (Signatur), Typ 74, Typ 90 (Signatur)
- ottoman: Turkmenischer Bogenreiter, Janitschar, Nizam-ı-Cedid-Soldat, Hamidiye-Reiter, Mehmetçik (Gallipoli),
  Dardanellen-Küstenbatterie + Minenleger Nusret (Signatur), Türkischer Kommando, F-16 (Signatur)

PHASE 5 – Allgemeine Schiffe, Flugzeuge, Eisenbahn, Infrastruktur
- Schiffe je Epoche: Fischerboot, Galeere (e1), Trireme (e2), Langschiff + Transportschiff (e3), Kogge/Karacke (e4),
  Fregatte + Linienschiff (e5), Panzerschiff + Torpedoboot (e6), Zerstörer, Kreuzer, Schlachtschiff, U-Boot,
  Flugzeugträger (e6late), Lenkwaffenzerstörer, Atom-U-Boot, Landungsschiff (e7). Werft je Epochengruppe.
- Flugzeuge: Beobachtungsballon, Doppeldecker-Aufklärer (e6), Jäger, Sturzkampfbomber, schwerer Bomber,
  Transportflugzeug (e6late), Düsenjäger, Jagdbomber, strategischer Bomber, Kampf- und Transporthubschrauber (e7).
  Flugplatz (Graspiste e6, Betonpiste mit Hangar e7), Flak-Stellung, Raketenstellung, Raketenabwehr.
- Eisenbahn: Gleisabschnitte (Gerade, Kurve, Weiche), Bahnhof (e5, e6, e7), Dampflok + Wagen (e5–e6),
  Diesellok (e7), Panzerzug, Güterwagen.
- LKW (e6 und e7), Atomforschungszentrum und Raketensilo (e7), Bunker, Geheimdienst-Gebäude.

PHASE 6 – Widmung
- „Celo“ (special/celo.glb): kroatischer Elitesoldat / Personenschützer Anfang der 1990er, Ausrüstung realistisch
  für Spezialeinheiten jener Zeit (Barett oder Helm, Splitterschutzweste, Funkgerät, Gewehr). KEINE Ustaša-Symbole,
  Wappen nur mit rotem erstem Feld oder ganz ohne. Würdig und ruhig, kein Rambo-Stil.
- Celos Haus (special/celo_house.glb): kleines kroatisches Wohnhaus mit Garten, Wäscheleine und zwei Kinderfahrrädern.
- Gedenkstein (special/celo_memorial.glb): schlichter Stein mit Platz für eine Inschrift.

=====================================================================
4. ARBEITSWEISE
=====================================================================
- Arbeite strikt nach Phasen. Pro Modell: modellieren → Screenshot zeigen → Dreiecke nennen → auf meine Freigabe
  warten → LODs erzeugen → exportieren. Mehrere sehr ähnliche Modelle (z. B. Uniform-Skins) darfst du gesammelt zeigen.
- Nutze für historische Bauwerke und Fahrzeuge echte Proportionen (Grundriss, Höhe, Fenster- und Säulenzahl);
  vereinfache Details, die aus der Strategiekamera nicht sichtbar sind, und backe feine Details in Normal Maps.
- Halte eine fortlaufende Liste assets/models/INVENTAR.md mit: Datei, Dreiecke je LOD, Texturgröße, Materialien,
  Status (fertig / in Arbeit) und Besonderheiten.
- Prüfe vor jedem Export: Limits eingehalten, Origin unten mittig, Blickrichtung +Z, Material „Team“ vorhanden,
  keine verbotene Symbolik (Abschnitt 2).
```
