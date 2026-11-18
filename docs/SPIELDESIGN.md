# Frontlinien – Spieldesign (Entwurf 2)

Stand: Konzept zur Diskussion. Zahlen sind Startwerte und werden mit Bot-gegen-Bot-Simulationen nachgestellt.

**Was sich gegenüber Entwurf 1 geändert hat:**
- Der Zeitrahmen reicht jetzt **bis 1990**, mit zwei neuen Epochen: Weltkriege und Kalter Krieg.
- **12 Nationen** statt 7.
- **Wasser- und Luftkrieg** sind von Anfang an eingeplant.
- **Brennstoff** (Kohle, später Öl) ist mit Sinn und Wirkung erklärt.

---

## 1. Das Prinzip

- **Echtzeitstrategie auf Zufallskarten.** Jeder startet als Stamm in der Steinzeit mit Haupthaus und Sammlern. Bis zu 24 Spieler, frei, Teams oder Armageddon.
- **Fortschritt ist der Kern.** Wer schneller aufsteigt, hat stärkere Truppen. Wer zu gierig aufsteigt und keine Armee hat, wird überrannt.
- **Identität wächst mit.**
  - **Steinzeit bis Eisenzeit:** alle Spieler gleich.
  - **Bronzezeit:** Wahl der **Kultur** (Spielstil).
  - **Frühes Mittelalter:** Wahl der **Nation** (Bonus plus eigene Einheiten bis zum Ende).
- **Sieg:** alle Gegner vernichten oder das **Weltwunder** in der letzten Epoche bauen und 30 Minuten halten, auf großen Karten 60 Minuten.
- **Drei Teilstreitkräfte:** Land immer, Wasser ab der Bronzezeit auf Karten mit Wasser, Luft ab dem Ende der 2. Industriellen Revolution.

## 2. Epochen (jetzt 9)

Obergrenze ist **1990**. Die Epochen bestimmen, welche Einheit realistisch erlaubt ist.

| # | Epoche | Zeitraum (grob) | Prägende Technik |
|---|---|---|---|
| I | Steinzeit | bis 3000 v. Chr. | Keulen, Schleudern |
| II | Bronzezeit | 3000–1200 v. Chr. | Streitwagen, Galeeren |
| III | Eisenzeit | 1200 v. Chr.–500 n. Chr. | Legionen, Torsionsgeschütze, Triremen |
| IV | Frühes Mittelalter | 500–1000 | Panzerreiter, Langschiffe |
| V | Spätes Mittelalter | 1000–1600 | Ritter, Pikeniere, Armbrust, erste Feuerwaffen |
| VI | 1. Industrielle Revolution | 1750–1860 | Linieninfanterie, Feldkanonen, Linienschiffe, Dampf |
| VII | 2. Industrielle Revolution | 1860–1914 | Hinterlader, frühe MGs, Panzerschiffe, Ballone |
| VIII | **Weltkriege** (neu) | 1914–1945 | Panzer, Jäger und Bomber, U-Boote, Flugzeugträger |
| IX | **Kalter Krieg** (neu) | 1945–1990 | Kampfpanzer, Hubschrauber, Düsenjets, Lenkraketen |

Das Weltwunder wandert in Epoche IX. Die beiden neuen Epochen brauchen eigene Gebäude-Modelle; die kommen später mit aus Blender.

## 3. Spielzeit: so entstehen bis zu 4 Stunden

Frühe Epochen sind kurz, späte lang, weil dort die großen Schlachten mit allen drei Teilstreitkräften stattfinden.

| Epoche | Erreicht nach (Ziel) | Dauer in der Epoche | Forschungszeit Aufstieg |
|---|---|---|---|
| I Steinzeit | 0:00 | ca. 10 min | – |
| II Bronzezeit | 0:10 | ca. 14 min | 1:00 min |
| III Eisenzeit | 0:24 | ca. 18 min | 1:30 min |
| IV Frühes MA | 0:42 | ca. 22 min | 2:30 min |
| V Spätes MA | 1:04 | ca. 24 min | 3:00 min |
| VI 1. IR | 1:28 | ca. 26 min | 4:00 min |
| VII 2. IR | 1:54 | ca. 28 min | 5:00 min |
| VIII Weltkriege | 2:22 | ca. 30 min | 6:00 min |
| IX Kalter Krieg | 2:52 | bis Spielende | 8:00 min |
| Weltwunder | ab ca. 3:00 | 4 min Bau + 30/60 min Halten | – |

