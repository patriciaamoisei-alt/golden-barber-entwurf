// Terminbuchung in vier Schritten: Leistung → Barber → Zeit → Daten → Bestätigung.
import { SALON, SERVICES, SERVICE_GROUPS, TEAM, DAY_SHORT, MONTHS, MONTH_SHORT, serviceById, barberById, fmtTime, fmtDur, fmtPrice, toKey, fromKey, addDays, relDay, fmtDateLong } from "./data.js";
import { getSlots, getSlotsAny, nextFree, dayHasSlots, createBooking, setStatus, icsFor, HORIZON_DAYS } from "./store.js";

const root = document.getElementById("booking");
const PLANITY = document.documentElement.classList.contains("var-a");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CHANNEL = { sms: "SMS", whatsapp: "WhatsApp", email: "E-Mail" };

const fresh = () => ({ step: 1, serviceId: null, barberId: null, date: null, start: null, assigned: null, week: 0, hold: null, note: "", form: { name: "", phone: "", email: "", channel: "sms", review: false }, errors: {}, result: null, tab: "kunde", cancelled: false });
let st = fresh();

const service = () => serviceById(st.serviceId);
const dur = () => service()?.dur ?? 30;
const realBarber = () => (st.barberId === "any" ? st.assigned : st.barberId);

function go(step, { focus = true } = {}) {
  st.step = step;
  render();
  if (focus) root.querySelector(".bk-title")?.focus({ preventScroll: true });
}

/* ---------- Seitenleiste ---------- */
function sidebar() {
  const s = service();
  const b = st.barberId === "any" ? (st.assigned ? `${barberById(st.assigned).name} (nächster freier)` : "Egal, wer") : st.barberId ? barberById(st.barberId).name : "";
  const when = st.date && st.start != null ? `${relDay(fromKey(st.date))}, ${fmtTime(st.start)} Uhr` : "";
  const items = [
    ["Leistung", s ? s.name : ""],
    ["Barber", b],
    ["Datum & Uhrzeit", when],
    ["Deine Daten", st.step === 5 ? esc(st.form.name) : ""],
  ];
  const steps = items
    .map(([t, v], i) => {
      const n = i + 1;
      const done = st.step > n || st.step === 5;
      const cls = st.step === n ? "is-now" : done ? "is-done" : "";
      const can = done && st.step !== 5;
      return `<button class="bk-step ${cls}" type="button" data-goto="${n}" ${can ? "" : "disabled"} ${st.step === n ? 'aria-current="step"' : ""}>
        <span class="bk-step__n">${done ? "✓" : n}</span>
        <span class="bk-step__t">${t}<span class="bk-step__v">${v}</span></span></button>`;
    })
    .join("");
  return `<aside class="bk-sum" aria-label="Deine Auswahl"><div class="bk-steps">${steps}</div>
    <div class="bk-total"><span>Preis vor Ort</span><b>${s ? fmtPrice(s.price) : "–"}</b></div></aside>`;
}

/* ---------- Schritt 1: Leistung ---------- */
function paneService() {
  const groups = SERVICE_GROUPS.map((g) => {
    const items = SERVICES.filter((s) => s.group === g.id)
      .map((s) => `<button class="opt" type="button" data-service="${s.id}" aria-pressed="${st.serviceId === s.id}">
        <span class="opt__name">${s.name}</span><span class="opt__price">${fmtPrice(s.price)}</span>
        <span class="opt__meta">${fmtDur(s.dur)}${s.detail ? " · " + s.detail : ""}</span></button>`)
      .join("");
    return `<div><p class="bk-grp__t">${g.title}</p><div class="bk-grp__items">${items}</div></div>`;
  }).join("");
  return `<h3 class="bk-title" tabindex="-1">Was darf es sein?</h3>
    <p class="bk-sub">Wähle eine Leistung. Barber und Uhrzeit kommen danach.</p>
    ${st.note ? `<p class="bk-note">${st.note}</p>` : ""}
    <div class="bk-list">${groups}</div>`;
}

