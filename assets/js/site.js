// Seite: Licht-Animation im Hero, Leistungen, Team, Galerie, Öffnungszeiten, Karte.
import { SALON, HOURS, DAY_NAMES, SERVICES, SERVICE_GROUPS, TEAM, fmtTime, fmtDur, fmtPrice, fromKey, relDay, addDays } from "./data.js";
import { nextFree } from "./store.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const desktop = matchMedia("(min-width: 901px)");
// Variante A der Demo: Buchung läuft über Planity statt über den eigenen Kalender
const PLANITY = document.documentElement.classList.contains("var-a");

export function prefill(detail) {
  if (!PLANITY) window.dispatchEvent(new CustomEvent("gb:prefill", { detail }));
  $("#termin").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

/* ---------- LED-Waben an der Decke ---------- */
function buildLed() {
  const svg = $("#led");
  const R = 74;
  const cells = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [1, 1], [2, 1], [3, 1], [4, 1], [2, 2], [3, 2]];
  const order = [4, 0, 7, 2, 9, 1, 5, 10, 3, 8, 6];
  svg.innerHTML = cells
    .map(([c, r], i) => {
      const cx = 110 + c * R * 1.5;
      const cy = 80 + r * R * 1.732 + (c % 2 ? R * 0.866 : 0);
      const pts = Array.from({ length: 6 }, (_, k) => {
        const a = (Math.PI / 3) * k;
        return `${(cx + R * 0.9 * Math.cos(a)).toFixed(1)},${(cy + R * 0.9 * Math.sin(a)).toFixed(1)}`;
      }).join(" ");
      return `<polygon points="${pts}" style="--i:${order[i]}"/>`;
    })
    .join("");
}

/* ---------- Goldstaub ---------- */
function goldDust() {
  const cv = $("#dust");
  if (reduced || !cv) return;
  const ctx = cv.getContext("2d");
  let w, h, dpr, run = true, raf;
  const N = innerWidth < 700 ? 26 : 54;
  const ps = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.7, v: 0.012 + Math.random() * 0.03, sway: Math.random() * 6.28, tw: Math.random() * 6.28 }));
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = cv.clientWidth;
    h = cv.clientHeight;
    cv.width = w * dpr;
    cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  addEventListener("resize", size);
  let last = performance.now();
  const tick = (t) => {
    const dt = Math.min(50, t - last) / 1000;
    last = t;
    ctx.clearRect(0, 0, w, h);
    for (const p of ps) {
      p.y -= p.v * dt;
      p.sway += dt * 0.6;
      p.tw += dt * 1.8;
      if (p.y < -0.02) {
        p.y = 1.02;
        p.x = Math.random();
      }
      const x = (p.x + Math.sin(p.sway) * 0.012) * w;
      const a = 0.18 + 0.5 * (0.5 + 0.5 * Math.sin(p.tw));
      ctx.beginPath();
      ctx.fillStyle = `rgba(246, 214, 140, ${a.toFixed(3)})`;
      ctx.arc(x, p.y * h, p.r, 0, 6.283);
      ctx.fill();
    }
    if (run) raf = requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(([e]) => {
    run = e.isIntersecting && !document.hidden;
    cancelAnimationFrame(raf);
    if (run) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  });
  io.observe(cv);
}

/* ---------- Navigation ---------- */
function nav() {
  const el = $("#nav"), links = $("#navLinks"), burger = $("#burger");
  const onScroll = () => el.classList.toggle("is-solid", scrollY > 24);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });
  const close = () => {
    links.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Menü öffnen");
    document.body.style.overflow = "";
  };
  burger.addEventListener("click", () => {
    const open = !links.classList.contains("is-open");
    links.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
    document.body.style.overflow = open ? "hidden" : "";
  });
  links.addEventListener("click", (e) => e.target.closest("a") && close());
  addEventListener("keydown", (e) => e.key === "Escape" && close());

  const map = new Map($$("a", links).map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver(
    (es) => es.forEach((e) => e.isIntersecting && map.forEach((a, id) => a.classList.toggle("is-active", id === e.target.id))),
    { rootMargin: "-45% 0px -50% 0px" }
  );
  // alle Abschnitte beobachten, damit z. B. im Buchungsbereich kein Menüpunkt fälschlich aktiv bleibt
  $$("section[id], header[id]").forEach((s) => io.observe(s));

  // Mobile-Leiste: sichtbar nach dem Hero, weg sobald die Buchung im Bild ist
  const dock = $("#dock");
  let pastHero = false, inBook = false;
  const upd = () => dock.classList.toggle("is-on", pastHero && !inBook);
  new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; document.body.classList.toggle("past-hero", pastHero); upd(); }, { threshold: 0.2 }).observe($("#top"));
  new IntersectionObserver(([e]) => { inBook = e.isIntersecting; upd(); }, { threshold: 0.05 }).observe($("#termin"));
}