**Stellschrauben dafür:**
1. **Aufstiegskosten und Forschungszeiten** steigen stärker als heute. Das Haupthaus bildet während der Forschung keine Arbeiter aus.
2. **Rohstoffe am Start erschöpfen sich** etwa bis Epoche IV. Danach muss man expandieren. Das erzeugt Kampf um die Karte statt Einigeln.
3. **Brennstoff ab Epoche VI** (Kapitel 4).
4. **Aufholhilfe:** Wer zwei oder mehr Epochen hinter dem Führenden liegt, zahlt 15 % weniger pro Rückstands-Epoche fürs Aufsteigen. Das Wissen „verbreitet sich“.

## 4. Brennstoff (Kohle → Öl): wozu?

**Das Problem ohne Brennstoff:** In einem 4-Stunden-Spiel haben ab der Industrialisierung alle genug Nahrung, Holz, Stein und Gold. Dann baut jeder die stärksten Einheiten in Masse, igelt sich ein, und das Endspiel wird zäh. Echte Kriege ab 1850 drehten sich dagegen um Kohle und Öl: die Ruhrbesetzung, Baku, Ploiești, Japans Vorstoß nach Indonesien.

**Der Sinn: Brennstoff ist ein knapper fünfter Rohstoff, der die Karte zum Schlachtfeld macht.**

| Wirkung | Wie | Was es im Spiel bewirkt |
|---|---|---|
| **1. Er schaltet die stärksten Einheiten frei** | Panzer, Schiffe ab Dampf, Flugzeuge und schwere Artillerie kosten zusätzlich Brennstoff | Wer keinen Brennstoff hat, kämpft mit Infanterie und leichten Waffen. Das ist schwächer, aber nicht chancenlos |
| **2. Fahrzeuge und Flugzeuge verbrauchen ihn laufend** (ab VIII) | Jede motorisierte Einheit kostet pro Minute ein wenig. Bei 0 sind Fahrzeuge 50 % langsamer und Flugzeuge starten nicht | Nachschub wird ein Ziel: Wer die Ölfelder des Gegners bombardiert oder überfällt, legt dessen Panzerarmee lahm. Gut für Comebacks |
| **3. Fabriken laufen schneller** (VI–VII) | Eine Fabrik verbraucht Kohle und erhöht das Ausbildungstempo der Werkstätten um 50 % | Wirtschaftliche Entscheidung: Brennstoff für Tempo oder für Einheiten? |
| **4. Die Vorkommen liegen in der Kartenmitte und an den Rändern**, nie am Startplatz | Kohleflöze sind ab VI nutzbar, Ölfelder erscheinen erst ab VIII | Das Endspiel bekommt umkämpfte Punkte. Wer sie hält, hat einen Vorteil, aber muss sie verteidigen |

- **Eine Anzeige, zwei Quellen:** Kohle und Öl füllen denselben Vorrat „Brennstoff“. Das bleibt übersichtlich und sieht trotzdem realistisch aus: Schachtanlage für Kohle, Bohrturm für Öl.
- **Kohle bleibt auch nach VIII nutzbar,** wie bei der Kohleverflüssigung in Deutschland, nur langsamer als Öl.
- **Nationen-Bezug:** Einige Nationen erhalten bei Brennstoff kleine Vorteile, die historisch begründet sind.
  - Deutschland: Kohleverflüssigung.
  - USA und Russland: große Ölvorkommen, Bohrtürme fördern 15 % mehr.
  - Japan und Italien haben keinen Vorteil. Das ist realistisch knapp, dafür sind ihre Einheiten sparsamer.

## 5. Truppengattungen und Konter-System

Jede Einheit hat **eine Klasse**. Der Schadensmultiplikator gegen eine Klasse ist das wichtigste Balancing-Werkzeug. Kein Einheitentyp schlägt alles.

