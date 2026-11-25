// Team-Kalender: ein Kalender pro Barber, Tagesansicht, Nachrichten-Protokoll.
import { HOURS, TEAM, DAY_SHORT, serviceById, barberById, fmtTime, fmtDur, fmtPrice, toKey, fromKey, addDays, fmtDateLong, pad } from "./data.js";
import { dayAgenda, getNotifications, setStatus, addBlock, removeBlock, resetDemo } from "./store.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ROW = 46;
const mobile = matchMedia("(max-width: 700px)");

const st = { date: toKey(new Date()), view: mobile.matches ? TEAM[0].id : "all" };
let current = new Map();

const stamp = (ms) => {
  const d = new Date(ms);
  return `${DAY_SHORT[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function tabs() {
  $("#tabs").innerHTML = [{ id: "all", name: "Alle" }, ...TEAM]
    .map((t) => `<button class="tk-tab" role="tab" type="button" data-view="${t.id}" aria-selected="${st.view === t.id}">${t.name}</button>`)
    .join("");
}

function calendar() {
  const date = fromKey(st.date);
  const hours = HOURS[date.getDay()];
  const isToday = st.date === toKey(new Date());
  $("#dateTitle").textContent = `${fmtDateLong(date)}${isToday ? " · heute" : ""}`;
  const barbers = st.view === "all" ? TEAM : TEAM.filter((t) => t.id === st.view);
  const cal = $("#cal");
  current = new Map();

  if (!hours) {
    cal.innerHTML = `<div class="cal__closed"><p class="h3">${fmtDateLong(date)}: Ruhetag.</p><p>Der Salon ist geschlossen, online kann für diesen Tag niemand buchen.</p></div>`;
    kpis([], barbers, null);
    return;
  }
  const [open, close] = hours;
  const rows = (close - open) / 30;
  const all = [];
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowLine = isToday && nowMin > open && nowMin < close ? `<i class="cal__now" style="top:${((nowMin - open) / 30) * ROW}px"></i>` : "";

  const heads = barbers
    .map((t) => {
      const list = dayAgenda(t.id, st.date);
      all.push(...list);
      const n = list.filter((a) => !a.block).length;
      const av = t.avatar ? `<img class="cal__av" src="${t.avatar}" alt="" width="34" height="34">` : `<span class="cal__av" aria-hidden="true">${t.name[0]}</span>`;
      return `<div class="cal__head">${av}<span class="cal__name">${t.name}<span class="cal__cnt">${n} ${n === 1 ? "Termin" : "Termine"}</span></span></div>`;
    })
    .join("");

  const axis = Array.from({ length: Math.floor((close - open) / 60) + 1 }, (_, i) => `<span class="cal__hr" style="top:${i * 2 * ROW}px">${fmtTime(open + i * 60)}</span>`).join("");

  const cols = barbers
    .map((t) => {
      const apts = dayAgenda(t.id, st.date)
        .map((a, i) => {
          current.set(a.id, a);
          const top = ((a.start - open) / 30) * ROW;
          const h = Math.min((a.dur / 30) * ROW, rows * ROW - top) - 3;
          if (a.block) return `<button class="apt apt--blk" type="button" data-id="${a.id}" style="top:${top + 1}px;height:${h}px;--i:${i}"><b>${esc(a.reason)}</b><span>${fmtTime(a.start)} · ${fmtDur(a.dur)}</span></button>`;
          const s = serviceById(a.serviceId);
          const cls = a.status === "noshow" ? "apt--noshow" : a.status === "done" ? "apt--done" : !a.demo ? "apt--new" : a.source === "telefon" ? "apt--tel" : "";
          return `<button class="apt ${cls}" type="button" data-id="${a.id}" style="top:${top + 1}px;height:${h}px;--i:${i}" aria-label="${fmtTime(a.start)} Uhr, ${esc(a.name)}, ${s.name}"><b>${esc(a.name)}</b><span>${fmtTime(a.start)} · ${s.name}</span></button>`;
        })
        .join("");
      return `<div class="cal__col" data-barber="${t.id}">${nowLine}${apts}</div>`;
    })
    .join("");

  cal.innerHTML = `<div class="cal" style="--cols:${barbers.length};--rows:${rows}"><div class="cal__head"></div>${heads}<div class="cal__axis">${axis}</div>${cols}</div>`;
  kpis(all, barbers, hours);
}

function kpis(all, barbers, hours) {
  const apts = all.filter((a) => !a.block && a.status !== "noshow");
  const online = apts.filter((a) => a.source === "online").length;
  const minutes = apts.reduce((s, a) => s + a.dur, 0);
  const cap = hours ? (hours[1] - hours[0]) * barbers.length : 0;
  const revenue = apts.reduce((s, a) => s + serviceById(a.serviceId).price, 0);
  const items = [
    [apts.length, "Termine"],
    [apts.length ? `${Math.round((online / apts.length) * 100)} %` : "–", "davon online gebucht"],
    [cap ? `${Math.round((minutes / cap) * 100)} %` : "–", "Auslastung"],
    [fmtPrice(revenue), "geplanter Umsatz"],
  ];
  $("#kpis").innerHTML = items.map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
}

function log() {
  const now = Date.now();
  const all = getNotifications();
  const plan = all.filter((n) => n.at > now).sort((a, b) => a.at - b.at);
  const sent = all.filter((n) => n.at <= now).sort((a, b) => b.at - a.at);
  const item = (n, planned) => `<li class="lg-item ${planned ? "lg-item--plan" : ""}">
      <p class="lg-item__h"><span>${n.channel}</span><b>${planned ? "geplant " : "✓ "}${stamp(n.at)}</b></p>
      <p class="lg-item__to">An ${n.to === "barber" ? "Barber" : "Kunde"}: ${esc(n.toName)}</p>
      <p class="lg-item__t">${esc(n.text)}</p></li>`;
  $("#log").innerHTML = all.length
    ? [...sent.map((n) => item(n, false)), ...plan.map((n) => item(n, true))].join("")
    : `<li class="tk-empty">Noch keine Nachrichten. Sobald jemand auf der Website bucht, erscheinen hier Bestätigung, Erinnerung und Bewertungsanfrage.</li>`;
}

function detail(a) {
  const dlg = $("#detail");
  const barber = barberById(a.barberId);
  let html;
  if (a.block) {
    html = `<h2 class="bk-title" id="dTitle">${esc(a.reason)}</h2>
      <p class="bk-sub">${barber.name} · ${fmtTime(a.start)} Uhr · ${fmtDur(a.dur)}</p>
      <div class="tk-acts"><button class="btn btn--line" type="button" data-unblock="${a.id}">Blockierung aufheben</button><button class="btn btn--gold" type="button" data-close>Schließen</button></div>`;
  } else {
    const s = serviceById(a.serviceId);
    html = `<h2 class="bk-title" id="dTitle">${esc(a.name)}</h2>
      <p class="bk-sub">${a.demo ? "Beispiel-Termin der Demo" : `Online gebucht · Code ${a.code}`}</p>
      <dl class="ticket">
        <div class="ticket__row"><dt>Leistung</dt><dd>${s.name} · ${fmtDur(s.dur)} · ${fmtPrice(s.price)}</dd></div>
        <div class="ticket__row"><dt>Wann</dt><dd><b>${fmtDateLong(fromKey(a.date))}, ${fmtTime(a.start)} Uhr</b></dd></div>
        <div class="ticket__row"><dt>Barber</dt><dd>${barber.name}</dd></div>
        ${a.demo ? "" : `<div class="ticket__row"><dt>Telefon</dt><dd><a href="tel:${esc(a.phone.replace(/[^\d+]/g, ""))}">${esc(a.phone)}</a></dd></div>`}
        <div class="ticket__row"><dt>Status</dt><dd>${{ confirmed: "Bestätigt", done: "Erschienen", noshow: "Nicht erschienen" }[a.status] || "Bestätigt"}</dd></div>
      </dl>
      ${a.demo
        ? `<div class="tk-acts"><button class="btn btn--gold" type="button" data-close>Schließen</button></div>`
        : `<div class="tk-acts"><button class="btn btn--gold" type="button" data-status="done" data-id="${a.id}">Erschienen</button><button class="btn btn--line" type="button" data-status="noshow" data-id="${a.id}">Nicht erschienen</button></div>
           <div class="tk-acts"><button class="bk-link" type="button" data-status="cancelled" data-id="${a.id}">Termin absagen und Kunden benachrichtigen</button><button class="bk-link" type="button" data-close style="margin-left:auto">Schließen</button></div>`}`;
  }
  $("#detailIn").innerHTML = html;
  dlg.showModal();
}

function render() {
  tabs();
  calendar();
  log();
}

/* ---------- Ereignisse ---------- */
$("#prev").addEventListener("click", () => { st.date = toKey(addDays(fromKey(st.date), -1)); render(); });
$("#next").addEventListener("click", () => { st.date = toKey(addDays(fromKey(st.date), 1)); render(); });
$("#today").addEventListener("click", () => { st.date = toKey(new Date()); render(); });
$("#tabs").addEventListener("click", (e) => {
  const t = e.target.closest("[data-view]");
  if (t) { st.view = t.dataset.view; render(); }
});
$("#cal").addEventListener("click", (e) => {
  const b = e.target.closest(".apt");
  if (b && current.has(b.dataset.id)) detail(current.get(b.dataset.id));
});
$("#detail").addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.status) setStatus(t.dataset.id, t.dataset.status);
  if (t.dataset.unblock) removeBlock(t.dataset.unblock);
  $("#detail").close();
  render();
});
$("#reset").addEventListener("click", () => { resetDemo(); render(); });

const blockDlg = $("#blockDlg");
$("#blockBtn").addEventListener("click", () => {
  const hours = HOURS[fromKey(st.date).getDay()];
  if (!hours) return;
  $("#bWho").innerHTML = TEAM.map((t) => `<option value="${t.id}" ${st.view === t.id ? "selected" : ""}>${t.name}</option>`).join("");
  const opts = [];
  for (let t = hours[0]; t < hours[1]; t += 30) opts.push(`<option value="${t}" ${t === 780 ? "selected" : ""}>${fmtTime(t)} Uhr</option>`);
  $("#bFrom").innerHTML = opts.join("");
  blockDlg.showModal();
});
blockDlg.addEventListener("click", (e) => e.target.closest("[data-close]") && blockDlg.close());
$("#blockForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const hours = HOURS[fromKey(st.date).getDay()];
  const start = Number(f.get("from"));
  addBlock({ barberId: f.get("who"), date: st.date, start, dur: Math.min(Number(f.get("dur")), hours[1] - start), reason: String(f.get("why")).trim() || "Blockiert" });
  blockDlg.close();
  render();
});

// Bucht jemand in einem anderen Tab, aktualisiert sich der Kalender von selbst
addEventListener("storage", render);
setInterval(() => { if (!$("dialog[open]")) render(); }, 60000);
render();