/* ---------- Einblenden beim Scrollen ---------- */
function reveals() {
  const groups = new Map();
  $$("[data-reveal]").forEach((el) => {
    if (el.style.getPropertyValue("--d")) return;
    const p = el.parentElement;
    const n = groups.get(p) || 0;
    el.style.setProperty("--d", n);
    groups.set(p, n + 1);
  });
  const io = new IntersectionObserver(
    (es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
      $$("[data-count]", e.target).forEach(countUp);
    }),
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
  );
  $$("[data-reveal]").forEach((el) => io.observe(el));
}

function countUp(el) {
  const to = parseFloat(el.dataset.count);
  if (reduced) return;
  const t0 = performance.now(), dur = 1400;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 4);
    el.textContent = (to * e).toFixed(1).replace(".", ",");
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- Leistungen ---------- */
function menu() {
  const root = $("#menuList");
  root.innerHTML =
    SERVICE_GROUPS.map((g) => {
      const rows = SERVICES.filter((s) => s.group === g.id)
        .map(
          (s) => `<button class="svc" type="button" data-service="${s.id}" aria-label="${s.name}, ${fmtDur(s.dur)}, ${s.price} Euro – jetzt buchen">
            <span class="svc__name">${s.name}</span>
            ${s.detail ? `<span class="svc__detail">${s.detail}</span>` : ""}
            <span class="svc__dur">${fmtDur(s.dur)}</span>
            <span class="svc__price">${fmtPrice(s.price)}</span>
            <svg class="svc__go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6"/></svg>
          </button>`
        )
        .join("");
      return `<div class="grp" data-reveal><div class="grp__head"><h3 class="grp__title">${g.title}</h3>${g.note ? `<span class="grp__note">${g.note}</span>` : ""}</div>${rows}</div>`;
    }).join("") + `<p class="menu__foot" data-reveal>Alle Preise sind Endpreise. Bezahlt wird im Salon – auch mit Karte oder kontaktlos per Handy.</p>`;
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-service]");
    if (b) prefill({ serviceId: b.dataset.service });
  });
}

/* ---------- Team & nächste freie Termine ---------- */
const slotLabel = (s) => `${relDay(fromKey(s.date))} ${fmtTime(s.start)}`;

function team() {
  const root = $("#teamGrid");
  root.innerHTML = TEAM.map((t, i) => {
    const nf = nextFree(t.id, 30, 1)[0];
    const pic = t.photo
      ? `<img src="${t.photo}" alt="Porträt von ${t.name} vor dem Wandlogo des Salons" loading="lazy" width="1100" height="1467" style="object-position:${t.pos}">`
      : `<div class="member__mono" role="img" aria-label="${t.name}"><i class="member__crest"></i><span class="gold">${t.name[0]}</span></div>`;
    return `<article class="member" data-reveal style="--d:${i}">
      <div class="member__pic">${pic}
        <div class="member__cap"><h3 class="member__name">${t.name}</h3>
        <p class="member__next">${nf ? `<span class="live live--on"></span>Frei: ${slotLabel(nf)}` : "Aktuell ausgebucht"}</p></div>
      </div>
      <button class="btn btn--line" type="button" data-barber="${t.id}">Termin bei ${t.name}</button>
    </article>`;
  }).join("");
}

function nextFreeWidget() {
  const root = $("#nextFree");
  if (PLANITY) {
    const h = HOURS[new Date().getDay()];
    $("#nfLabel").textContent = "Online buchen · rund um die Uhr";
    $("#nfHint").remove();
    root.outerHTML = `<div class="nfa"><p class="nfa__big">${h ? `Heute ${fmtTime(h[0])} – ${fmtTime(h[1])}` : "Heute geschlossen"}</p>
      <p class="nfa__sub">Freie Zeiten aller vier Barber siehst du direkt in der Buchung.</p>
      <a class="btn btn--gold" href="#termin">Freie Termine ansehen</a></div>`;
    return;
  }
  root.innerHTML = TEAM.map((t) => {
    const list = nextFree(t.id, 30, 3);
    if (!list.length) return "";
    const sameDay = list.filter((s) => s.date === list[0].date);
    const av = t.avatar ? `<img class="nf__av" src="${t.avatar}" alt="" width="40" height="40" loading="lazy">` : `<span class="nf__av" aria-hidden="true">${t.name[0]}</span>`;
    return `<li class="nf">${av}<div><p class="nf__name">${t.name}<span class="nf__day">${relDay(fromKey(list[0].date))}</span></p>
      <div class="nf__times">${sameDay.map((s) => `<button class="chip" type="button" data-b="${t.id}" data-d="${s.date}" data-s="${s.start}" aria-label="${t.name}, ${relDay(fromKey(s.date))} um ${fmtTime(s.start)} Uhr vormerken">${fmtTime(s.start)}</button>`).join("")}</div></div></li>`;
  }).join("");
}

