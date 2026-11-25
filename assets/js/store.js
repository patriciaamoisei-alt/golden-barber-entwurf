// Buchungs-Schnittstelle der Demo.
// In der Demo liegen Termine im Browser (localStorage). Für den Live-Betrieb werden nur die
// Funktionen in diesem Modul gegen echte API-Aufrufe getauscht – Website und Kalender bleiben gleich.

import { HOURS, SERVICES, TEAM, SALON, serviceById, barberById, toKey, fromKey, addDays, fmtTime, fmtDateLong, relDay } from "./data.js";

const K_BOOK = "gb_bookings_v1";
const K_NOTE = "gb_notifications_v1";
const K_BLOCK = "gb_blocks_v1";
const SLOT = 30;
const LEAD_MIN = 30; // frühestens 30 Minuten im Voraus buchbar
export const HORIZON_DAYS = 35;

const read = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k)) || [];
  } catch {
    return [];
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* privater Modus: Demo läuft dann nur bis zum Neuladen */
  }
};

// ---- Demo-Auslastung: stabile Pseudo-Zufallswerte, damit die Kalender nicht leer aussehen ----
function rng(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_NAMES = ["Lukas M.", "Jonas K.", "Felix B.", "Maximilian S.", "Leon W.", "Paul H.", "Elias R.", "Noah F.", "Ben T.", "Finn L.", "David P.", "Tim A.", "Marco D.", "Stefan G.", "Andrei C.", "Mihai V."];
const SHORT_SERVICES = SERVICES.filter((s) => s.dur === 30 && s.price >= 17);

const demoCache = new Map();
export function demoBookings(barberId, dateKey) {
  const ck = barberId + dateKey;
  if (demoCache.has(ck)) return demoCache.get(ck);
  const date = fromKey(dateKey);
  const hours = HOURS[date.getDay()];
  const out = [];
  if (hours) {
    const r = rng(ck);
    const ahead = Math.max(0, Math.round((date - fromKey(toKey(new Date()))) / 864e5));
    const load = Math.max(0.14, 0.52 - ahead * 0.05);
    for (let t = hours[0]; t + SLOT <= hours[1]; t += SLOT) {
      if (r() < load) {
        const s = SHORT_SERVICES[Math.floor(r() * SHORT_SERVICES.length)];
        out.push({ id: `demo-${ck}-${t}`, demo: true, barberId, date: dateKey, start: t, dur: s.dur, serviceId: s.id, name: DEMO_NAMES[Math.floor(r() * DEMO_NAMES.length)], status: "confirmed", source: r() < 0.7 ? "online" : "telefon" });
      }
    }
  }
  demoCache.set(ck, out);
  return out;
}

export const getBookings = () => read(K_BOOK);
export const getBlocks = () => read(K_BLOCK);
export const getNotifications = () => read(K_NOTE);

export function dayAgenda(barberId, dateKey) {
  const own = getBookings().filter((b) => b.barberId === barberId && b.date === dateKey && b.status !== "cancelled");
  const blocks = getBlocks().filter((b) => b.barberId === barberId && b.date === dateKey).map((b) => ({ ...b, block: true }));
  // Echte Buchungen haben Vorrang vor der Demo-Auslastung
  const demo = demoBookings(barberId, dateKey).filter((d) => ![...own, ...blocks].some((o) => overlaps(d.start, d.dur, o.start, o.dur)));
  return [...demo, ...own, ...blocks].sort((a, b) => a.start - b.start);
}

const overlaps = (s1, d1, s2, d2) => s1 < s2 + d2 && s2 < s1 + d1;

export function getSlots(barberId, dateKey, dur = 30, now = new Date()) {
  const date = fromKey(dateKey);
  const hours = HOURS[date.getDay()];
  if (!hours) return [];
  const busy = dayAgenda(barberId, dateKey);
  const isToday = dateKey === toKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes() + LEAD_MIN;
  const slots = [];
  for (let t = hours[0]; t + dur <= hours[1]; t += SLOT) {
    if (isToday && t < nowMin) continue;
    if (busy.some((b) => overlaps(t, dur, b.start, b.dur))) continue;
    slots.push(t);
  }
  return slots;
}

// "Egal, wer" – alle freien Zeiten, jeweils mit dem Barber, der an dem Tag am wenigsten gebucht ist
export function getSlotsAny(dateKey, dur = 30, now = new Date()) {
  const map = new Map();
  const loadOf = Object.fromEntries(TEAM.map((t) => [t.id, dayAgenda(t.id, dateKey).length]));
  for (const t of TEAM) {
    for (const s of getSlots(t.id, dateKey, dur, now)) {
      const cur = map.get(s);
      if (!cur || loadOf[t.id] < loadOf[cur]) map.set(s, t.id);
    }
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([start, barberId]) => ({ start, barberId }));
}

export function nextFree(barberId, dur = 30, count = 3, now = new Date()) {
  const found = [];
  for (let i = 0; i < HORIZON_DAYS && found.length < count; i++) {
    const key = toKey(addDays(now, i));
    for (const s of getSlots(barberId, key, dur, now)) {
      found.push({ date: key, start: s, barberId });
      if (found.length >= count) break;
    }
  }
  return found;
}

export function dayHasSlots(barberId, dateKey, dur) {
  return barberId === "any" ? getSlotsAny(dateKey, dur).length > 0 : getSlots(barberId, dateKey, dur).length > 0;
}

function code() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 5; i++) c += abc[Math.floor(Math.random() * abc.length)];
  return `GB-${c}`;
}