| Klasse | Rolle | Stark gegen | Schwach gegen |
|---|---|---|---|
| Nahkampf-/Gewehrinfanterie | Allrounder, Gebäude besetzen | Fernkampf, Artillerie aus der Nähe | Panzer, MG, Artillerie |
| Spieß / Panzerabwehr-Infanterie | Sperre (bis V gegen Reiterei, ab VIII gegen Panzer) | Reiterei bzw. Panzer (×2) | Infanterie, Artillerie |
| Fernkampf / MG | Schaden auf Distanz | Infanterie | Reiterei, Panzer, Artillerie |
| Leichte Reiterei / Spähfahrzeug | Überfälle, Aufklärung | Fernkampf, Arbeiter, Artillerie | Spieß, schwere Einheiten |
| Schwere Reiterei / Panzer | Durchbruch | Infanterie, MG, leichte Fahrzeuge | Panzerabwehr, Jagdbomber, Kampfhubschrauber |
| Belagerung | Gebäude zerstören | Gebäude (×3) | alles in der Nähe |
| Artillerie (ab VI) | Flächenschaden auf Distanz | Infanterie, Gebäude | Reiterei/Panzer aus der Nähe, Flugzeuge, Gegenbatterie |
| Flugabwehr (ab VII) | Luftraum schützen | Flugzeuge, Hubschrauber (×3) | Bodentruppen |
| Jäger | Luftüberlegenheit | Bomber, Hubschrauber, andere Jäger | Flugabwehr |
| Bomber / Jagdbomber | Angriff aus der Luft | Gebäude, Panzer, Artillerie, Schiffe | Jäger, Flugabwehr |
| Hubschrauber (IX) | Schnelle Unterstützung | Panzer, Fahrzeuge | Jäger, Flugabwehr, Schulter-Flugabwehr |
| Überwasserschiffe | Küsten und See kontrollieren | Küstenziele, Transporter | U-Boote, Bomber, Küstenbatterien |
| U-Boote (ab VIII) | Unsichtbare Jäger | Überwasserschiffe | Zerstörer (Sonar), Flugzeuge |
| Unterstützung | Heilen, Reparieren, Bauen im Feld | – | alles |

**Grundregeln fürs Balancing:**
- Ein Konter gewinnt bei gleichen Kosten etwa 2:1, nicht 10:1. Taktik und Masse zählen weiter mit.
- Eine Epoche Vorsprung bringt etwa +30 % Kampfwert. Zwei Epochen Rückstand sind mit Befestigungen und Masse noch zu halten, drei kaum.
- Kampfwert = Leben × Schaden pro Sekunde, geteilt durch die Gesamtkosten. Standardeinheiten einer Epoche liegen im selben Rahmen (±10 %). Unterschiede entstehen über die Konter-Tabelle.
- Bevölkerung kostet: Infanterie 1, Reiterei/leichte Fahrzeuge 2, Artillerie 3, Panzer 4, Flugzeuge 3–5, Schiffe 3–8, Signatur-Einheiten 10. Das Limit bleibt bei 200. Späte Armeen werden kleiner, aber wertvoller, und das Spiel läuft flüssig.
- Gebäude und Befestigungen werden mit jeder Epoche stärker. Bunker ab VIII, Flugabwehrstellungen ab VIII, Raketenstellungen ab IX.

## 6. Standardtruppen aller Nationen

Gilt für alle. Nationseinheiten (Kapitel 9) **ersetzen** eine dieser Einheiten oder kommen dazu.

### Land

| Linie | I–III | IV | V | VI | VII | VIII | IX |
|---|---|---|---|---|---|---|---|
| Arbeiter | Sammler → Handwerker | Leibeigener | Bauer | Fabrikarbeiter | Arbeiter | Arbeiter | Ingenieur |
| Infanterie | Keulenträger → Schwertkämpfer | Hauskrieger | Fußritter | Linieninfanterist | Schütze (Hinterlader) | Infanterist | Mechanisierte Infanterie (mit Schützenpanzer) |
| Spieß / Panzerabwehr | Speerträger → Phalangit | Speerträger | Pikenier | (Bajonett) | – | Panzerabwehr-Trupp (Panzerbüchse, Bazooka) | Panzerabwehr-Lenkraketen-Trupp |
| Fernkampf / MG | Schleuderer → Kompositbogner | Bogenschütze | Armbrust / Arkebusier | Jäger (gezogene Büchse) | MG-Trupp | MG-Trupp, Scharfschütze | MG-Trupp, Scharfschütze, Schulter-Flugabwehr |
| Leichte Reiterei / Spähwagen | Reiter (ab III) | Leichter Reiter | Berittener Schütze | Husar | Kavallerie | Panzerspähwagen | Spähpanzer |
| Schwere Reiterei / Panzer | Streitwagen → Kataphrakt | Panzerreiter | Ritter | Kürassier | Kürassier | Mittlerer / schwerer Panzer, Jagdpanzer | Kampfpanzer |
| Belagerung / Artillerie | Rammbock → Torsionsgeschütz | Blide | Bombarde, Tribok | Feldkanone, Mörser | Feldgeschütz, Haubitze | Haubitze, Granatwerfer, Raketenwerfer | Panzerhaubitze, Raketenartillerie |
| Flugabwehr | – | – | – | – | Ballonabwehrkanone | Flak | Flakpanzer, Flugabwehrraketen |
| Unterstützung | Schamane → Feldarzt | Mönch | Feldscher | Sanitäter | Sanitäter, Pioniere | Sanitäter, Pioniere | Sanitäter, Pioniere |
| Elite | – | – | – | – | – | Fallschirmjäger (nur einige Nationen, s. u.) | Spezialkräfte (alle, Stärke je Nation) |

