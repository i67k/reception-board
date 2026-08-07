# reception-board

ÖV- & Wetter-Infotafel für die Rezeption (Ogilvy, Zürich West). Ein Touchscreen
im Kiosk-Modus zeigt im Vorbeigehen:

- **ÖV-Abfahrten** der Haltestellen Fischerweg, Escher-Wyss-Platz und
  Hardbrücke (Bahn) — Verspätungen und Störungen prominent hervorgehoben,
  Normalbetrieb bewusst unauffällig.
- **Regenradar** auf einer Leaflet-Karte mit Swisstopo-Basiskarte, inkl.
  Nowcast (Animation der letzten Stunde + Prognose).
- **Wetterzahlen** (Temperatur, gefühlte Temperatur, Regenwahrscheinlichkeit,
  „Regen in ca. X min") für den „jetzt losgehen oder warten"-Entscheid.

Alles in **einer einzigen HTML-Datei** (`index.html`), ohne Backend, ohne
API-Keys, ohne kostenpflichtige Dienste.

## Betrieb (Kiosk)

```sh
# Variante 1: direkt als Datei öffnen (alle genutzten APIs sind CORS-offen)
chromium --kiosk --noerrdialogs --disable-session-crashed-bubble \
         file:///pfad/zu/reception-board/index.html

# Variante 2: über einen Mini-Webserver (falls file:// im Setup Probleme macht)
python3 -m http.server 8000   # dann http://localhost:8000 im Kiosk-Modus öffnen
```

Die Seite aktualisiert die Abfahrten alle 60 s, Wetter alle 10 min, Radar alle
5 min und lädt sich täglich um 04:00 selbst neu (Memory-Hygiene im
Dauerbetrieb). Fällt das Netz aus, bleiben die letzten Daten stehen und die
betroffenen Karten werden rot umrandet („Daten veraltet").

Das Gerät braucht nur Internetzugang (Gäste-/Separatnetz genügt), keinen
Zugriff aufs Firmennetz. Es werden keine Personendaten verarbeitet.

## Datenquellen (gratis, ohne Key)

| Zweck | Quelle | Zugriff |
|---|---|---|
| Abfahrten & Verspätungen | [transport.opendata.ch](https://transport.opendata.ch/docs.html) `/v1/stationboard` | JSON, CORS offen |
| Wetterzahlen | [Open-Meteo](https://open-meteo.com) mit MeteoSwiss-Modell **ICON-CH1** (Fallback: best match) | JSON, CORS offen |
| Basiskarte | Swisstopo Pixelkarte grau via [wmts.geo.admin.ch](https://wmts.geo.admin.ch) | Bildkacheln (kein CORS nötig) |
| Regenradar | siehe unten | Bildkacheln |

Der lizenzpflichtige Quellenhinweis **„Source: MeteoSwiss"** ist auf der Tafel
sichtbar (Wetterkarte), zusätzlich Attribution in der Fusszeile.

## API-Links prüfen

Die Tafel hat einen eingebauten **Diagnose-Modus**: `index.html?debug` aufrufen
(oder auf der Seite die Taste **`d`** drücken). Ein Overlay listet dann jede
Datenquelle mit ✓/✗, der aufgelösten Haltestellen-ID, der Anzahl Abfahrten und
dem tatsächlich verwendeten Wettermodell. Das ist der schnellste Weg, bei der
Inbetriebnahme am Kiosk zu sehen, welcher Link antwortet — ohne
Entwicklerkonsole.

### Prüfskript `tools/api-check.js`

Wenn du sehen willst, was die APIs **tatsächlich** liefern:

1. `index.html` im Browser öffnen
2. `F12` drücken → Reiter **Console**
3. Den gesamten Inhalt von `tools/api-check.js` hineinkopieren, Enter

Das Skript liest nur und verändert nichts. Es gibt aus:

- **RainViewer:** alle Vergangenheits- und Prognosebilder als Tabelle mit
  Uhrzeit und Relativzeit, dazu die Antwort auf die entscheidende Frage —
  reicht die Prognose überhaupt in die Zukunft, oder sind ihre Zeitstempel
  schon abgelaufen? Ausserdem die Kachelgrössen für Zoom 5 bis 9 mit
  Deutung (Radardaten vorhanden / leer / Platzhalter).
- **ÖV:** welche Station jeder Suchbegriff wirklich trifft, samt ID und den
  nächsten Abfahrten mit Verspätung.
- **Wetter:** welche der drei Modellstufen antwortet.
- **Karte:** ob die swisstopo-Kacheln laden.

Warum in der Konsole der Seite und nicht mit `curl`: Der Browser wendet dort
dieselben CORS-Regeln an wie im echten Betrieb. Was dort funktioniert,
funktioniert auch auf der Tafel — und umgekehrt.

### Einzelne Endpunkte von Hand

Zum Nachprüfen im Browser (alle liefern JSON):

```
# Haltestelle suchen -> liefert die ID im Feld stations[].id
https://transport.opendata.ch/v1/locations?query=Z%C3%BCrich,%20Fischerweg
https://transport.opendata.ch/v1/locations?query=Z%C3%BCrich,%20Escher-Wyss-Platz
https://transport.opendata.ch/v1/locations?query=Z%C3%BCrich%20Hardbr%C3%BCcke

# Abfahrtstafel zu einer ID (Feld stationboard[].stop.delay = Verspätung in min)
https://transport.opendata.ch/v1/stationboard?id=8503020&limit=16

# Wetter mit MeteoSwiss-Modell
https://api.open-meteo.com/v1/forecast?latitude=47.3922&longitude=8.5180&current=temperature_2m,apparent_temperature,precipitation,weather_code&minutely_15=precipitation&hourly=precipitation_probability&forecast_days=1&timezone=Europe%2FZurich&models=meteoswiss_icon_ch1

# Radar-Framelisten (Fallback-Quelle)
https://api.rainviewer.com/public/weather-maps.json

# Basiskarten-Kachel (muss ein Bild zeigen, kein Fehler)
https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/11/1069/722.jpeg
```

Hinweis zum Wettermodell: Open-Meteo führt die MeteoSwiss-Modelle unter
`meteoswiss_icon_ch1` / `meteoswiss_icon_ch2` (nicht `icon_ch1` — das ist der
DWD-Namensraum). Die Seite probiert die Modelle der Reihe nach durch und
schreibt das tatsächlich verwendete in die Wetterzeile, damit ein stiller
Rückfall auf ein Nicht-MeteoSwiss-Modell sichtbar bleibt.

## Ergebnis der Vorab-Verifikation (offene Punkte aus dem Projektauftrag)

**Haltestellen-IDs:** Werden zur Laufzeit über
`transport.opendata.ch/v1/locations` aufgelöst und in `localStorage` gecacht —
robuster als hartcodierte IDs. Die Suchbegriffe stehen in `CONFIG.stops`
(`"Zürich, Fischerweg"`, `"Zürich, Escher-Wyss-Platz"`, `"Zürich Hardbrücke"`;
Escher-Wyss-Platz ist extern als Didok 8580522 bestätigt). Für die Hardbrücke
wird der Bahnhof verwendet und per Kategorie-Filter auf Züge (S/IR/RE/IC/EC)
eingeschränkt.

**MeteoSwiss-Radar via geo.admin.ch WMS:** Ein öffentlicher WMS-Layer mit dem
*Live-Radarbild* liess sich **nicht bestätigen** — die öffentlichen
`ch.meteoschweiz.*`-Layer auf `wms.geo.admin.ch` sind Stations-Messwerte
(z.B. `messwerte-niederschlag-10min`), das eigentliche Radar existiert nur als
CORS-lose, undokumentierte JSON-API der MeteoSwiss-Website bzw. als
OGD-Rohdaten (GeoTIFF). Lösung im Frontend:

1. Die Seite **probt zur Laufzeit** die in `CONFIG.wmsRadarCandidates`
   hinterlegten Layernamen per GetMap-Bildtest (kein CORS nötig). Sobald ein
   korrekter Layername bekannt ist, genügt ein Eintrag dort — kein weiterer
   Codeeingriff.
2. Schlägt das fehl, kommt automatisch der **RainViewer-Fallback** (gratis,
   ohne Key, CORS-offen) mit animierter letzter Stunde + 30 min Nowcast. Die
   Radar-Quelle wird in der Fusszeile transparent ausgewiesen.

**RainViewer und Zoomstufen:** Der freie RainViewer-Dienst liefert
Radarkacheln nur **bis Zoomstufe 7**; ab Stufe 8 kommt statt Daten ein
Platzhalterbild ("Zoom Level Not Supported"), das sich über die Karte legt.
Die Karte läuft trotzdem auf Zoom 9 — Leaflet skaliert die Stufe-7-Kacheln
hoch, was bei der Auflösung der Radardaten (~1 km) kaum auffällt.

Zusätzlich prüft die Seite beim Start, ob die eingestellte Stufe wirklich
Daten liefert, falls sich das Limit einmal ändert: Das Platzhalterbild ist
für jede Kachel byte-identisch und deutlich grösser als eine leere,
regenfreie Kachel — zwei verschiedene Kacheln mit exakt gleicher Grösse sind
also der Platzhalter. Geprüft wird von scharf nach grob
(`CONFIG.radarZoomCandidates`); greift keine Stufe, bleibt das Radar
abgeschaltet statt Platzhalter anzuzeigen. Die gewählte Stufe steht im
Diagnose-Overlay (Taste `d`), z.B. `RainViewer · 10 Bilder · Zoom 7`.

**CORS/Proxy:** Kein Proxy nötig. Kartenkacheln laden als `<img>` (CORS
irrelevant); transport.opendata.ch, Open-Meteo und RainViewer senden
`Access-Control-Allow-Origin: *`.

## Tagesverlauf im Wetter

Der Stundenstreifen reicht bis zum Ende des Tages (`CONFIG.dayEndHour`,
Standard 23 Uhr), begrenzt durch `forecastHoursMin` / `forecastHoursMax`:

- **Morgens** steht der ganze Arbeitstag da (07:00 bis 23:00 = 17 Spalten).
- **Abends** würde bis Tagesende zu wenig übrig bleiben, deshalb läuft der
  Streifen in den nächsten Tag hinein — mindestens 9 Spalten. Der
  Tageswechsel ist mit einer Trennlinie und einem `→` markiert.
- Die erste Spalte ist immer die **laufende** Stunde, beschriftet mit
  „jetzt".

Bei mehr als 13 Spalten werden die Wettersymbole automatisch kleiner
gezeichnet, damit nichts überläuft.

## Radar-Zeitumfang

Die Animation spielt Vergangenheit und Prognose in einem Durchlauf:

- **Vergangenheit:** RainViewer liefert Bilder im 10-Minuten-Takt, rund
  2 Stunden zurück. `CONFIG.radarPastFrames` steuert, wie viele davon
  gezeigt werden — Standard **2**, also nur ein kurzer Anlauf (10 Minuten
  davor plus aktuelles Bild). Für den Blick im Vorbeigehen zählt, was
  kommt; auf 12 gestellt zeigt es stattdessen die vollen 2 Stunden.
- **Zukunft:** bis zu 3 Prognosebilder, also rund **30 Minuten voraus** —
  mehr gibt der freie Dienst nicht her. Abschaltbar über
  `CONFIG.radarNowcast: false`, dann läuft nur der Verlauf.

Auf dem letzten, am weitesten vorausschauenden Bild bleibt die Animation
kurz stehen (`CONFIG.radarHoldMs`) — das ist die Aussage, die man im
Vorbeigehen mitnimmt.

Prognosebilder sind im Label als „Prognose" markiert und blau eingefärbt.
Im Diagnose-Overlay steht die tatsächliche Aufteilung, z.B.
`RainViewer · 12 Verlauf + 3 Prognose · Zoom 7`.

## Basiskarte

`CONFIG.basemap` wählt die swisstopo-Karte:

| Wert | Karte |
|---|---|
| `farbe` (Standard) | Landeskarte in Farbe — Wald grün, Seen blau, Siedlung grau |
| `grau` | neutrale Graustufen, Radar hebt sich am stärksten ab |
| `luftbild` | Satellitenbild (SWISSIMAGE) |

`CONFIG.basemapSaturation` regelt die Farbstärke: `1` = Originalfarben von
swisstopo, darunter blasser, darüber kräftiger (Standard `1.15`). Der Filter
hängt gezielt am Kachel-Container der Basiskarte, nicht am gemeinsamen
Layer-Pane — die Radarflächen darüber bleiben also unverfälscht.

Die farbige Landeskarte bringt swisstopos eigene Symbolik mit: **orange**
Linien sind Autobahnen, **gelb** Hauptstrassen, **violett** gestrichelt die
Kantons- und Landesgrenzen, schwarz die Bahnlinien. Das sind Kartenzeichen,
keine Wetterdaten. Wer es ruhiger mag, nimmt `basemap: "grau"` — dann hebt
sich das Radar am stärksten ab.

**Leere Karte:** Liegt im Ausschnitt gar kein Niederschlag, blendet die
Seite den Hinweis „Aktuell kein Niederschlag im Kartenausschnitt" ein. Ohne
ihn ist eine regenfreie Karte nicht von einer defekten zu unterscheiden.
Erkannt wird das über die Kachelgrösse: eine vollständig transparente
Radarkachel ist nur wenige hundert Byte gross, eine mit Regenflächen ein
Vielfaches davon (`CONFIG.emptyTileMaxBytes`).

## Standort und Datenschutz

Der blaue Punkt auf der Karte, der Kartenausschnitt und der Ort der
Wetterabfrage kommen **ausschliesslich aus `CONFIG.home`** — festen
Koordinaten im Code. Die Seite fragt **keine Standortfreigabe** an, nutzt
keine Geolocation-API und misst keine Position. Sie weiss nur, was dort
eingetragen ist. Für einen anderen Aufstellort einfach die beiden Werte
ändern.

Es werden ausserdem keine Personendaten verarbeitet, keine Cookies gesetzt
und nichts an Dritte gemeldet; die Seite ruft nur die oben genannten
öffentlichen Datenquellen ab. Einziger lokaler Speicher: die aufgelösten
Haltestellen-IDs im `localStorage`, damit die Suche nicht bei jedem Start
neu laufen muss.

## Konfiguration

Alles Wesentliche steht im `CONFIG`-Block am Anfang des `<script>` in
`index.html`: Haltestellen, Standort-Koordinaten, Aktualisierungsintervalle,
Schwellwerte für gelb (ab +2 min) und rot (ab +5 min), Radar-Layer-Kandidaten.

Hinweis Rate-Limit: 3 Haltestellen × 1 Abfrage/min ≈ 4300 Requests/Tag an
transport.opendata.ch. Falls das API-Limit greift, `refreshOevMs` erhöhen
(z.B. auf 90 000).

## Ausbaustufe (später)

- Backend + DB für Verspätungs-Statistik über Zeit (unzuverlässigste
  Linie/Anschluss), containerisiert.
- Echtes MeteoSwiss-Radar über einen kleinen Proxy (umgeht fehlendes CORS der
  MeteoSwiss-JSON-API) oder über die MeteoSwiss-OGD-Radarprodukte.