export function startDate(b) {
  const d = fromKey(b.date);
  d.setMinutes(b.start);
  return d;
}

// ---- Nachrichten: was nach einer Buchung automatisch passiert ----
export function planNotifications(b, now = new Date()) {
  const s = serviceById(b.serviceId);
  const barber = barberById(b.barberId);
  const first = b.name.trim().split(/\s+/)[0];
  const start = startDate(b);
  const day = fmtDateLong(start);
  const time = fmtTime(b.start);
  const link = `${SALON.shortDomain}/t/${b.code.slice(3).toLowerCase()}`;
  const chan = { sms: "SMS", whatsapp: "WhatsApp", email: "E-Mail" }[b.channel] || "SMS";
  const list = [];
  const add = (o) => list.push({ id: `${b.id}-${o.type}`, bookingId: b.id, ...o });

  add({ type: "confirm", to: "kunde", toName: b.name, channel: chan, at: now.getTime(), label: "Sofort", text: `Danke, ${first}! Dein Termin steht: ${s.name} bei ${barber.name}, ${day} um ${time} Uhr. ${SALON.name}, ${SALON.street}, ${SALON.city}. Ändern oder absagen: ${link}` });
  add({ type: "new", to: "barber", toName: barber.name, channel: "Push + Google Kalender", at: now.getTime(), label: "Sofort", text: `Neuer Termin: ${b.name}, ${s.name}, ${relDay(start, now)} ${time} Uhr. Online gebucht · ${b.phone}` });

  const dayBefore = new Date(start.getTime() - 24 * 36e5);
  const twoHours = new Date(start.getTime() - 2 * 36e5);
  if (dayBefore > now) {
    add({ type: "reminder", to: "kunde", toName: b.name, channel: chan, at: dayBefore.getTime(), label: "24 Std. vorher", text: `Erinnerung: Morgen um ${time} Uhr ist dein Termin bei ${barber.name}. Passt es nicht mehr? Bitte kurz absagen: ${link}` });
  } else if (twoHours > now) {
    add({ type: "reminder", to: "kunde", toName: b.name, channel: chan, at: twoHours.getTime(), label: "2 Std. vorher", text: `Erinnerung: Heute um ${time} Uhr ist dein Termin bei ${barber.name}. Passt es nicht mehr? Bitte kurz absagen: ${link}` });
  }
  const morning = fromKey(b.date);
  morning.setHours(8, 0, 0, 0);
  if (morning > now) {
    add({ type: "agenda", to: "barber", toName: barber.name, channel: "Push", at: morning.getTime(), label: "Am Morgen", text: `Guten Morgen, ${barber.name}! Deine Termine für heute stehen im Kalender – unter anderem ${b.name} um ${time} Uhr (${s.name}).` });
  }
  if (b.reviewOptIn) {
    const after = new Date(start.getTime() + (b.dur + 120) * 6e4);
    add({ type: "review", to: "kunde", toName: b.name, channel: chan, at: after.getTime(), label: "2 Std. danach", text: `Danke für deinen Besuch, ${first}! Wenn du zufrieden warst, freuen wir uns über ein paar Sterne bei Google: ${SALON.reviewLink}` });
  }
  return list;
}