### Wasser (nur auf Karten mit Wasser)

| II–III | IV | V | VI | VII | VIII | IX |
|---|---|---|---|---|---|---|
| Fischerboot, Galeere, Trireme | Langschiff, Transportschiff | Kogge, Karacke (erste Kanonen) | Fregatte, Linienschiff | Panzerschiff, Torpedoboot | Zerstörer, Kreuzer, Schlachtschiff, U-Boot, Flugzeugträger* | Lenkwaffenzerstörer, Atom-U-Boot, Flugzeugträger*, Landungsschiff |

*Flugzeugträger nur für Nationen, die historisch welche hatten: USA, Großbritannien, Frankreich und Japan; Indien erst in IX. Das ist ein echtes Alleinstellungsmerkmal, so wie in War Selection.

### Luft

| VII (spät) | VIII | IX |
|---|---|---|
| Beobachtungsballon, Aufklärer (Doppeldecker) | Jäger, Sturzkampfbomber, schwerer Bomber, Transportflugzeug (für Fallschirmjäger), Aufklärer | Düsenjäger, Jagdbomber, strategischer Bomber, Kampfhubschrauber, Transporthubschrauber, Aufklärer |

## 7. Wasser- und Luftkrieg: so funktioniert es

**Wasser:**
- **Werft** an der Küste: baut Schiffe. Fischerboote liefern Nahrung, ein früher Grund, ans Wasser zu gehen.
- **Transportschiffe** bringen Armeen über Seen und Meere. Auf Inselkarten führt kein Weg daran vorbei. Neuer Kartentyp „Inseln“.
- **Schiffe beschießen Küsten:** Schlachtschiffe haben große Reichweite gegen Gebäude in Küstennähe. Dagegen helfen Küstenbatterien (Gebäude ab VI).
- **U-Boote** sind unsichtbar, bis ein Zerstörer (Sonar) oder ein Flugzeug in der Nähe ist.
- **Flugzeugträger** sind schwimmende Flugplätze: Sie tragen bis zu 6 eigene Flugzeuge, die dort aufmunitionieren.

**Luft:**
- **Flugplatz** (ab VIII; in VII nur Ballone und ein Aufklärer). Flugzeuge starten, greifen an und **müssen zurück zum Tanken und Aufmunitionieren**, wie in echt. Das verhindert, dass Flugzeuge dauerhaft über der Basis kreisen, und macht Flugplätze zu wichtigen Zielen.
- **Hubschrauber (IX)** können über dem Gelände schweben, brauchen aber auch Nachschub. Sie sind langsamer und tiefer, also anfällig für Flugabwehr vom Boden.
- **Luftüberlegenheit:** Wer den Himmel kontrolliert, sieht mehr. Aufklärer heben den Nebel des Krieges auf, und Bomber erreichen Ziele tief im Hinterland.
- **Fallschirmjäger** werden aus Transportflugzeugen über jedem Gebiet abgesetzt, das man sieht.
- **Flugabwehr** gibt es als Einheit (Flak, Flakpanzer, Schulter-Flugabwehr) und als Gebäude (Flak-Stellung, Raketenstellung). Jäger sind die mobile Antwort.

## 8. Atomwaffen (Kalter Krieg): Spieleinstellung

Atomwaffen gehören zu 1945–1990, würden aber ein Spiel mit einem Klick entscheiden. Vorschlag:
- **Einstellung in der Lobby: „Atomwaffen: aus / an“, Standard „aus“.**
- **Wenn an:**
  - Nur historische Atommächte bis 1990 dürfen sie bauen: USA, Russland (UdSSR), Großbritannien, Frankreich, China.
  - Pro Spieler 1 Rakete, 10 Minuten Bauzeit, sehr hohe Kosten inklusive Brennstoff. Der Bau wird allen angekündigt und kann durch Zerstören des Silos gestoppt werden.
  - Wirkung: großer Flächenschaden, aber **nicht gegen das Weltwunder**.
- **Ausgleich für Nicht-Atommächte:** Raketenabwehr-Stellung (fängt eine Rakete ab).

## 9. Nationen mit eigenen Truppen (12)

**Regeln:**
- Jede Nation hat einen **Dauerbonus** und **1 eigene Einheit pro Epoche ab IV**.
- In **VIII und IX** kommt jeweils eine **Signatur-Einheit** dazu: Superwaffe oder Elite-Einheit, begrenzt auf 1 bis 3 gleichzeitig.
- **Realismus:**
  - Jede Einheit gab es bei der Nation oder ihrem Vorgänger auf demselben Gebiet tatsächlich, im Zeitraum der Epoche.
  - Die Jahreszahl steht dabei.
  - Bei untergegangenen Staaten treten die Nachfolger an: Österreich-Ungarn ab 1918 mit Österreich und Ungarn, Osmanisches Reich ab 1923 als Türkei, Russland 1922–1991 als Sowjetunion.