/* ---------- Schritt 2: Barber ---------- */
function paneBarber() {
  const label = (id) => {
    const nf = nextFree(id, dur(), 1)[0];
    return nf ? `Frei: ${relDay(fromKey(nf.date))} ${fmtTime(nf.start)}` : "Ausgebucht";
  };
  const cards = TEAM.map((t) => `<button class="who" type="button" data-barber="${t.id}" aria-pressed="${st.barberId === t.id}">
      ${t.avatar ? `<img class="who__av" src="${t.avatar}" alt="" width="76" height="76" loading="lazy">` : `<span class="who__av" aria-hidden="true">${t.name[0]}</span>`}
      <span class="who__name">${t.name}</span><span class="who__next">${label(t.id)}</span></button>`).join("");
  return `<h3 class="bk-title" tabindex="-1">Zu wem möchtest du?</h3>
    <p class="bk-sub">Jeder Barber hat seinen eigenen Kalender. Du siehst nur Zeiten, die wirklich frei sind.</p>
    <div class="bk-barbers">
      <button class="who" type="button" data-barber="any" aria-pressed="${st.barberId === "any"}">
        <span class="who__av" aria-hidden="true">✦</span><span class="who__name">Egal, wer</span><span class="who__next">Schnellster Termin</span></button>
      ${cards}
    </div>
    <div class="bk-nav"><button class="bk-back" type="button" data-goto="1">← Leistung ändern</button></div>`;
}

/* ---------- Schritt 3: Datum & Uhrzeit ---------- */
function firstOpenDate() {
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const k = toKey(addDays(new Date(), i));
    if (dayHasSlots(st.barberId, k, dur())) return { key: k, index: i };
  }
  return null;
}