export function createBooking({ serviceId, barberId, date, start, name, phone, email, channel, reviewOptIn }) {
  const s = serviceById(serviceId);
  // Letzte Prüfung direkt vor dem Speichern – im Live-Betrieb macht das der Server (keine Doppelbuchungen)
  if (!getSlots(barberId, date, s.dur).includes(start)) {
    return { ok: false, reason: "taken" };
  }
  const now = new Date();
  const b = { id: `b${now.getTime()}`, code: code(), serviceId, barberId, date, start, dur: s.dur, price: s.price, name, phone, email, channel, reviewOptIn: !!reviewOptIn, status: "confirmed", source: "online", createdAt: now.getTime() };
  write(K_BOOK, [...getBookings(), b]);
  const notes = planNotifications(b, now);
  write(K_NOTE, [...getNotifications(), ...notes]);
  return { ok: true, booking: b, notifications: notes };
}

export function setStatus(id, status) {
  const all = getBookings().map((b) => (b.id === id ? { ...b, status } : b));
  write(K_BOOK, all);
  if (status === "cancelled") {
    const b = all.find((x) => x.id === id);
    const now = Date.now();
    const kept = getNotifications().filter((n) => !(n.bookingId === id && n.at > now));
    if (b) {
      kept.push({ id: `${id}-cancel`, bookingId: id, type: "cancel", to: "kunde", toName: b.name, channel: { sms: "SMS", whatsapp: "WhatsApp", email: "E-Mail" }[b.channel] || "SMS", at: now, label: "Sofort", text: `Dein Termin am ${fmtDateLong(startDate(b))} um ${fmtTime(b.start)} Uhr wurde abgesagt. Neuen Termin buchen: ${SALON.shortDomain}` });
    }
    write(K_NOTE, kept);
  }
}

export function addBlock({ barberId, date, start, dur, reason }) {
  const blk = { id: `x${Date.now()}`, barberId, date, start, dur, reason: reason || "Blockiert" };
  write(K_BLOCK, [...getBlocks(), blk]);
  return blk;
}
export function removeBlock(id) {
  write(K_BLOCK, getBlocks().filter((b) => b.id !== id));
}

export function resetDemo() {
  [K_BOOK, K_NOTE, K_BLOCK].forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  });
}

// Kalenderdatei (.ics) für "Zum Kalender hinzufügen"
export function icsFor(b) {
  const s = serviceById(b.serviceId);
  const barber = barberById(b.barberId);
  const st = startDate(b);
  const en = new Date(st.getTime() + b.dur * 6e4);
  const f = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Golden Barber//Termin//DE", "BEGIN:VEVENT", `UID:${b.id}@${SALON.shortDomain}`, `DTSTAMP:${f(new Date())}`, `DTSTART;TZID=Europe/Berlin:${f(st)}`, `DTEND;TZID=Europe/Berlin:${f(en)}`, `SUMMARY:${s.name} bei ${barber.name} – ${SALON.name}`, `LOCATION:${SALON.street}\\, ${SALON.zip} ${SALON.city}`, `DESCRIPTION:Buchungscode ${b.code}`, "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Termin bei The Golden Barber", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