- **Stärke:** Eigene Einheiten haben höchstens +25 % Kampfwert gegenüber der ersetzten Standardeinheit, bei 10–20 % höheren Kosten.
- **Wasser-Einheiten sind nie die einzige Besonderheit.** Wer eine Schiffs-Signatur hat, bekommt auf Landkarten einen Ersatz.

### Deutschland – Bonus: +10 % Schaden; Kohleverflüssigung (Kohle zählt doppelt ab VIII)
| Epoche | Einheit | Historisch | Rolle |
|---|---|---|---|
| IV | Ottonischer Panzerreiter | Lechfeld, 955 | Schwere Reiterei, +15 % Leben |
| V | Landsknecht | ab 1490 | Zweihänder-Infanterie, Flächenschaden gegen Pikeniere |
| VI | Preußischer Grenadier | Zündnadelgewehr, 1841 | Schnellere Schussfolge |
| VII | Krupp-Feldartillerie | 1870/71 | Artillerie mit mehr Reichweite |
| VIII | Tiger I | 1942 | Schwerer Panzer, langsam, sehr stark |
| VIII Signatur | **Schwerer Gustav** | 80-cm-Eisenbahngeschütz, 1942 | Superwaffe, max. 1. Extreme Reichweite, braucht 2 min zum Aufbauen, große Mindestreichweite, gegen Flugzeuge hilflos |
| IX | Gepard | Flakpanzer, 1976 | Starke mobile Flugabwehr |
| IX Signatur | **Leopard 2** | 1979 | Elite-Kampfpanzer, max. 6 |

### Österreich-Ungarn (ab 1918 Österreich und Ungarn) – Bonus: Türme +2 Reichweite
| Epoche | Einheit | Historisch | Rolle |
|---|---|---|---|
| IV | Magyarischer Bogenreiter | Ungarnzüge, 10. Jh. | Berittener Fernkämpfer |
| V | Ungarischer Husar | 15. Jh., Schwarze Armee | Leichte Reiterei |
| VI | Kaiserlicher Kürassier | 18. Jh. | Schwere Reiterei, +Rüstung |
| VII | Tiroler Kaiserjäger | Gebirgstruppe | Kein Tempoverlust auf Hügeln |
| VIII | Zrínyi II | ungarisches Sturmgeschütz, 1943 | Gepanzerte Haubitze, auch gegen Gebäude |
| VIII Signatur | **Škoda 30,5-cm-Mörser** | 1911, im Einsatz ab 1914 | Superwaffe, max. 1, schnell verlegbar |
| IX | SK-105 Kürassier | österreichischer Jagdpanzer, 1971 | Leichter Panzerjäger, schnell |
| IX Signatur | **Jagdkommando** | österreichische Spezialkräfte, ab 1962 | Elite-Infanterie, max. 10, getarnt |

### Russland (UdSSR) – Bonus: +10 % Leben für Militär; Bohrtürme +15 %
| Epoche | Einheit | Historisch | Rolle |
|---|---|---|---|
| IV | Druschina | Kiewer Rus | Robuste Infanterie |
| V | Strelizen | ab 1550 | Arkebusiere mit Nahkampfaxt |
| VI | Kosaken | Höhepunkt im 18./19. Jh. | Günstige leichte Reiterei, plündert |
| VII | Ilja Muromez | 1913, erster viermotoriger Bomber | Früher Bomber, max. 2 (einziges Flugzeug in VII) |
| VIII | T-34 | 1940 | Mittlerer Panzer, günstig, schnell zu bauen |
| VIII Signatur | **Katjuscha** | Raketenwerfer BM-13, 1941 | Salve mit riesigem Flächenschaden, max. 4 |
| IX | Mi-24 „Hind“ | Kampfhubschrauber, 1972 | Gepanzerter Hubschrauber, transportiert auch Infanterie |
| IX Signatur | **Tu-160** | strategischer Bomber, 1987 | Max. 1, enorme Reichweite und Bombenlast |

