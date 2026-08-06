/* =========================================================================
 * Prüfskript für die Datenquellen der Infotafel.
 *
 * ANWENDUNG
 *   1. index.html im Browser öffnen
 *   2. F12 drücken -> Reiter "Console"
 *   3. Den gesamten Inhalt dieser Datei hineinkopieren und Enter drücken
 *
 * Warum in der Konsole der Seite und nicht mit curl: Der Browser wendet
 * dort dieselben CORS-Regeln an wie im echten Betrieb. Was hier
 * funktioniert, funktioniert auch auf der Tafel — und umgekehrt.
 *
 * Das Skript verändert nichts, es liest nur und gibt aus.
 * ========================================================================= */
(async () => {
  const HOME = { lat: 47.393274, lon: 8.513272 };   // Rezeption, Zürich West
  const fmt = (ms) => new Date(ms).toLocaleTimeString("de-CH",
    { hour: "2-digit", minute: "2-digit" });
  const rel = (ms) => {
    const m = Math.round((ms - Date.now()) / 60000);
    return (m >= 0 ? "+" : "") + m + " min";
  };
  const line = (t) => console.log("\n=== " + t + " " + "=".repeat(Math.max(0, 56 - t.length)));

  /* ---------------------------------------------------------------- Radar */
  line("RAINVIEWER RADAR");
  try {
    const cfg = await (await fetch("https://api.rainviewer.com/public/weather-maps.json",
      { cache: "no-store" })).json();

    console.log("Host:", cfg.host, "| Daten generiert:", fmt(cfg.generated * 1000),
      "(" + rel(cfg.generated * 1000) + ")");

    const past = cfg.radar?.past || [];
    const nowcast = cfg.radar?.nowcast || [];

    console.log(`\nVergangenheit: ${past.length} Bilder`);
    console.table(past.map((f) => ({ Zeit: fmt(f.time * 1000), Relativ: rel(f.time * 1000) })));

    console.log(`Prognose: ${nowcast.length} Bilder`);
    if (nowcast.length) {
      console.table(nowcast.map((f) => ({ Zeit: fmt(f.time * 1000), Relativ: rel(f.time * 1000) })));
      const ahead = Math.round((nowcast[nowcast.length - 1].time * 1000 - Date.now()) / 60000);
      console.log(ahead > 0
        ? `➜ Prognose reicht ${ahead} Minuten in die Zukunft.`
        : `➜ PROBLEM: Die weiteste Prognose liegt ${-ahead} Minuten in der VERGANGENHEIT. `
          + `RainViewers Radarbilder hinken so weit nach, dass die Vorhersage aufgebraucht ist.`);
    } else {
      console.log("➜ PROBLEM: RainViewer liefert gerade gar keine Prognosebilder.");
    }

    /* Kachelgrössen je Zoomstufe. Deutung:
     *   ~100-400 Byte  = leere Kachel, dort fällt kein Niederschlag
     *   mehrere KB     = Kachel mit Regenflächen
     *   bei allen Kacheln exakt gleich und > 1500 Byte = Platzhalterbild
     *                    "Zoom Level Not Supported"                        */
    const tileXY = (z) => {
      const n = 2 ** z, r = (HOME.lat * Math.PI) / 180;
      return {
        x: Math.floor(((HOME.lon + 180) / 360) * n),
        y: Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n),
      };
    };
    const newest = past[past.length - 1];
    if (newest) {
      console.log("\nKachelgrössen für das jüngste Radarbild (Zürich):");
      for (const z of [5, 6, 7, 8, 9]) {
        const t = tileXY(z);
        const url = `${cfg.host}${newest.path}/256/${z}/${t.x}/${t.y}/2/1_1.png`;
        const url2 = `${cfg.host}${newest.path}/256/${z}/${t.x + 1}/${t.y + 1}/2/1_1.png`;
        try {
          const [a, b] = await Promise.all([fetch(url, { cache: "no-store" }),
                                           fetch(url2, { cache: "no-store" })]);
          const [sa, sb] = [(await a.blob()).size, (await b.blob()).size];
          const platzhalter = sa === sb && sa > 1500;
          console.log(`  Zoom ${z}: ${sa} / ${sb} Byte`
            + (platzhalter ? "  ➜ PLATZHALTER (Zoomstufe nicht unterstützt)"
               : sa < 800 && sb < 800 ? "  ➜ leer (kein Niederschlag)" : "  ➜ Radardaten vorhanden"));
        } catch (e) {
          console.log(`  Zoom ${z}: nicht lesbar (${e.message}) — vermutlich fehlendes CORS`);
        }
      }
    }
  } catch (e) {
    console.error("RainViewer nicht erreichbar:", e.message);
  }

  /* ------------------------------------------------------------------- ÖV */
  line("ÖV-HALTESTELLEN");
  for (const q of ["Zürich, Fischerweg", "Zürich, Escher-Wyss-Platz", "Zürich Hardbrücke"]) {
    try {
      const loc = await (await fetch(
        "https://transport.opendata.ch/v1/locations?query=" + encodeURIComponent(q))).json();
      const st = (loc.stations || []).find((s) => s.id);
      if (!st) { console.log(`${q}: KEINE Station gefunden`); continue; }

      const board = await (await fetch(
        `https://transport.opendata.ch/v1/stationboard?id=${st.id}&limit=8`)).json();
      const rows = (board.stationboard || []).map((j) => ({
        Linie: (j.category || "") + (j.number || ""),
        Ziel: j.to,
        Plan: fmt(j.stop.departureTimestamp * 1000),
        "Versp.": j.stop.delay ?? 0,
      }));
      console.log(`\n${q}  ->  gefunden: "${st.name}" (ID ${st.id}), ${rows.length} Abfahrten`);
      console.table(rows);
    } catch (e) {
      console.error(`${q}: Fehler —`, e.message);
    }
  }

  /* --------------------------------------------------------------- Wetter */
  line("WETTER (Open-Meteo / MeteoSwiss)");
  const base = "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${HOME.lat}&longitude=${HOME.lon}`
    + "&current=temperature_2m,precipitation,weather_code"
    + "&minutely_15=precipitation&hourly=precipitation_probability"
    + "&forecast_days=1&timezone=Europe%2FZurich";
  for (const m of ["meteoswiss_icon_ch1", "meteoswiss_icon_ch2", null]) {
    try {
      const resp = await fetch(base + (m ? "&models=" + m : ""), { cache: "no-store" });
      if (!resp.ok) { console.log(`Modell ${m || "(automatisch)"}: HTTP ${resp.status} — nicht verfügbar`); continue; }
      const d = await resp.json();
      console.log(`Modell ${m || "(automatisch)"}: OK — ${d.current.temperature_2m} °C, `
        + `Niederschlag ${d.current.precipitation} mm/h, Code ${d.current.weather_code}`);
    } catch (e) {
      console.log(`Modell ${m || "(automatisch)"}: Fehler — ${e.message}`);
    }
  }

  /* --------------------------------------------------------------- Karten */
  line("KARTENKACHELN (swisstopo)");
  for (const layer of ["ch.swisstopo.pixelkarte-farbe", "ch.swisstopo.pixelkarte-grau"]) {
    const url = `https://wmts.geo.admin.ch/1.0.0/${layer}/default/current/3857/9/268/179.jpeg`;
    await new Promise((done) => {
      const img = new Image();
      img.onload = () => { console.log(`${layer}: OK (${img.width}x${img.height})`); done(); };
      img.onerror = () => { console.log(`${layer}: FEHLER — Kachel lädt nicht`); done(); };
      img.src = url;
    });
  }

  line("FERTIG");
})();