/* ---------- Öffnungszeiten ---------- */
function hours() {
  const now = new Date();
  const dow = now.getDay(), min = now.getHours() * 60 + now.getMinutes();
  const today = HOURS[dow];
  const open = today && min >= today[0] && min < today[1];
  let state;
  if (open) state = `Jetzt geöffnet · bis ${fmtTime(today[1])} Uhr`;
  else if (today && min < today[0]) state = `Öffnet heute um ${fmtTime(today[0])} Uhr`;
  else {
    let i = 1;
    while (!HOURS[addDays(now, i).getDay()]) i++;
    const d = addDays(now, i);
    state = `Öffnet ${i === 1 ? "morgen" : DAY_NAMES[d.getDay()]} um ${fmtTime(HOURS[d.getDay()][0])} Uhr`;
  }
  $("#openText").textContent = state;
  $("#openDot").classList.toggle("live--on", !!open);
  $("#hoursState").textContent = open ? "· jetzt geöffnet" : "· gerade geschlossen";
  $("#hoursBody").innerHTML = [1, 2, 3, 4, 5, 6, 0]
    .map((d) => `<tr class="${d === dow ? "is-today" : ""}"><td>${DAY_NAMES[d]}${d === dow ? " · heute" : ""}</td><td>${HOURS[d] ? `${fmtTime(HOURS[d][0])} – ${fmtTime(HOURS[d][1])}` : "geschlossen"}</td></tr>`)
    .join("");
}

/* ---------- Galerie: vertikales Scrollen bewegt die Bilder horizontal ---------- */
function salon() {
  const sec = $("#salon"), track = $("#salonTrack"), bar = $("#salonBar");
  let travel = 0, ticking = false;
  const measure = () => {
    if (!desktop.matches || reduced) {
      sec.style.height = "";
      track.style.transform = "";
      travel = 0;
      return;
    }
    travel = Math.max(0, track.scrollWidth - innerWidth);
    sec.style.height = `calc(100svh + ${travel}px)`;
    update();
  };
  const update = () => {
    ticking = false;
    if (!travel) return;
    const p = Math.min(1, Math.max(0, -sec.getBoundingClientRect().top / travel));
    track.style.transform = `translate3d(${(-p * travel).toFixed(1)}px,0,0)`;
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", measure);
  desktop.addEventListener("change", measure);
  $$("img", track).forEach((im) => im.complete || im.addEventListener("load", measure, { once: true }));
  if (reduced) {
    // Ohne Bewegung: normale horizontale Scroll-Leiste
    track.style.cssText = "width:auto;overflow-x:auto";
  }
  measure();
}

function parallax() {
  if (reduced) return;
  const els = $$("[data-parallax]");
  let ticking = false;
  const update = () => {
    ticking = false;
    for (const el of els) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const off = (r.top + r.height / 2 - innerHeight / 2) * parseFloat(el.dataset.parallax);
      el.style.transform = `translate3d(0,${(-off).toFixed(1)}px,0)`;
    }
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ---------- Karte erst nach Klick laden (Datenschutz) ---------- */
function map() {
  $("#mapLoad").addEventListener("click", () => {
    $("#map").innerHTML = `<iframe title="Karte: ${SALON.street}, ${SALON.zip} ${SALON.city}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(SALON.mapsQuery)}&output=embed"></iframe>`;
  });
}

/* ---------- Hintergrundvideo: lädt erst kurz vor dem Sichtbereich, pausiert außerhalb ---------- */
function craftVideo() {
  const v = $("#craftVideo"), btn = $("#craftToggle");
  if (!v) return;
  // Kein Video bei „Bewegung reduzieren“ oder Datensparmodus – dann bleibt das Standbild
  if (reduced || navigator.connection?.saveData) return;
  let userPaused = false, loaded = false;
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      if (!loaded) { v.src = v.dataset.src; loaded = true; btn.hidden = false; }
      if (!userPaused) v.play().catch(() => {});
    } else if (loaded) v.pause();
  }, { rootMargin: "300px 0px" });
  io.observe(v);
  btn.addEventListener("click", () => {
    userPaused = !userPaused;
    userPaused ? v.pause() : v.play().catch(() => {});
    btn.setAttribute("aria-pressed", String(userPaused));
    btn.textContent = userPaused ? "Video abspielen" : "Video anhalten";
  });
}

function wire() {
  $("#nextFree")?.addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (c) prefill({ barberId: c.dataset.b, date: c.dataset.d, start: Number(c.dataset.s) });
  });
  $("#teamGrid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-barber]");
    if (b) prefill({ barberId: b.dataset.barber });
  });
  addEventListener("gb:booked", () => {
    if (PLANITY) return;
    nextFreeWidget();
    team();
    $$("#teamGrid [data-reveal]").forEach((el) => el.classList.add("is-in"));
  });
}

buildLed();
menu();
team();
nextFreeWidget();
hours();
nav();
reveals();
salon();
parallax();
map();
craftVideo();
wire();
goldDust();
// Die Galerie verändert die Seitenhöhe – Sprunglinks deshalb danach noch einmal ansteuern
if (location.hash.length > 1) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