### China – Bonus: Truppen 25 % schneller ausgebildet
| Epoche | Einheit | Historisch | Rolle |
|---|---|---|---|
| IV | Repetierarmbrust (Zhuge Nu) | seit Han-Zeit, im MA weiter genutzt | Sehr hohe Schussfolge, kurze Reichweite |
| V | Raketenwerfer „Bienenstock“ | Ming, ca. 1400 | Flächenschaden, ungenau |
| VI | Banner-Reiter | Acht Banner der Qing | Berittener Bogenschütze |
| VII | Panzerschiff Dingyuan / Neue Armee | 1881 / 1895 | Wasser: schweres Schiff. Land: modern ausgebildete Infanterie |
| VIII | Dadao-Truppe | Schwertkämpfer der 29. Armee an der Großen Mauer, 1933 | Nahkampf-Infanterie, stark beim Überraschungsangriff |
| VIII Signatur | **Guerilla der 8. Route-Armee** | 1937–45 | Max. 3 Trupps, getarnt, legen Tunnel zwischen eigenen Gebäuden an |
| IX | Typ 59 | Kampfpanzer, 1959 | Billig, in Masse baubar |
| IX Signatur | **HQ-2-Raketenstellung** | Flugabwehrraketen, holte U-2-Aufklärer ab, 1960er | Sehr starke Flugabwehr-Stellung, max. 3 |

Bewusst **ohne** Flammenwerfer.

### Indien – Bonus: Häuser +4 Bevölkerung, Belagerung/Artillerie +25 % Schaden
| Epoche | Einheit | Historisch | Rolle |
|---|---|---|---|
| IV | Kriegselefant | Standard indischer Reiche | Viel Leben, Bonus gegen Gebäude, anfällig gegen Speere |
| V | Rajputen-Reiter | 8.–16. Jh. | Schwere Reiterei mit Sturmangriff-Bonus |
| VI | Mysore-Raketenträger | Tipu Sultan, 1780–99 | Große Reichweite, Flächenschaden |
| VII | Elefanten-Batterie | Britisch-Indien, 1860–1900 | Schwere Geschütze, kommen gut durch unwegsames Gelände |
| VIII | Sikh-Infanterie | Sikh-Regimenter in beiden Weltkriegen | Starke Infanterie, kämpft weiter, auch wenn sie schwer verletzt ist |
| VIII Signatur | **Gurkha-Kompanie** | Gurkha-Regimenter | Elite-Nahkampf, max. 10 |
| IX | Vijayanta | Kampfpanzer, 1965 | Solider Kampfpanzer |
| IX Signatur | **INS Vikrant** | Flugzeugträger, 1961 | Wasser: Träger. Landkarte: Prithvi-Rakete (1988), konventionelle Raketenartillerie |

### Jugoslawien (Serbien und Kroatien als Vorgänger) – Bonus: Infanterie 15 % schneller
| Epoche | Einheit | Historisch | Rolle |
|---|---|---|---|
| IV | Narentaner | Adria-Seeräuber, 9. Jh. | Schnelle Plünder-Infanterie, auf Wasserkarten auch ein Boot |
| V | Serbischer Panzerreiter | Heer Stefan Dušans, 1340er | Schwere Reiterei |
| VI | Pandur | Militärgrenze, 1740er | Leichte Infanterie, im Wald unsichtbar |
| VII | Komitadschi | Freischärler, Balkankriege 1912–13 | Getarnt, solange sie stillstehen |
| VIII | Partisanen | Tito, 1941–45 | Werden günstig in jedem eigenen Gebäude ausgebildet, getarnt im Wald und auf Hügeln |
| VIII Signatur | **Serbische Gebirgsbatterie** | 1912–18 | Artillerie, max. 3, kann Hügel erklimmen |
| IX | M-84 | Kampfpanzer, 1984 | Robuster Kampfpanzer |
| IX Signatur | **Territorialverteidigung** | Doktrin ab 1969 | Fähigkeit: Arbeiter greifen 2 Minuten lang als Miliz zu den Waffen, lange Abklingzeit |

### USA – Bonus: alle Rohstoffe 15 % schneller; Bohrtürme +15 %
| Epoche | Einheit | Historisch | Rolle |
|---|---|---|---|
| IV–V | – (offene Frage) | Die USA gab es noch nicht | Ausgleich durch den Wirtschaftsbonus |
| VI | Minutemen / Kentucky-Büchse | 1775 / 18. Jh. | Miliz direkt aus dem Haupthaus; Schütze mit großer Reichweite |
| VII | Rough Riders | 1898 | Berittene Infanterie, kann absitzen |
| VIII | M4 Sherman | 1942 | Mittlerer Panzer, Fließband: 30 % schneller gebaut |
| VIII Signatur | **Flugzeugträger (Essex-Klasse)** | 1942 | Wasser: Träger. Landkarte: B-17 „Fliegende Festung“, max. 3 |
| IX | M1 Abrams | 1980 | Kampfpanzer mit hoher Reichweite |
| IX Signatur | **AH-64 Apache** | 1986 | Elite-Kampfhubschrauber, max. 4 |