function paneTime() {
  if (!st.date) {
    const f = firstOpenDate();
    if (f) {
      st.date = f.key;
      st.week = Math.floor(f.index / 7);
    }
  }
  const today = new Date();
  const weekStart = addDays(today, st.week * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayBtns = days
    .map((d) => {
      const k = toKey(d);
      const ok = dayHasSlots(st.barberId, k, dur());
      return `<button class="day" type="button" data-date="${k}" aria-pressed="${st.date === k}" ${ok ? "" : "disabled"} aria-label="${fmtDateLong(d)}${ok ? "" : ", keine freien Termine"}">
        <span class="day__w">${DAY_SHORT[d.getDay()]}</span><span class="day__d">${d.getDate()}</span><span class="day__m">${MONTH_SHORT[d.getMonth()]}</span></button>`;
    })
    .join("");

  const list = st.date ? (st.barberId === "any" ? getSlotsAny(st.date, dur()) : getSlots(st.barberId, st.date, dur()).map((s) => ({ start: s, barberId: st.barberId }))) : [];
  const parts = [
    ["Vormittag", list.filter((s) => s.start < 720)],
    ["Nachmittag", list.filter((s) => s.start >= 720 && s.start < 1020)],
    ["Abend", list.filter((s) => s.start >= 1020)],
  ].filter(([, l]) => l.length);
  let i = 0;
  const slots = parts.length
    ? parts.map(([t, l]) => `<div><p class="bk-slots__t">${t}</p><div class="bk-slots__g">${l.map((s) => `<button class="slot" type="button" style="--i:${i++}" data-start="${s.start}" data-b="${s.barberId}" aria-pressed="${st.start === s.start}" aria-label="${fmtTime(s.start)} Uhr${st.barberId === "any" ? " bei " + barberById(s.barberId).name : ""}"><span>${fmtTime(s.start)}${st.barberId === "any" ? `<small>${barberById(s.barberId).name}</small>` : ""}</span></button>`).join("")}</div></div>`).join("")
    : `<div class="bk-empty">An diesem Tag ist nichts mehr frei. <button type="button" data-week="1">Nächste Woche ansehen</button></div>`;

  const who = st.barberId === "any" ? "dem nächsten freien Barber" : barberById(st.barberId).name;
  const sel = st.date ? fromKey(st.date) : weekStart;
  return `<h3 class="bk-title" tabindex="-1">Wann passt es dir?</h3>
    <p class="bk-sub">${service().name} bei ${who} · ${fmtDur(dur())}</p>
    ${st.note ? `<p class="bk-note">${st.note}</p>` : ""}
    <p class="bk-month">${MONTHS[sel.getMonth()]} ${sel.getFullYear()}</p>
    <div class="bk-days">
      <button class="bk-days__arrow" type="button" data-week="-1" ${st.week === 0 ? "disabled" : ""} aria-label="Vorherige Woche">←</button>
      <div class="bk-days__row">${dayBtns}</div>
      <button class="bk-days__arrow" type="button" data-week="1" ${st.week >= Math.floor(HORIZON_DAYS / 7) - 1 ? "disabled" : ""} aria-label="Nächste Woche">→</button>
    </div>
    <div class="bk-slots">${slots}</div>
    <div class="bk-nav"><button class="bk-back" type="button" data-goto="2">← Barber ändern</button>
      <button class="btn btn--gold" type="button" data-goto="4" ${st.start == null ? "disabled" : ""}>Weiter</button></div>`;
}

/* ---------- Schritt 4: Daten ---------- */
function paneForm() {
  const f = st.form, e = st.errors;
  const fld = (id, label, type, auto, ph, full = false) => `<div class="fld ${full ? "fld--full" : ""}"><label for="bk-${id}">${label}</label>
    <input id="bk-${id}" name="${id}" type="${type}" autocomplete="${auto}" placeholder="${ph}" value="${esc(f[id])}" ${e[id] ? `aria-invalid="true" aria-describedby="bk-${id}-err"` : ""} ${type === "tel" ? 'inputmode="tel"' : ""}>
    <span class="fld__err" id="bk-${id}-err">${e[id] || ""}</span></div>`;
  const b = barberById(realBarber());
  return `<h3 class="bk-title" tabindex="-1">Fast geschafft.</h3>
    <p class="bk-sub">${service().name} bei ${b.name} · ${fmtDateLong(fromKey(st.date))}, ${fmtTime(st.start)} Uhr</p>
    <form class="bk-form" id="bkForm" novalidate>
      ${fld("name", "Vor- und Nachname", "text", "name", "Max Mustermann")}
      ${fld("phone", "Handynummer", "tel", "tel", "0151 2345678")}
      ${fld("email", `E-Mail${f.channel === "email" ? "" : " (optional)"}`, "email", "email", "max@beispiel.de", true)}
      <fieldset class="fld fld--full"><legend>Bestätigung und Erinnerung per</legend>
        <div class="seg">${Object.entries(CHANNEL).map(([k, v]) => `<label><input type="radio" name="channel" value="${k}" ${f.channel === k ? "checked" : ""}>${v}</label>`).join("")}</div>
      </fieldset>
      <label class="chk fld--full"><input type="checkbox" name="review" ${f.review ? "checked" : ""}>
        <span>Ja, schickt mir nach dem Termin einmalig einen Link für eine Google-Bewertung. Freiwillig und jederzeit widerrufbar.</span></label>
      <p class="bk-legal">Wir nutzen deine Angaben nur, um den Termin zu organisieren: Bestätigung sofort, Erinnerung vor dem Termin. Mehr dazu in der <a href="datenschutz.html">Datenschutzerklärung</a>.</p>
      <div class="bk-nav fld--full"><button class="bk-back" type="button" data-goto="3">← Zeit ändern</button>
        <button class="btn btn--gold" type="submit">Termin buchen</button></div>
    </form>`;
}

function validate() {
  const f = st.form, e = {};
  if (f.name.trim().length < 2) e.name = "Bitte gib deinen Namen ein.";
  if (!/^[+0][\d\s/()-]{6,}$/.test(f.phone.trim())) e.phone = "Bitte gib eine gültige Handynummer ein, z. B. 0151 2345678.";
  const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim());
  if (f.channel === "email" && !mailOk) e.email = "Für die Bestätigung per E-Mail brauchen wir deine Adresse.";
  else if (f.email.trim() && !mailOk) e.email = "Diese E-Mail-Adresse sieht nicht richtig aus.";
  st.errors = e;
  return !Object.keys(e).length;
}

