// Geführte erste Partie: jeder Schritt prüft den echten Spielzustand und geht von selbst weiter.
const STEPS = [
  { t: 'Die Kamera', p: 'Bewege die Kamera mit den Pfeiltasten oder indem du die Maus an den Bildschirmrand führst. Mit dem Mausrad zoomst du.', done: (G, s) => s.camMoved },
  { t: 'Arbeiter auswählen', p: 'Klicke mit der linken Maustaste auf einen deiner Arbeiter (Spielfigur mit Werkzeug) oder ziehe einen Rahmen um mehrere.', done: G => [...G.selected].some(id => { const e = G.ents.get(id); return e && e.owner === G.you && e.def.cls === 'wrk'; }) },
  { t: 'Nahrung sammeln', p: 'Klicke mit der rechten Maustaste auf einen Beerenstrauch. Die Arbeiter sammeln und bringen die Nahrung zum Haupthaus.', hint: 'Oben links siehst du deine Vorräte.', done: (G, s) => G.me.res.food >= s.start.food + 20 },
  { t: 'Mehr Arbeiter', p: 'Wähle dein Haupthaus (Taste H) und bilde in der Befehlsleiste rechts unten einen neuen Arbeiter aus.', hint: 'Mehr Arbeiter bedeuten mehr Rohstoffe – das ist die Grundlage für alles.', done: (G, s) => count(G, e => e.def.cls === 'wrk') > s.workers },
  { t: 'Holz sammeln', p: 'Schicke einen Arbeiter per Rechtsklick zu einem Baum.', done: (G, s) => G.me.res.wood >= s.start.wood + 20 || count(G, e => e.def.kind === 'b') > s.blds },
  { t: 'Ein Haus bauen', p: 'Wähle einen Arbeiter, klicke in der Befehlsleiste auf „Haus“ und dann auf einen freien Platz. Häuser erhöhen deine Bevölkerungsgrenze.', hint: 'Mit gedrückter Umschalttaste baust du mehrere hintereinander.', done: G => count(G, e => e.def.key === 'house') > 0 },
  { t: 'Eine Kaserne bauen', p: 'Baue mit einem Arbeiter eine Kaserne. Dort bildest du Soldaten aus.', done: G => count(G, e => e.def.key === 'barracks' && e.prog >= 100) > 0 },
  { t: 'Soldaten ausbilden', p: 'Wähle die Kaserne und bilde drei Krieger aus. Mit Rechtsklick auf den Boden setzt du einen Sammelpunkt.', done: G => count(G, e => e.def.kind === 'u' && e.def.cls !== 'wrk') >= 3 },
  { t: 'Die nächste Epoche', p: 'Sammle genug Nahrung und Holz und klicke im Haupthaus auf „Aufstieg“. Jede Epoche bringt neue Gebäude und Einheiten – bis zum Kalten Krieg.', hint: 'Die Kosten siehst du, wenn du mit der Maus über den Knopf fährst.', done: G => G.me.era >= 1 || !!G.me.adv },
  { t: 'Geschafft!', p: 'Du kennst jetzt die Grundlagen. Weiter geht es mit Diplomatie (Taste P), Spionen, Eisenbahn, Schiffen und Flugzeugen – und ab Epoche VII mit Staatsführern.', hint: 'Der Bot in diesem Tutorial greift nicht an. In normalen Partien solltest du dich verteidigen!', last: true },
];
const count = (G, f) => { let n = 0; for (const e of G.ents.values()) if (e.def && e.owner === G.you && f(e)) n++; return n; };

export function createTutorial({ G, renderer, $ }) {
  const T = { active: false, i: 0, s: null };
  const box = $('tutorial');
  const render = () => {
    if (!T.active) { box.classList.add('hidden'); return; }
    const st = STEPS[T.i];
    box.innerHTML = `<div class="tut-step">Tutorial · Schritt ${T.i + 1} von ${STEPS.length}</div><h4>${st.t}</h4><p>${st.p}</p>${st.hint ? `<p class="tut-hint">${st.hint}</p>` : ''}
      <div class="tut-bar"><i style="width:${(T.i / (STEPS.length - 1)) * 100}%"></i></div>
      <div class="row">${st.last ? '<button class="btn small primary" data-tut="end">Tutorial beenden</button>' : '<button class="btn ghost small" data-tut="skip">Schritt überspringen</button><button class="btn ghost small" data-tut="end">Beenden</button>'}</div>`;
    box.classList.remove('hidden');
  };
  const snapshot = () => ({ start: { ...G.me.res }, workers: count(G, e => e.def.cls === 'wrk'), blds: count(G, e => e.def.kind === 'b'), cam: renderer ? { x: renderer.cam.x, y: renderer.cam.y } : null, camMoved: false });
  T.start = () => { T.active = true; T.i = 0; T.s = null; render(); };
  T.stop = () => { T.active = false; render(); };
  T.next = () => { if (T.i < STEPS.length - 1) { T.i++; T.s = snapshot(); render(); } };
  // jede halbe Sekunde prüfen
  setInterval(() => {
    if (!T.active || G.phase !== 'play' || !G.me) return;
    if (!T.s) T.s = snapshot();
    if (T.s.cam && renderer && Math.hypot(renderer.cam.x - T.s.cam.x, renderer.cam.y - T.s.cam.y) > 4) T.s.camMoved = true;
    const st = STEPS[T.i];
    if (st.done && st.done(G, T.s)) T.next();
  }, 500);
  box.addEventListener('click', e => { const b = e.target.closest('[data-tut]'); if (!b) return; if (b.dataset.tut === 'skip') T.next(); else T.stop(); });
  return T;
}