### Frankreich (neu) – Bonus: Gebäude 20 % mehr Leben, Befestigungen 25 % billiger
| Epoche | Einheit | Historisch | Rolle |
|---|---|---|---|
| IV | Fränkische Scara | Panzerreiter der Karolinger | Schwere Reiterei |
| V | Gendarmes | Ordonnanzkompanien, 1445 | Schwer gepanzerte Ritter |
| VI | Alte Garde | Grande Armée, 1804 | Elite-Linieninfanterie |
| VII | Mitrailleuse | 1866 | Frühes Salvengeschütz gegen Infanterie |
| VIII | Renault FT | 1917, erster Panzer mit Drehturm | Leichter Panzer, schon zu Beginn der Epoche verfügbar |
| VIII Signatur | **Maginot-Werk** | 1930er | Bunkergebäude, max. 3, extrem widerstandsfähig, mit Geschützturm |
| IX | Mirage III | 1961 | Schneller Düsenjäger |
| IX Signatur | **Flugzeugträger Clemenceau** | 1961 | Wasser: Träger. Landkarte: Fremdenlegion-Fallschirmjäger (2e REP), max. 10 |

### Großbritannien (neu) – Bonus: Schiffe 20 % billiger, Werften bauen 25 % schneller
| Epoche | Einheit | Historisch | Rolle |
|---|---|---|---|
| IV | Huskarl | angelsächsische Leibgarde, um 1000 | Infanterie mit Dänenaxt |
| V | Englischer Langbogenschütze | Crécy, 1346 | Größte Reichweite in V |
| VI | Rotrock / Congreve-Rakete | Brown Bess; Raketen ab 1805 | Linieninfanterie; Raketen-Artillerie |
| VII | HMS Dreadnought / Lee-Enfield-Schützen | 1906 / 1895 | Wasser: Schlachtschiff. Land: Infanterie mit schneller Schussfolge |
| VIII | Mark-IV-Panzer | 1916, erste Panzer der Welt | Ab Beginn VIII, bricht Stellungen auf |
| VIII Signatur | **Spitfire-Staffel** | 1938 | Jäger, max. 6, beste Wendigkeit |
| IX | Harrier | Senkrechtstarter, 1969 | Jagdbomber, startet ohne Flugplatz |
| IX Signatur | **SAS** | Spezialkräfte, ab 1941 | Elite-Infanterie, max. 8, Sabotage an Gebäuden |

### Italien (neu) – Bonus: Infanterie und Gebirgstruppen kämpfen auf Hügeln +20 %
| Epoche | Einheit | Historisch | Rolle |
|---|---|---|---|
| IV | Langobardischer Reiter | ab 568 | Schwere Reiterei mit Lanze |
| V | Genuesischer Armbrustschütze | 14. Jh. | Beste Armbrust, mit Setzschild |
| VI | Bersaglieri | 1836 | Schnelle leichte Infanterie |
| VII | Alpini | 1872 | Gebirgsinfanterie |
| VIII | Folgore-Fallschirmjäger | El Alamein, 1942 | Fallschirmjäger, ohne Flugplatz absetzbar |
| VIII Signatur | **Decima MAS** | Kampfschwimmer, Alexandria 1941 | Sabotieren Schiffe und Küstengebäude, max. 4. Auf Landkarten auch über Flüsse und Seen |
| IX | Mod-56-Gebirgshaubitze | 1957, zerlegbar | Leichte Artillerie, auch per Hubschrauber verlegbar |
| IX Signatur | **A129 Mangusta** | Kampfhubschrauber, Indienststellung 1990 | Max. 4, wendig |

### Japan (neu) – Bonus: Elite- und Signatur-Einheiten 20 % billiger
| Epoche | Einheit | Historisch | Rolle |
|---|---|---|---|
| IV | Berittener Bogenkrieger (Bushi) | Heian-Zeit, 10. Jh. | Berittener Fernkämpfer |
| V | Ashigaru mit Teppō | Nagashino, 1575 | Frühe Arkebusiere in Masse |
| VI | Samurai der Edo-Zeit | bis 1868 | Starke Nahkampf-Infanterie (bewusst altmodisch) |
| VII | Schlachtschiff Mikasa / Meiji-Infanterie | 1902 / ab 1873 | Wasser: Schlachtschiff. Land: moderne Infanterie |
| VIII | A6M „Zero“ | 1940 | Jäger mit großer Reichweite |
| VIII Signatur | **Yamato** | Schlachtschiff, 1941 | Wasser: größtes Schlachtschiff. Landkarte: Teishin-Fallschirmjäger (1942), max. 10 |
| IX | Typ 74 | Kampfpanzer, 1975 | Kampfpanzer mit Federung, die sich dem Gelände anpasst |
| IX Signatur | **Typ 90** | Kampfpanzer, 1990 | Elite-Kampfpanzer, max. 6 |