/* ---------- Schritt 5: Bestätigung ---------- */
function paneDone() {
  const { booking: b, notifications } = st.result;
  const s = serviceById(b.serviceId), barber = barberById(b.barberId);
  const first = esc(b.name.trim().split(/\s+/)[0]);
  const now = Date.now();
  const msgs = notifications.filter((n) => n.to === st.tab);
  const bubbles = msgs
    .map((n, i) => {
      const sent = n.at <= now + 1000;
      return `<div class="msg ${sent ? "" : "msg--plan"}" style="--i:${i}"><p class="msg__when"><span>${n.label} · ${n.channel}</span><b>${sent ? "✓ gesendet" : "geplant"}</b></p><p class="msg__txt">${esc(n.text)}</p></div>`;
    })
    .join("");
  const head = st.cancelled
    ? `<h3 class="bk-title" tabindex="-1">Termin abgesagt.</h3><p class="bk-sub">Der Platz ist wieder frei. Du kannst jederzeit neu buchen.</p>`
    : `<div class="seal">${CHECK}</div><h3 class="bk-title" tabindex="-1" style="margin-top:18px">Gebucht, ${first}.</h3>
       <p class="bk-sub">Die Bestätigung ist per ${CHANNEL[b.channel]} unterwegs. Wir freuen uns auf dich.</p>`;
  return `<div class="bk-done"><div>${head}
      <dl class="ticket">
        <div class="ticket__row"><dt>Leistung</dt><dd>${s.name} · ${fmtDur(s.dur)}</dd></div>
        <div class="ticket__row"><dt>Barber</dt><dd>${barber.name}</dd></div>
        <div class="ticket__row"><dt>Wann</dt><dd><b>${fmtDateLong(fromKey(b.date))}, ${fmtTime(b.start)} Uhr</b></dd></div>
        <div class="ticket__row"><dt>Wo</dt><dd>${SALON.street}, ${SALON.zip} ${SALON.city}</dd></div>
        <div class="ticket__row"><dt>Preis</dt><dd>${fmtPrice(s.price)} · Zahlung im Salon</dd></div>
        <div class="ticket__row"><dt>Code</dt><dd>${b.code}</dd></div>
      </dl>
      <div class="bk-actions">
        ${st.cancelled ? "" : `<button class="btn btn--gold" type="button" data-ics>In Kalender eintragen</button>`}
        <button class="btn btn--line" type="button" data-again>${st.cancelled ? "Neuen Termin buchen" : "Weiteren Termin buchen"}</button>
        ${st.cancelled ? "" : `<button class="bk-link" type="button" data-cancel>Termin absagen</button>`}
      </div></div>
    <div class="flow" aria-label="Automatische Nachrichten zu diesem Termin">
      <p class="flow__t">Das passiert jetzt automatisch</p>
      <div class="phone">
        <div class="phone__bar" role="tablist">
          <button class="phone__tab" role="tab" type="button" data-tab="kunde" aria-selected="${st.tab === "kunde"}">Kunde</button>
          <button class="phone__tab" role="tab" type="button" data-tab="barber" aria-selected="${st.tab === "barber"}">${barber.name}</button>
        </div>
        <div class="phone__body" role="tabpanel">${bubbles || `<p class="bk-sub">Keine weiteren Nachrichten geplant.</p>`}</div>
      </div>
    </div></div>`;
}

