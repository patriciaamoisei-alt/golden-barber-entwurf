// Stammdaten des Salons. Quelle: öffentliches Planity- und Google-Profil (Stand 25.11.2026).
// Alles, was der Inhaber später selbst ändern will (Preise, Zeiten, Team), steht nur in dieser Datei.

export const SALON = {
  name: "The Golden Barber",
  claim: "Men's Salon",
  street: "Egerlandstraße 3",
  zip: "82538",
  city: "Geretsried",
  phoneDisplay: "01520 6021380",
  phoneLink: "+4915206021380",
  instagram: "https://www.instagram.com/golden.barber.remus/",
  tiktok: "https://www.tiktok.com/@thegoldenbarber.bayern",
  planity: "https://www.planity.com/de-DE/the-golden-barber-mens-salon-82538-geretsried-ois",
  mapsQuery: "The Golden Barber - Men's Salon, Egerlandstraße 3, 82538 Geretsried",
  // Platzhalter – wird durch den echten Link aus dem Google-Unternehmensprofil ersetzt
  reviewLink: "https://g.page/r/…/review",
  shortDomain: "thegoldenbarber.de",
};

// Öffnungszeiten in Minuten seit Mitternacht. 0 = Sonntag.
export const HOURS = {
  0: null,
  1: [600, 1140],
  2: [720, 1080],
  3: [600, 1140],
  4: [600, 1140],
  5: [600, 1140],
  6: [540, 1020],
};

export const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
export const DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const MONTH_SHORT = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];

export const SERVICE_GROUPS = [
  { id: "pakete", title: "Komplettpakete", note: "Haare und Bart in einem Termin" },
  { id: "haare", title: "Haarschnitt", note: "" },
  { id: "bart", title: "Bart & Details", note: "" },
  { id: "farbe", title: "Farbe", note: "" },
];

export const SERVICES = [
  { id: "komplett-premium", group: "pakete", name: "Komplettpaket Premium", detail: "Haare & Bart, Übergang bis 2 mm", dur: 30, price: 42 },
  { id: "komplett-basic", group: "pakete", name: "Komplettpaket Basic", detail: "Haare & Bart, ab 2 mm", dur: 30, price: 35 },
  { id: "haircut-premium", group: "haare", name: "Haircut Premium", detail: "Übergang bis 2 mm", dur: 30, price: 30 },
  { id: "haircut-classic", group: "haare", name: "Haircut Classic", detail: "ab 2 mm", dur: 30, price: 25 },
  { id: "kids", group: "haare", name: "Children's Haircut", detail: "für Kinder von 5 bis 10 Jahren", dur: 30, price: 25 },
  { id: "beard", group: "bart", name: "Beardtrim Premium", detail: "Konturen, Form, Pflege", dur: 30, price: 17 },
  { id: "brows", group: "bart", name: "Augenbrauen", detail: "", dur: 30, price: 10 },
  { id: "wash", group: "bart", name: "Haarwäsche & Styling", detail: "", dur: 30, price: 5 },
  { id: "color", group: "farbe", name: "Haare färben", detail: "inklusive Beratung", dur: 180, price: 80 },
];

export const TEAM = [
  { id: "remus", name: "Remus", photo: "assets/img/p-remus.jpg", avatar: "assets/img/team-remus.jpg", pos: "50% 62%" },
  { id: "dodo", name: "Dodo", photo: "assets/img/p-dodo.jpg", avatar: "assets/img/team-dodo.jpg", pos: "50% 58%" },
  { id: "nelu", name: "Nelu", photo: "assets/img/p-nelu.jpg", avatar: "assets/img/team-nelu.jpg", pos: "50% 62%" },
  { id: "cristina", name: "Cristina", photo: null, avatar: null, pos: "50% 50%" },
];

export const serviceById = (id) => SERVICES.find((s) => s.id === id);
export const barberById = (id) => TEAM.find((t) => t.id === id);

// ---- kleine Datums-Helfer, überall gemeinsam genutzt ----
export const pad = (n) => String(n).padStart(2, "0");
export const fmtTime = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};
export const fmtDur = (min) => (min >= 60 ? `${min / 60} Std.` : `${min} Min.`);
export const fmtPrice = (p) => `${p} €`;

export function relDay(date, now = new Date()) {
  const diff = Math.round((fromKey(toKey(date)) - fromKey(toKey(now))) / 864e5);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  return `${DAY_SHORT[date.getDay()]}, ${date.getDate()}. ${MONTH_SHORT[date.getMonth()]}`;
}
export const fmtDateLong = (date) => `${DAY_NAMES[date.getDay()]}, ${date.getDate()}. ${MONTHS[date.getMonth()]}`;