### Osmanisches Reich (ab 1923 Türkei) (neu) – Bonus: Infanterie 15 % billiger
| Epoche | Einheit | Historisch | Rolle |
|---|---|---|---|
| IV | Turkmenischer Bogenreiter | 10. Jh. | Berittener Fernkämpfer |
| V | Janitschar | ab 1360er | Elite-Infanterie mit Feuerwaffe |
| VI | Nizam-ı Cedid | „Neue Ordnung“, 1792 | Modernisierte Linieninfanterie |
| VII | Hamidiye-Reiterei | 1891 | Leichte Reiterei |
| VIII | Mehmetçik (Gallipoli) | 1915 | Zähe Verteidigungs-Infanterie, Bonus in Stellungen |
| VIII Signatur | **Dardanellen-Batterie und Minenleger Nusret** | 1915 | Küstenfestung, max. 2. Auf Landkarten eine schwere Geschützstellung |
| IX | Türkische Kommandos | Zypern, 1974 | Fallschirmjäger |
| IX Signatur | **F-16 (türkische Lizenzfertigung)** | ab 1987 | Elite-Jagdbomber, max. 4 |

## 10. Signatur-Einheiten: Balancing

- **Kosten:** etwa so hoch wie 15 bis 20 Standardeinheiten, inklusive Brennstoff. Bauzeit 3–4 Minuten. Superwaffen (Gustav, Škoda, Katjuscha, Tu-160) werden allen Gegnern angekündigt.
- **Gezielte Schwächen:** Superwaffen sind langsam, brauchen Aufbauzeit, haben eine große Mindestreichweite und sind gegen Flugzeuge, Panzer im Nahkampf und Spezialkräfte verwundbar. Elite-Einheiten sind stark, aber teuer und begrenzt.
- **Keine Signatur-Einheit darf allein ein Spiel entscheiden.** Sie soll den Gegner zum Reagieren zwingen.
- **Landkarten-Ersatz:** Jede Nation mit Schiffs-Signatur hat einen gleichwertigen Ersatz an Land.

## 11. Wie wir das Balancing prüfen

1. **Simulation:** Bots aller 12 Nationen spielen 100-mal auf zufälligen Karten gegeneinander, beschleunigt auf dem Server. Ziel: Jede Nation gewinnt 45–55 % ihrer Spiele, getrennt nach Land- und Wasserkarten.
2. **Duell-Tests:** Gleiche Kosten gegeneinander, zum Beispiel Panzerabwehr gegen Panzer. Ein Konter soll etwa 2:1 gewinnen.
3. **Zeitmessung:** Wann erreichen Bots jede Epoche? Vergleich mit der Tabelle in Kapitel 3.
4. **Spieltests mit euch:** Notieren, was sich zu stark oder zu schwach anfühlt. Danach wird jeweils eine Zahl geändert, nicht alles auf einmal.

## 12. Umsetzung in Schritten

1. **Grundgerüst:** Epochen auf 9 erweitern, Spieltempo, Rohstofferschöpfung, Brennstoff, Aufholhilfe.
2. **Landtruppen:** neue Linien (Panzerabwehr, Flugabwehr, Artillerie, Unterstützung) und das Konter-System.
3. **Nationen:** 12 Nationen mit Boni und eigenen Einheiten IV–VII.
4. **Wasser:** Werft, Fischerboote, Transporter, Kriegsschiffe, U-Boote, Kartentyp „Inseln“.
5. **Luft:** Flugplatz mit Tanken/Aufmunitionieren, Jäger, Bomber, Hubschrauber, Fallschirmjäger, Flugabwehr.
6. **Spätphase:** Nationseinheiten VIII–IX, Signatur-Einheiten, Atomwaffen-Option.
7. **Feinschliff:** Simulationen und Balancing.

Modelle bleiben bis dahin Platzhalter. Die richtigen Modelle kommen später aus Blender als `.glb`, das Spiel lädt sie dann statt der Platzhalter.

## 13. Offene Entscheidungen

- **USA im Mittelalter (IV–V):** Lücke mit Wirtschaftsbonus als Ausgleich (Vorschlag)? Oder ersatzweise Einheiten der Völker, die damals dort lebten?
- **Atomwaffen:** als Lobby-Option wie vorgeschlagen, ganz weglassen oder immer an?
- **9 Epochen:** passt die Aufteilung mit „Weltkriege“ und „Kalter Krieg“, oder lieber 1. und 2. Weltkrieg getrennt (dann 10 Epochen)?