function render() {
  const pane = [null, paneService, paneBarber, paneTime, paneForm, paneDone][st.step]();
  root.innerHTML = `${sidebar()}<div class="bk-main"><div class="bk-pane">${pane}</div></div>`;
}

/* ---------- Ereignisse ---------- */
function pickService(id) {
  st.serviceId = id;
  st.note = "";
  const d = dur();
  if (st.hold) {
    const h = st.hold;
    st.barberId = h.barberId;
    if (h.start != null && getSlots(h.barberId, h.date, d).includes(h.start)) {
      Object.assign(st, { date: h.date, start: h.start, assigned: h.barberId, hold: null });
      return go(4);
    }
    if (h.start != null) st.note = "Die vorgemerkte Uhrzeit reicht für diese Leistung nicht aus. Such dir eine andere Zeit aus.";
    Object.assign(st, { date: null, start: null, hold: null });
    return go(3);
  }
  // Auswahl bleibt nur gültig, wenn der Termin auch für die neue Dauer frei ist
  if (st.barberId && st.date && st.start != null) {
    const b = realBarber();
    if (!getSlots(b, st.date, d).includes(st.start)) st.start = null;
  }
  go(st.barberId ? 3 : 2);
}

root.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t || t.disabled) return;
  if (t.dataset.service) return pickService(t.dataset.service);
  if (t.dataset.barber) {
    Object.assign(st, { barberId: t.dataset.barber, date: null, start: null, assigned: null, week: 0, note: "" });
    return go(3);
  }
  if (t.dataset.date) {
    Object.assign(st, { date: t.dataset.date, start: null, note: "" });
    return go(3, { focus: false });
  }
  if (t.dataset.start) {
    st.start = Number(t.dataset.start);
    st.assigned = t.dataset.b;
    root.querySelectorAll(".slot").forEach((el) => el.setAttribute("aria-pressed", String(el === t)));
    root.querySelector('.bk-nav [data-goto="4"]').disabled = false;
    root.querySelector(".bk-sum").outerHTML = sidebar();
    return;
  }
  if (t.dataset.week) {
    st.week = Math.max(0, st.week + Number(t.dataset.week));
    const ws = addDays(new Date(), st.week * 7);
    const firstOk = Array.from({ length: 7 }, (_, i) => toKey(addDays(ws, i))).find((k) => dayHasSlots(st.barberId, k, dur()));
    Object.assign(st, { date: firstOk || toKey(ws), start: null });
    return go(3, { focus: false });
  }
  if (t.dataset.goto) return go(Number(t.dataset.goto));
  if (t.dataset.tab) {
    st.tab = t.dataset.tab;
    return go(5, { focus: false });
  }
  if ("ics" in t.dataset) {
    const blob = new Blob([icsFor(st.result.booking)], { type: "text/calendar" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "termin-the-golden-barber.ics" });
    a.click();
    return setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  if ("cancel" in t.dataset) {
    setStatus(st.result.booking.id, "cancelled");
    st.cancelled = true;
    st.result.notifications = st.result.notifications.filter((n) => n.at <= Date.now());
    window.dispatchEvent(new CustomEvent("gb:booked"));
    return go(5);
  }
  if ("again" in t.dataset) {
    st = fresh();
    return go(1);
  }
});

root.addEventListener("input", (e) => {
  const el = e.target;
  if (!el.name) return;
  if (el.type === "checkbox") st.form[el.name] = el.checked;
  else st.form[el.name] = el.value;
  if (el.name === "channel") {
    const lab = root.querySelector('label[for="bk-email"]');
    if (lab) lab.textContent = `E-Mail${el.value === "email" ? "" : " (optional)"}`;
  }
});

root.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validate()) {
    render();
    root.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  const f = st.form;
  const res = createBooking({ serviceId: st.serviceId, barberId: realBarber(), date: st.date, start: st.start, name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), channel: f.channel, reviewOptIn: f.review });
  if (!res.ok) {
    Object.assign(st, { start: null, note: "Diese Uhrzeit wurde gerade eben vergeben. Bitte wähle eine andere." });
    return go(3);
  }
  st.result = res;
  window.dispatchEvent(new CustomEvent("gb:booked"));
  go(5);
});

// Einstieg von außen: Preisliste, Team-Karten, „Nächste freie Termine“
window.addEventListener("gb:prefill", ({ detail = {} }) => {
  if (PLANITY) return;
  if (st.step === 5) st = fresh();
  const { serviceId, barberId, date, start } = detail;
  st.note = "";
  if (serviceId) {
    st.serviceId = serviceId;
    if (st.start != null && !getSlots(realBarber(), st.date, dur()).includes(st.start)) st.start = null;
    return go(st.barberId ? 3 : 2, { focus: false });
  }
  if (barberId) {
    const name = barberById(barberId).name;
    if (start != null) {
      if (st.serviceId && getSlots(barberId, date, dur()).includes(start)) {
        Object.assign(st, { barberId, date, start, assigned: barberId });
        return go(4, { focus: false });
      }
      st.hold = { barberId, date, start };
      st.note = `<b>${name} · ${relDay(fromKey(date))}, ${fmtTime(start)} Uhr</b> ist vorgemerkt. Wähle noch deine Leistung.`;
      return go(1, { focus: false });
    }
    Object.assign(st, { barberId, date: null, start: null, assigned: null, week: 0 });
    if (st.serviceId) return go(3, { focus: false });
    st.hold = { barberId, date: null, start: null };
    st.note = `Barber: <b>${name}</b>. Wähle noch deine Leistung.`;
    return go(1, { focus: false });
  }
  go(st.step, { focus: false });
});

/* ---------- Variante A: Übergabe an Planity ---------- */
function renderPlanity() {
  document.getElementById("bookTitle").innerHTML = 'Dein Termin. <em class="gold nb">Über Planity.</em>';
  document.getElementById("bookLead").textContent = "Rund um die Uhr buchbar. Die Buchung öffnet sich bei unserem Partner Planity.";
  const rows = SERVICES.slice(0, 4).map((s) => `<div class="pl__row"><span>${s.name}</span><em>${fmtDur(s.dur)} · ${fmtPrice(s.price)}</em><b>Auswählen</b></div>`).join("");
  root.innerHTML = `<div class="pl">
    <div class="pl__info">
      <h3 class="bk-title">Buchen bei Planity</h3>
      <p class="bk-sub">Unsere Termine laufen über Planity. Dort wählst du Leistung, Barber und Uhrzeit.</p>
      <ol class="pl__steps">
        <li><b>Planity öffnen</b><span>Die Buchungsseite öffnet sich in einem neuen Tab.</span></li>
        <li><b>Leistung, Barber und Zeit wählen</b><span>Du siehst die freien Zeiten aller vier Kalender.</span></li>
        <li><b>Bestätigung erhalten</b><span>Planity schickt dir die Bestätigung und eine Erinnerung per SMS.</span></li>
      </ol>
      <a class="btn btn--gold" href="${SALON.planity}" target="_blank" rel="noopener">Bei Planity buchen ↗</a>
      <p class="bk-legal">Für die Buchung gelten die Datenschutzbestimmungen von Planity.</p>
    </div>
    <div class="pl__mock" aria-hidden="true">
      <p class="pl__cap">So sieht der nächste Schritt aus</p>
      <div class="pl__win">
        <div class="pl__bar"><i></i><i></i><i></i><span>planity.com/de-DE/the-golden-barber-mens-salon…</span></div>
        <div class="pl__body"><p class="pl__brand">PLANITY</p><p class="pl__h">The Golden Barber – Men's Salon</p><p class="pl__s">Eine Dienstleistung auswählen</p>${rows}</div>
      </div>
    </div></div>`;
}

if (PLANITY) renderPlanity();
else render();
