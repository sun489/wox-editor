// char-preview.js — EDITOR-ONLY trim of src/pixel.js (2026-11-07)
// Forked from the generated file: kept the figure code (person, portrait,
// personCanvas, heroLook, HAIR_SPECS) only, dropped the place/scenery art,
// the weather, the beast CSS and the many stubs — none of them are used by
// the Save Editor, which draws just the hero, the NPCs and beasts' faces.
// If you regenerate from src/pixel.js, either keep that generated file next to
// this one (e.g. char-preview.full.js) or re-apply this trim by hand.
//
// Everything is painted at a low resolution and enlarged with hard edges, so
// it all shares one pixel size; a figure is FIG_W × FIG_H art pixels.
//
// v2 (2026-11-07): portrait() is cached keyed by JSON.stringify(look). The
// caller gets a fresh clone each time so it can be appended to the DOM
// anywhere without worrying about a shared canvas. Cache holds up to 400
// entries and evicts the oldest (FIFO).
(function () {
// ------------------------------------------------------------------ palette

const C = { gold: "#e0b03c", red: "#b23a2a", straw: "#d0ab5c", wood: "#7a5232" };

// ------------------------------------------------------------------ helpers

// Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("")}`;
}

function canvas(w, h) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  return cv;
}

// A colour t of the way from a to b (both #rrggbb).
function mixHex(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

// ------------------------------------------------------------------ people

const STEEL = "#b8bec4";
const ORN = { gold: C.gold, jade: "#5ac08a", flower: "#f08ab0", ribbon: "#c83a3a" };

// People are drawn finer than the places: a chibi figure FIG_W × FIG_H art
// pixels, shown at half the scene's pixel size (FIG_SCALE), feet on row FEET.
const FIG_W = 56, FIG_H = 72, FIG_CX = 28, FEET = 69, FIG_SCALE = 0.5;
const LINE = "#1c1820", EYE = "#22202c", BLUSH = "#f0a48e";

// (players, 2026-10-25: "มีมิติสมกับเป็น 16 bit") Every material is drawn on
// a ramp of its own: o (its outline, the darkest), d2, d1 (shadow), b (the
// colour), l1, l2 (lit). The light comes from the top left: shadows lean cool,
// the lit side warm. Skin's shadows lean red-warm instead.
const RAMPS = new Map();
function ramp(c, kind = "") {
  const key = c + kind;
  if (!RAMPS.has(key)) {
    const warm = kind === "skin", n = parseInt(c.slice(1), 16), lum = (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255;
    const dk = lum > 0.75 ? 1.25 : 1, lt = lum < 0.25 ? 1.6 : 1;
    const cool = warm ? "#a03838" : "#3a2a5c", deep = warm ? "#5a2018" : "#1a1226";
    RAMPS.set(key, {
      o: mixHex(shade(c, -0.62 * dk), deep, 0.3),
      d2: mixHex(shade(c, -0.42 * dk), cool, warm ? 0.2 : 0.16),
      d1: mixHex(shade(c, -0.22 * dk), cool, warm ? 0.14 : 0.1),
      b: c,
      l1: mixHex(shade(c, 0.2 * lt), "#fff0c8", 0.1),
      l2: mixHex(shade(c, 0.4 * lt), "#fff6dc", 0.18),
    });
  }
  return RAMPS.get(key);
}
// Bresenham's line, plotting each pixel.
function bres(x0, y0, x1, y1, plot) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
// A figure's painter: draws like painter() and remembers, for each pixel,
// the material (ramp) it was painted in (p.R), so the outline beside it can
// be that material's own darkest shade (sel-out), and the shading passes can
// tell hair from skin.
function figPainter(ctx) {
  const mat = new Array(FIG_W * FIG_H).fill(null);
  const P = {
    R: { o: LINE },
    mat,
    r(x, y, w, h, c) {
      x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
      const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(FIG_W, x + w), y1 = Math.min(FIG_H, y + h);
      if (x1 <= x0 || y1 <= y0) return;
      ctx.fillStyle = c;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let yy = y0; yy < y1; yy++) mat.fill(P.R, yy * FIG_W + x0, yy * FIG_W + x1);
    },
    px: (x, y, c) => P.r(x, y, 1, 1, c),
    line: (x0, y0, x1, y1, c) => bres(x0, y0, x1, y1, (x, y) => P.r(x, y, 1, 1, c)),
    at: (x, y) => (x >= 0 && y >= 0 && x < FIG_W && y < FIG_H ? mat[y * FIG_W + x] : null),
  };
  return P;
}
// The pixels a shape covers, drawn with the same helpers (ell, poly, lines).
function maskOf(fn) {
  const m = new Uint8Array(FIG_W * FIG_H);
  const r = (x, y, w, h) => {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    for (let yy = Math.max(0, y); yy < Math.min(FIG_H, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(FIG_W, x + w); xx++) m[yy * FIG_W + xx] = 1;
  };
  fn({ r, px: (x, y) => r(x, y, 1, 1), line: (x0, y0, x1, y1) => bres(x0, y0, x1, y1, (x, y) => r(x, y, 1, 1)) });
  return m;
}
const inM = (m, x, y) => x >= 0 && y >= 0 && x < FIG_W && y < FIG_H && m[y * FIG_W + x] === 1;
// A shape filled on its ramp as a solid lit from the top left: a lit rim on
// the top and left edges, the shadow along the right (sx pixels deep) and the
// bottom (sy deep), its deepest at the very right edge.
function shapeFill(p, m, R, { sx = 2, sy = 1, rim = true, deep = true, edge = false, hi = 0, base = R.b, lit = R.l1, dark = R.d1, darker = R.d2 } = {}) {
  const prev = p.R;
  p.R = R;
  for (let y = 0; y < FIG_H; y++)
    for (let x = 0; x < FIG_W; x++) {
      if (!inM(m, x, y)) continue;
      let c = base;
      if (rim && (!inM(m, x - 1, y) || !inM(m, x, y - 1))) c = lit;
      if (hi && !inM(m, x - hi, y - hi) && inM(m, x - 1, y) && inM(m, x, y - 1) && rim) c = R.l2;
      let sh = false;
      for (let k = 1; k <= sx; k++) if (!inM(m, x + k, y)) sh = true;
      for (let k = 1; k <= sy; k++) if (!inM(m, x, y + k)) sh = true;
      if (sh) c = dark;
      if (deep && !inM(m, x + 1, y) && !inM(m, x, y + 1)) c = darker;
      if (edge && !inM(m, x + 1, y)) c = darker;
      p.r(x, y, 1, 1, c);
    }
  p.R = prev;
}
// The outline (sel-out): beside the lit top and left of each material, that
// material's own darkest shade; on the shadow side and along the bottom,
// near-black, so the figure reads against any scene.
function selOut(cv, p) {
  const ctx = cv.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const solid = (x, y) => !!p.at(x, y);
  const out = [];
  for (let y = 0; y < FIG_H; y++)
    for (let x = 0; x < FIG_W; x++) {
      if (solid(x, y)) continue;
      const L = solid(x - 1, y), U = solid(x, y - 1), Rt = solid(x + 1, y), D = solid(x, y + 1);
      if (!(L || U || Rt || D)) continue;
      let c = LINE;
      if (!L && !U) c = (Rt ? p.at(x + 1, y) : p.at(x, y + 1)).o ?? LINE;
      out.push([x, y, c]);
    }
  for (const [x, y, c] of out) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
  return cv;
}

// Eye shapes (src/looks.js EYE_SHAPES), the left eye from its outer corner,
// rows from just above the eye: K dark, i iris, d iris shadow, w shine.
const EYE_MAPS = {
  round: [".KK.", "KKKK", "Kwdi", "iddi", "iiii", ".dd."],
  phoenix: ["K", "KKKKK", ".wddi", ".iiii", "..ddd"],
  gentle: ["", "..KK", "KKKK", "Kwdi", "Kiii", "Kddd"],
  sharp: ["K", "KKKK", "Kwdi", "Kiii", "dddd"],
  sleepy: ["", "", "KKKK", "Kwdi", "Kiii", "dddd"],
  sparkly: ["KKKK", "Kwwi", "Kwdi", "iiii", "iiwi", "dddd"],
  fierce: ["KK", ".KKKK", ".Kwdi", "..iii", "...dd"],
  crescent: ["", "", ".KK.", "K..K", "K..K"],
  closed: ["", "", "", "K..K", ".KK."],
};
// Iris colours by name; a look may also give a colour of its own.
const IRIS = { brown: "#6a4430", dark: "#3a2c2a", amber: "#c08a2a", grey: "#7a8490", blue: "#4a5a8c", red: "#c02a2a", gold: "#e0b030", violet: "#8a4ab8" };

// Body plan per stage of life: head radius, robe length, legs below the
// hem, shoulder and hem half-widths, sleeve widths at shoulder and cuff.
const BODY = {
  baby: { r: 9, torso: 9, leg: 3, sh: 5, hem: 7, sl: [3, 4] },
  child: { r: 9, torso: 14, leg: 5, sh: 6, hem: 8, sl: [3, 5] },
  teen: { r: 10, torso: 19, leg: 7, sh: 7, hem: 10, sl: [4, 6] },
  adult: { r: 11, torso: 23, leg: 8, sh: 8, hem: 12, sl: [4, 7] },
  middle: { r: 11, torso: 23, leg: 8, sh: 9, hem: 13, sl: [4, 7] },
  old: { r: 11, torso: 21, leg: 7, sh: 8, hem: 12, sl: [4, 7] },
};

// A look from src/looks.js, or one of the stock looks below.
function norm(look) {
  if (look.hair?.cap) return look;
  return { ...look, hair: STOCK_HAIR[look.female ? 1 : 0], hairColor: look.hairColor ?? "#2b2222", skin: "#f0c8a0", stage: look.baby ? "baby" : look.child ? "child" : look.stage ?? "adult" };
}
const STOCK_HAIR = [
  { back: "none", cap: "full", fringe: "none", top: "knot", tail: "none", locks: false, band: false, orn: null },
  { back: "long", cap: "full", fringe: "straight", top: "bun", tail: "none", locks: false, band: false, orn: "gold" },
];

// A filled ellipse centred on a pixel (odd widths); rows below y1 are left off.
function ell(p, cx, cy, rx, ry, c, y1 = Infinity) {
  for (let dy = -ry; dy <= ry && cy + dy <= y1; dy++) {
    let hw = -1;
    for (let dx = 0; dx <= rx; dx++) if ((dx / rx) ** 2 + (dy / ry) ** 2 <= 1.02) hw = dx;
    if (hw >= 0) p.r(cx - hw, cy + dy, hw * 2 + 1, 1, c);
  }
}

// A filled polygon: the pixels whose centres fall inside it.
function poly(p, pts, c) {
  const ys = pts.map((q) => q[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > y + 0.5 !== yj > y + 0.5) xs.push(((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi);
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.floor(xs[k] - 0.5) + 1, x1 = Math.ceil(xs[k + 1] - 0.5) - 1;
      if (x1 >= x0) p.r(x0, y, x1 - x0 + 1, 1, c);
    }
  }
}

// A sleeve from the shoulder (x0, y0) to the wrist (x1, y1), widening from
// w0 to w1, edged a shade darker, the cuff in the trim and the hand beyond.
function sleeve(p, [x0, y0], [x1, y1], [w0, w1], R, CR, SK, fist = 3) {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
  const quad = (q, ax, ay, bx, by, wa, wb) =>
    poly(q, [[ax + (nx * wa) / 2, ay + (ny * wa) / 2], [bx + (nx * wb) / 2, by + (ny * wb) / 2], [bx - (nx * wb) / 2, by - (ny * wb) / 2], [ax - (nx * wa) / 2, ay - (ny * wa) / 2]]);
  const edge = maskOf((q) => quad(q, x0, y0, x1 + ux, y1 + uy, w0 + 2, w1 + 2)), main = maskOf((q) => quad(q, x0, y0, x1, y1, w0, w1));
  p.R = R;
  for (let y = 0; y < FIG_H; y++) for (let x = 0; x < FIG_W; x++) if (inM(edge, x, y) && !inM(main, x, y) && p.at(x, y)) p.r(x, y, 1, 1, R.d2);
  shapeFill(p, main, R, { sx: w1 >= 6 ? 2 : 1 });
  const side = nx + ny * 0.4 >= 0 ? 1 : -1;
  for (const [t, f] of [[0.42, 0.5], [0.7, 0.4]]) {
    const w = w0 + (w1 - w0) * t, cxp = x0 + (x1 - x0) * t, cyp = y0 + (y1 - y0) * t;
    if (w < 3) continue;
    p.line(cxp + side * nx * w * 0.05, cyp + side * ny * w * 0.05 - uy, cxp + side * nx * (w / 2 - 0.6), cyp + side * ny * (w / 2 - 0.6) + uy * f, R.d1);
    p.px(Math.round(cxp - side * nx * (w / 2 - 1.5)), Math.round(cyp - side * ny * (w / 2 - 1.5) - uy), R.l1);
  }
  shapeFill(p, maskOf((q) => quad(q, x1 - ux * 2.2, y1 - uy * 2.2, x1, y1, w1 - 0.4, w1)), CR, { sx: 1, deep: false });
  const hx = Math.round(x1 + ux * (fist / 2 + 0.6) - fist / 2), hy = Math.round(y1 + uy * (fist / 2 + 0.6) - fist / 2);
  shapeFill(p, maskOf((q) => q.r(hx, hy, fist, fist)), SK, { sx: 1, deep: false });
  p.R = SK;
  p.px(hx, hy, SK.l1);
}

// Hair behind the head and body: its length, and tails that hang behind.
function hairBack(p, look, cx, cy, r, top) {
  const h = look.hair, HR = ramp(look.hairColor);
  if (look.stage === "baby") return;
  const back = { ...HR, back: true };
  const k = r / 10, X = (dx) => cx + 0.5 + dx * k, Y = (dy) => cy + dy * k;
  const end = { nape: cy + r + 2, shoulder: top + 5, long: top + Math.round((FEET - top) * 0.55), veryLong: FEET - 3 }[h.back];
  const man = !look.female && look.stage !== "child";
  if (end && man) {
    const sw = BODY[look.stage]?.sh ?? 8;
    shapeFill(p, maskOf((q) => poly(q, [[X(-11), Y(-5)], [X(11), Y(-5)], [X(10), cy + 3], [cx + 0.5 + sw - 1, top + 2], [cx + 0.5 + sw - 1, end], [cx + 0.5 - sw + 1, end], [cx + 0.5 - sw + 1, top + 2], [X(-10), cy + 3]])), back, { base: HR.d1, lit: HR.b, dark: HR.d2, darker: HR.d2 });
  } else if (end) {
    shapeFill(p, maskOf((q) => poly(q, [[X(-11), Y(-5)], [X(11), Y(-5)], [X(12.5), end - 3], [X(10), end], [X(-10), end], [X(-12.5), end - 3]])), back, { base: HR.d1, lit: HR.b, dark: HR.d2, darker: HR.d2 });
    p.R = back;
    for (const dx of [-9, 9]) p.line(X(dx), Y(4), X(dx * 1.05), end - 2, HR.d2);
    p.line(X(-11), Y(2), X(-11.8), end - 4, HR.b);
    if (end - Y(4) > 8) for (const dx of [-11.5, 11.5]) { p.px(X(dx * 0.9), end - 1, HR.d2); p.px(X(dx * 0.6), end, HR.d2); }
  }
  const tail = (pts, strand) => {
    shapeFill(p, maskOf((q) => poly(q, pts)), HR, { sx: 1 });
    p.R = HR;
    p.line(...strand, HR.d1);
    p.line(strand[0] - 1, strand[1] + 1, strand[2] - 1, strand[3] - 2, HR.l1);
  };
  if (h.tail === "twin")
    for (const s of [-1, 1]) {
      tail([[X(s * 10), Y(-5)], [X(s * 14), Y(-3)], [X(s * 15.5), top + 2], [X(s * 14.5), top + 8], [X(s * 12.5), top + 10], [X(s * 12), Y(4)]], [X(s * 13.5), Y(1), X(s * 14), top + 6]);
      p.R = ramp(ORN.ribbon);
      p.r(X(s * 12.5) - 1, Y(-5), 3, 2, ORN.ribbon);
      p.px(X(s * 12.5) + 1, Y(-4), p.R.d1);
    }
  if (h.tail === "pony") tail([[X(4), Y(-17)], [X(9), Y(-17)], [X(14), Y(-9)], [X(15.5), Y(2)], [X(14.5), top + 7], [X(12), top + 9], [X(12.5), Y(4)], [X(10), Y(-7)]], [X(13), Y(-6), X(13.5), top + 5]);
  if (h.tail === "lowPony") tail([[X(8), Y(4)], [X(12), Y(4)], [X(14), top + 4], [X(13.5), top + 10], [X(11.5), top + 12], [X(10.5), top + 3]], [X(12.5), top, X(12.5), top + 9]);
}

// Hair in front: the cap, the fringe, side locks, what is pinned on top,
// and a braid or tail worn over the shoulder.
function hairFront(p, look, cx, cy, r, top, hatted) {
  const h = look.hair, c = look.hairColor, HR = ramp(c), SK = ramp(look.skin, "skin");
  const k = r / 10, X = (dx) => cx + 0.5 + dx * k, Y = (dy) => cy + dy * k;
  p.R = HR;
  if (look.stage === "baby") {
    ell(p, cx, cy - r + 1, 3, 1, c);
    p.px(cx, cy - r - 1, c); p.px(cx + 1, cy - r - 2, c);
    p.r(cx - 2, cy - r, 2, 1, HR.l1); p.r(cx + 2, cy - r + 1, 2, 1, HR.d1);
    return;
  }
  if (h.cap === "bald") {
    p.R = SK;
    p.r(cx - 5, cy - r + 2, 4, 1, SK.l1);
    p.r(cx - 4, cy - r + 3, 2, 1, SK.l2);
    p.px(cx - 6, cy - r + 4, SK.l1);
    if (look.monk) for (let i = 0; i < 6; i++) p.px(cx - 2 + (i % 3) * 2, cy - r + 4 + Math.floor(i / 3) * 2, SK.d2);
    return;
  }
  const thin = h.cap === "thin", man = !look.female && look.stage !== "child";
  const capRy = Math.round(r * (thin ? 0.6 : 0.7)), capCy = cy - capRy - (thin ? 1 : 0), capTop = capCy - capRy, capRx = r + (thin || man ? 1 : 2);
  ell(p, cx, capCy, capRx, capRy, c);
  p.R = SK;
  for (let y = cy - Math.round(r * 0.5); y <= cy; y++) {
    const hw = Math.floor(r * Math.sqrt(Math.max(0, 1 - ((y - cy) / r) ** 2)));
    p.r(cx - hw, y, hw * 2 + 1, 1, SK.b);
  }
  p.R = HR;
  const fringe = h.fringe ?? "none";
  const F = {
    spiky: [[-11, -8], [11, -8], [11, -3], [8, 2], [6, -4], [4, 0], [1, -5], [-1, -1], [-3, -5], [-5, 0], [-7, -4], [-9, 2], [-11, -3]],
    straight: man ? [[-11, -8], [11, -8], [11, 1], [9.5, 1], [9, -1.5], [-9, -1.5], [-9.5, 1], [-11, 1]] : [[-11, -8], [11, -8], [11, 3], [9.5, 3], [9, 0.5], [-9, 0.5], [-9.5, 3], [-11, 3]],
    side: [[-11, -8], [11, -8], [11, -1], [9, -3.5], [5, -3.5], [1, -2.5], [-3, -1], [-6.5, 1], [-9, 3.5], [-11, 4]],
    parted: [[-11, -8], [11, -8], [11, 3], [9, 0], [6, -3], [2, -5], [0, -6.5], [-2, -5], [-6, -3], [-9, 0], [-11, 3]],
    none: [[-11, -8], [11, -8], [11, 0], [9, -2.5], [5, -4], [0, -4.5], [-5, -4], [-9, -2.5], [-11, 0]],
  }[fringe] ?? [];
  poly(p, F.map(([dx, dy]) => [X(dx), Y(dy) + (thin && fringe === "none" ? -1 : 0)]), c);
  if (!thin)
    for (const s of [-1, 1]) {
      const low = h.locks ? (man ? 8 : 11) : man ? 3 : 4;
      if (man) poly(p, [[X(s * 11.5), Y(-4)], [X(s * 9.5), Y(-4)], [X(s * 9.5), Y(low)], [X(s * 11), Y(low - 2)]], c);
      else poly(p, [[X(s * 12.5), Y(-4)], [X(s * 9), Y(-4)], [X(s * 9), Y(low)], [X(s * 12), Y(low - 3)]], c);
    }
  const top0 = hatted ? "none" : h.top;
  if (top0 === "knot" || top0 === "crown") ell(p, cx, capTop - 2, 4, 3, c);
  else if (top0 === "bun") ell(p, cx, capTop - 2, 5, 3, c);
  else if (top0 === "tallBun") { ell(p, cx, capTop - 1, 5, 2, c); ell(p, cx, capTop - 6, 3, 5, c); }
  else if (top0 === "doubleBun") for (const s of [-1, 1]) ell(p, Math.round(X(s * 8.5)) - (s < 0 ? 1 : 0), capTop + 2, 4, 4, c);
  else if (top0 === "loops") for (const s of [-1, 1]) ell(p, Math.round(X(s * 10.5)) - (s < 0 ? 1 : 0), capTop + 1, 3, 4, c);
  else if (top0 === "spiky") for (const [dx, lean] of [[-8, -3], [-3, -1], [2, 1], [7, 3]]) poly(p, [[X(dx - 2.5), capTop + 3], [X(dx + 2.5), capTop + 3], [X(dx + lean), capTop - 4]], c);
  shadeHair(p, HR, cx, cy, r, capCy, capRx, capRy);
  const strand = (x0, y0, x1, y1) => { p.line(x0, y0, x1, y1, HR.d1); if (x0 < cx + 2) p.line(x0 - 1, y0, x1 - 1, y1 - 1, HR.l1); };
  if (fringe === "spiky") for (const [dx, dy] of [[-7, -3], [-4, -4], [2, -4], [6, -3]]) { p.px(X(dx), Y(dy), HR.l1); p.px(X(dx + 1), Y(dy + 2), HR.d1); }
  if (fringe === "straight") for (const dx of [-5, -1, 3, 7]) strand(X(dx), Y(-4), X(dx), Y(man ? -2.5 : -0.5));
  if (fringe === "side") { strand(X(-7), Y(0), X(1), Y(-5)); strand(X(-2), Y(-1.5), X(6), Y(-5)); }
  if (fringe === "parted") { p.line(X(0), Y(-6), X(-5), Y(-2), HR.d1); p.line(X(-1), Y(-7), X(-6), Y(-3), HR.l1); p.line(X(1), Y(-6), X(6), Y(-2), HR.d2); }
  if (fringe === "none") { p.line(X(-4), Y(-6), X(-8), Y(-3), HR.d1); p.line(X(4), Y(-6), X(8), Y(-3), HR.d2); }
  if (!thin) for (const s of [-1, 1]) if (h.locks) p.line(X(s * 10.5), Y(-1), X(s * 10.5), Y(man ? 6 : 9), s < 0 ? HR.l1 : HR.d2);
  if (h.band) {
    const RB = ramp(ORN.ribbon);
    p.R = RB;
    p.r(X(-11), Y(-6), X(11) - X(-11), 1, RB.l1);
    p.r(X(-11), Y(-5), X(11) - X(-11), 1, RB.b);
    p.r(X(6), Y(-6), X(11) - X(6), 2, RB.d1);
    p.line(X(11.5), Y(-5), X(14), Y(1), RB.b);
    p.line(X(12.5), Y(-5), X(15.5), Y(-1), RB.d1);
  }
  if (!hatted) {
    if (h.top === "knot" || h.top === "crown") {
      const T = h.orn === "gold" ? ramp(ORN.gold) : { ...HR, b: HR.d2, l1: HR.d1 };
      p.R = T;
      p.r(cx - 3, capTop, 7, 1, T.b); p.px(cx - 3, capTop, T.l1); p.px(cx + 3, capTop, T.d1 ?? T.b);
      if (h.top === "crown") {
        const G = ramp(ORN.gold);
        p.R = G;
        p.r(cx - 3, capTop - 4, 7, 4, G.b);
        p.r(cx - 3, capTop - 4, 7, 1, G.l1); p.px(cx - 3, capTop - 3, G.l1);
        p.r(cx + 2, capTop - 3, 1, 3, G.d1); p.r(cx - 3, capTop - 1, 7, 1, G.d2);
        p.px(cx, capTop - 3, C.red); p.px(cx, capTop - 2, shade(C.red, -0.3));
        p.line(cx - 6, capTop - 2, cx + 6, capTop - 2, G.l1);
        p.px(cx + 6, capTop - 2, G.d1);
      }
    } else if (h.top === "bun") {
      p.r(cx - 4, capTop, 9, 1, HR.d2);
    } else if (h.top === "loops") {
      for (const s of [-1, 1]) { const x = Math.round(X(s * 10.5)) - (s < 0 ? 1 : 0); p.r(x, capTop, 1, 3, HR.o); p.px(x, capTop + 3, HR.d2); }
    }
    pins(p, look, cx, capTop, X);
  }
  if (h.tail === "braid" || h.tail === "side") {
    const s = h.tail === "braid" ? 1 : -1, x = Math.round(X(s * 9.5)) - 1, y0 = Math.round(Y(5)), y1 = top + Math.round((FEET - top) * 0.45);
    p.R = HR;
    if (h.tail === "braid") for (let y = y0; y < y1; y += 2) {
      const odd = ((y - y0) / 2) % 2;
      p.r(x, y, 3, 2, HR.b);
      p.px(x + (odd ? 1 : 0), y, HR.l1); p.px(x + 2, y + 1, HR.d1); p.px(x + (odd ? 0 : 1), y + 1, HR.d2);
    }
    else {
      shapeFill(p, maskOf((q) => poly(q, [[x - 0.5, y0], [x + 3.5, y0], [x + 4.5, y1 - 3], [x + 1.5, y1 + 1], [x - 1.5, y1 - 3]])), HR, { sx: 1 });
      p.R = HR;
      p.line(x + 1, y0 + 2, x + 1, y1 - 3, HR.l1);
      p.line(x + 2, y0 + 3, x + 2, y1 - 2, HR.d1);
    }
    const RB = ramp(ORN.ribbon);
    p.R = RB;
    p.r(x, y1, 3, 1, RB.b); p.px(x + 2, y1, RB.d1);
  }
}

// The front hair, painted flat in its colour, shaded on its ramp: a sheen
// arcing round the crown on the lit side, the right side and the ends in
// shadow, a lit rim on the left.
function shadeHair(p, HR, cx, cy, r, capCy, capRx, capRy) {
  const isH = (x, y) => p.at(x, y) === HR;
  const pts = [];
  for (let y = 0; y < Math.min(FIG_H, cy + r + 4); y++) for (let x = 0; x < FIG_W; x++) if (isH(x, y)) pts.push([x, y]);
  const capTop = capCy - capRy;
  const col = new Map();
  for (const [x, y] of pts) {
    let c = HR.b;
    const fx = (x - cx) / capRx, fy = (y + 0.5 - capCy) / capRy, e = fx * fx + fy * fy;
    if (y < capTop + 1) {
      if (!isH(x - 1, y) || !isH(x, y - 1)) c = HR.l1;
      if (!isH(x + 1, y) || !isH(x + 2, y) || (!isH(x, y + 1) && y < capTop)) c = HR.d1;
    } else {
      if (e > 0.46 && e < 0.64 && fy < 0.15 && fx < 0.4 && fx > -0.9) c = HR.l1;
      if (e > 0.5 && e < 0.6 && fy < -0.05 && fx > -0.7 && fx < -0.15) c = HR.l2;
      if (fx > 0.5) c = HR.d1;
      if (!isH(x, y + 1)) c = x > cx ? HR.d2 : HR.d1;
      if (!isH(x + 1, y) && x > cx) c = HR.d2;
    }
    col.set(y * FIG_W + x, c);
  }
  for (const [x, y] of pts) p.r(x, y, 1, 1, col.get(y * FIG_W + x));
}

// Hairpins and ornaments, each on its own ramp.
function pins(p, look, cx, capTop, X) {
  const h = look.hair;
  if (h.orn === "gold") {
    const G = ramp(ORN.gold);
    p.R = G;
    p.line(X(2), capTop - 1, X(10), capTop - 6, G.b); p.line(X(3), capTop, X(10), capTop - 5, G.d1);
    p.px(X(10), capTop - 6, G.l2); p.r(X(9), capTop - 5, 1, 3, G.b); p.px(X(9), capTop - 3, G.d1);
  } else if (h.orn === "jade") {
    const J = ramp(ORN.jade);
    p.R = J;
    p.line(X(-6), capTop - 1, X(6), capTop - 4, J.b); p.line(X(-5), capTop, X(6), capTop - 3, J.d2);
    p.px(X(6), capTop - 4, J.l2); p.px(X(-6), capTop - 1, J.l1);
  } else if (h.orn === "flower") {
    const Fl = ramp(ORN.flower), x = Math.round(X(-9));
    p.R = Fl;
    ell(p, x, capTop + 3, 2, 2, Fl.b);
    p.px(x - 1, capTop + 2, Fl.l2); p.px(x + 1, capTop + 4, Fl.d1); p.px(x + 2, capTop + 3, Fl.d1); p.px(x, capTop + 5, Fl.d2);
    p.px(x, capTop + 3, C.gold); p.px(X(-12), capTop + 6, Fl.b);
  } else if (h.orn === "ribbon") {
    const RB = ramp(ORN.ribbon), x = Math.round(X(10));
    p.R = RB;
    poly(p, [[x - 3, capTop], [x + 0.5, capTop + 2.5], [x - 3, capTop + 5]], RB.b);
    poly(p, [[x + 4, capTop], [x + 0.5, capTop + 2.5], [x + 4, capTop + 5]], RB.d1);
    p.px(x - 3, capTop, RB.l1); p.px(x - 3, capTop + 1, RB.l1); p.px(x, capTop + 2, RB.d2);
  }
}

// Headwear over the hair; a mask or a veil covers the lower face instead.
function hat(p, look, cx, cy, r) {
  const k = r / 10, X = (dx) => cx + 0.5 + dx * k, kind = look.hat, BK = ramp("#2e2c34"), SK = ramp(look.skin, "skin");
  const capTop = cy - 2 * Math.round(r * 0.7);
  if (kind === "straw") {
    const by = cy - Math.round(r * 0.6), W = ramp(C.straw);
    p.R = SK;
    for (let x = cx - r + 1; x <= cx + r - 1; x++) if (p.at(x, by + 2) === SK) p.px(x, by + 2, SK.d1);
    shapeFill(p, maskOf((q) => { poly(q, [[cx + 0.5, by - 11], [X(16), by + 0.5], [X(-16), by + 0.5]]); ell(q, cx, by, r + 9, 2); }), W, { sx: 3, sy: 0, deep: false });
    p.R = W;
    p.r(cx - r - 8, by + 1, 2 * r + 17, 1, W.d2);
    p.r(cx - r - 8, by, 4, 1, W.l1);
    for (const dx of [-9, -3, 3, 9]) p.line(cx + 0.5, by - 10, X(dx), by - 1, dx > 0 ? W.d2 : W.d1);
    p.line(cx - 1, by - 9, X(-6), by - 2, W.l2);
    p.R = ramp("#8a5a3a");
    p.r(cx - 6, by - 2, 13, 1, p.R.b); p.r(cx + 3, by - 2, 4, 1, p.R.d1);
  } else if (kind === "scholar") {
    p.R = BK;
    shapeFill(p, maskOf((q) => { ell(q, cx, cy - 8, r + 1, 7, null, cy - 5); ell(q, cx, capTop, 6, 4); }), BK, { sx: 3, base: BK.b, lit: BK.l1 });
    p.R = BK;
    p.r(cx - r, cy - 6, 2 * r + 1, 1, BK.l1);
    p.r(cx - 4, capTop - 3, 4, 1, BK.l2);
    p.r(cx + 3, cy - 6, r - 3, 1, BK.b);
  } else if (kind === "helmet") {
    const S = ramp(STEEL), Rd = ramp(C.red);
    shapeFill(p, maskOf((q) => ell(q, cx, cy - 6, r + 2, 9, null, cy - 4)), S, { sx: 3, hi: 3 });
    p.R = S;
    p.r(cx - r - 2, cy - 4, 2 * r + 5, 2, S.d1);
    p.r(cx - r - 2, cy - 4, 2 * r + 5, 1, S.b);
    p.r(cx + r - 2, cy - 4, 5, 2, S.d2);
    p.r(cx, cy - 15, 1, 11, S.d1); p.r(cx - 1, cy - 14, 1, 10, S.l1);
    p.line(cx - 8, cy - 9, cx - 4, cy - 13, S.l2);
    p.R = Rd;
    ell(p, cx, cy - 16, 2, 3, Rd.b);
    p.px(cx - 1, cy - 18, Rd.l1); p.r(cx + 1, cy - 16, 1, 2, Rd.d1);
    p.px(cx + 1, cy - 20, Rd.b);
    p.R = S;
    for (const s of [-1, 1]) { const x = s < 0 ? cx - r - 2 : cx + r; p.r(x, cy - 3, 3, 7, S.d1); p.r(x, cy - 3, 1, 7, s < 0 ? S.b : S.d1); p.r(x + 2, cy - 3, 1, 7, S.d2); }
  } else if (kind === "official") {
    shapeFill(p, maskOf((q) => { ell(q, cx, cy - 8, r + 1, 6, null, cy - 5); ell(q, cx, capTop + 1, 5, 4); }), BK, { sx: 3 });
    p.R = BK;
    p.r(cx - r - 11, cy - 10, 2 * r + 23, 1, BK.b);
    p.r(cx - r - 12, cy - 12, 3, 4, BK.b); p.px(cx - r - 12, cy - 12, BK.l1);
    p.r(cx + r + 10, cy - 12, 3, 4, BK.d1);
    p.r(cx - r, cy - 6, 2 * r + 1, 1, BK.l1);
    p.r(cx - 3, capTop - 2, 3, 1, BK.l2);
  } else if (kind === "crown") {
    const G = ramp(C.gold);
    shapeFill(p, maskOf((q) => { q.r(cx - 6, capTop - 1, 13, 4); for (const dx of [-6, 0, 6]) poly(q, [[cx + dx - 1.5, capTop - 1], [cx + dx + 2.5, capTop - 1], [cx + dx + 0.5, capTop - 5]]); }), G, { sx: 2, hi: 2 });
    p.R = G;
    p.r(cx - 6, capTop + 2, 13, 1, G.d2);
    p.px(cx, capTop, C.red); p.px(cx - 4, capTop + 1, "#5ac0d8"); p.px(cx + 4, capTop + 1, "#3a8ab0");
  } else if (kind === "mask" || kind === "veil") {
    const M = ramp(kind === "mask" ? "#3a3a3a" : "#ece6ee");
    shapeFill(p, maskOf((q) => { for (let y = cy + 5; y <= cy + r - 1; y++) { const hw = Math.floor(r * Math.sqrt(Math.max(0, 1 - ((y - cy) / r) ** 2))); q.r(cx - hw, y, hw * 2 + 1, 1); } }), M, { sx: 2, rim: false });
    p.R = M;
    p.r(cx - r + 1, cy + 5, 2 * r - 1, 1, M.l1);
    p.line(cx - 3, cy + 7, cx - 2, cy + r - 2, M.d1); p.line(cx + 3, cy + 7, cx + 2, cy + r - 2, M.d1);
    if (kind === "mask") { p.line(X(10), cy + 5, X(14), cy + 9, M.b); p.line(X(10), cy + 6, X(13), cy + 11, M.d1); }
  }
}

// ------------------------------------------------------------------ marks

// Marks of a hidden nature: a fox's tails, horns, wings, a halo, and the
// other bloods'. Drawn behind the body (markBack) and in front of the head
// (markFront) once the hero's nature is out.
const FOX_MARKS = new Set(["nineTails", "foxTail"]);
function foxTails(p, look, cx, waist, phase = 0) {
  const k = (BODY[look.stage] ?? BODY.adult).r / 11;
  const ink = "#6a2c12", dk = "#bd5a20", fur = "#ea8a3c", lt = "#f8b46a", tip = "#fff8ee", tipDk = "#e6d8c6";
  const x0 = cx + 0.5, y0 = waist + 1;
  const nine = look.mark === "nineTails";
  const fan = nine
    ? [[202, 20], [-22, 20], [172, 22], [8, 22], [144, 28], [36, 28], [118, 36], [62, 36], [90, 42]]
    : [[48, 26]];
  const tails = fan.map(([a, reach], i) => {
    const sw = Math.sin((phase + i * 0.17) * 6.283);
    const r = ((a + sw * 2.5) * Math.PI) / 180, L = reach * k;
    const ex = x0 + Math.cos(r) * L + sw * 1.6 * k, ey = Math.max(4, y0 - Math.sin(r) * L);
    const out = a > 160 || a < 20 ? 0 : a > 90 ? -1 : a < 90 ? 1 : 0;
    const mx = x0 + Math.cos(r) * L * 0.5 + out * 4 * k, my = y0 - Math.sin(r) * L * 0.5 + 4 * k;
    const w = (nine ? 5.2 : 6) * k;
    const pts = [];
    for (let j = 0; j <= 26; j++) {
      const t = j / 26, u = 1 - t;
      const x = u * u * x0 + 2 * u * t * mx + t * t * ex, y = u * u * y0 + 2 * u * t * my + t * t * ey;
      const rad = w * Math.min(1, 0.35 + t * 1.6) * (t > 0.8 ? Math.sqrt(Math.max(0.12, (1 - t) / 0.2)) : 1);
      pts.push([x, y, Math.max(1, rad), t]);
    }
    return pts;
  });
  const dot = (x, y, r, c) => { const q = Math.max(1, Math.round(r)); ell(p, Math.round(x), Math.round(y), q, q, c); };
  for (const pts of tails) {
    for (const [x, y, r] of pts) dot(x, y, r + 1, ink);
    for (const [x, y, r, t] of pts) dot(x, y, r, t > 0.76 ? tipDk : dk);
    for (const [x, y, r, t] of pts) if (r > 2) dot(x - 0.5, y - 0.7, r - 1.2, t > 0.76 ? tip : fur);
    for (const [x, y, r, t] of pts) if (r > 3.5 && t > 0.2 && t < 0.68) dot(x - 1.2, y - 1.6, r - 3.2, lt);
  }
}
function foxEars(p, look, cx, cy, r) {
  const c = "#c4602a", ink = "#4a1c0c", inner = "#f0d6bc", lt = "#dc8146", k = r / 11;
  const hc = look.hairColor ?? "#2a2025";
  const edge = (x) => Math.round(cy - Math.sqrt(Math.max(0, r * r - (x - cx - 0.5) ** 2)));
  for (const s of [-1, 1]) {
    const e = k * 0.75, X = (dx) => cx + 0.5 + s * (1.6 * k + dx * e), by = cy - r + 2.5 * k, ty = by - 12 * e, mid = by - 4.5 * e;
    const ear = (g, col, inset = 0) => poly(p, [
      [X(3 + inset) - s * g, by + g], [X(2.4 + inset) - s * g, mid], [X(5 + inset * 0.6) - s * g, ty + 2.5 * e + inset * 0.6],
      [X(9.2) + s * g * 0.6, ty - g + inset * 1.4], [X(11.6 - inset) + s * g, mid], [X(11 - inset) + s * g, by + g],
    ], col);
    ear(1, ink);
    ear(0, c);
    p.r(Math.round(X(3.4)), Math.round(mid), 1, 2, lt);
    ear(0, inner, 2.2);
    for (let x = Math.round(Math.min(X(2), X(12))); x <= Math.round(Math.max(X(2), X(12))); x++) p.r(x, edge(x) + 1, 1, Math.max(1, Math.round(by + 2 - edge(x))), hc);
  }
}
function hookTail(p, P0, P1, P2, width, { ink, body, light, tipC = null, tipFrom = 1 }, phase = 0, i = 0) {
  const sw = Math.sin((phase + i * 0.17) * 6.283);
  const [x0, y0] = P0, [mx, my] = [P1[0] + sw * 0.8, P1[1]], [ex, ey] = [P2[0] + sw * 2, P2[1] - Math.abs(sw) * 0.8];
  const pts = [];
  for (let j = 0; j <= 30; j++) {
    const t = j / 30, u = 1 - t;
    pts.push([u * u * x0 + 2 * u * t * mx + t * t * ex, u * u * y0 + 2 * u * t * my + t * t * ey, Math.max(0.6, width(t)), t]);
  }
  const dot = (x, y, rr, c) => { const q = Math.max(1, Math.round(rr)); ell(p, Math.round(x), Math.round(y), q, q, c); };
  for (const [x, y, rr] of pts) dot(x, y, rr + 1, ink);
  for (const [x, y, rr, t] of pts) dot(x, y, rr, tipC && t >= tipFrom ? tipC : body);
  for (const [x, y, rr, t] of pts) if (rr > 1.6 && !(tipC && t >= tipFrom)) dot(x - 0.4, y - 0.8, rr - 1, light);
  return { pts, ex, ey };
}
function bloodTail(p, look, cx, waist, phase) {
  const m = look.mark, k = (BODY[look.stage] ?? BODY.adult).r / 11, x0 = cx + 0.5, y0 = waist + 1;
  const X = (d) => x0 + d * k, Y = (d) => y0 + d * k;
  if (m === "dragon") {
    const { pts, ex, ey } = hookTail(p, [X(3), Y(0)], [X(26), Y(16)], [X(19), Y(-7)], (t) => 4 * k * (1 - t * 0.6), { ink: "#123a32", body: "#2f8a72", light: "#5cc4a0" }, phase, 0);
    for (let j = 3; j < pts.length - 2; j += 3) { const [x, y] = pts[j]; p.px(Math.round(x), Math.round(y + 1), "#e8c050"); p.px(Math.round(x + 1), Math.round(y - 1), "#1f6a58"); }
    poly(p, [[ex - 3 * k, ey + 2], [ex - 1, ey - 6 * k], [ex + 2 * k, ey - 1], [ex + 5 * k, ey - 4 * k], [ex + 3 * k, ey + 2 * k]], "#a83a1a");
    poly(p, [[ex - 2 * k, ey + 1], [ex - 0.5, ey - 4.5 * k], [ex + 1.5 * k, ey - 0.5], [ex + 3.8 * k, ey - 2.6 * k], [ex + 2 * k, ey + 1.4 * k]], "#f08a3a");
  } else if (m === "horns" || m === "demonWings") {
    const { ex, ey } = hookTail(p, [X(3), Y(0)], [X(24), Y(12)], [X(19), Y(-11)], (t) => 1.6 * k * (1 - t * 0.3), { ink: "#120a10", body: "#2a1622", light: "#5a2a3a" }, phase, 0);
    poly(p, [[ex - 4 * k, ey + 2], [ex, ey - 5.5 * k], [ex + 4 * k, ey + 2], [ex, ey + 3.5 * k]], "#120a10");
    poly(p, [[ex - 2.6 * k, ey + 1], [ex, ey - 4 * k], [ex + 2.6 * k, ey + 1], [ex, ey + 2.2 * k]], "#8a1a2a");
  } else if (m === "wolf") {
    hookTail(p, [X(3), Y(-1)], [X(17), Y(2)], [X(21), Y(15)], (t) => 5.2 * k * Math.min(1, 0.45 + t * 1.4) * (t > 0.82 ? Math.sqrt(Math.max(0.15, (1 - t) / 0.18)) : 1), { ink: "#2a2a30", body: "#7c7c86", light: "#b4b4bc", tipC: "#3a3a42", tipFrom: 0.82 }, phase, 0);
  } else if (m === "phoenix") {
    [[16, 8, 15, -16], [22, 6, 23, -6], [20, 12, 25, 6]].forEach(([bx, by, tx, ty], i) => {
      const { ex, ey } = hookTail(p, [X(2), Y(0)], [X(bx), Y(by)], [X(tx), Y(ty)], (t) => k * (0.9 + t * 1.4), { ink: "#5a1408", body: i === 1 ? "#e85a20" : "#d8401c", light: "#f8a040" }, phase, i);
      ell(p, Math.round(ex), Math.round(ey), Math.max(2, Math.round(2.6 * k)), Math.max(2, Math.round(2.6 * k)), "#5a1408");
      ell(p, Math.round(ex), Math.round(ey), Math.max(1, Math.round(1.9 * k)), Math.max(1, Math.round(1.9 * k)), "#f8c840");
      p.px(Math.round(ex), Math.round(ey), "#2a6ab0");
    });
  }
}
function markBack(p, look, cx, waist, top, phase = 0) {
  const m = look.mark;
  if (!m) return;
  if (m === "nineTails" || m === "foxTail") return foxTails(p, look, cx, waist, phase);
  bloodTail(p, look, cx, waist, phase);
  if (m === "wings") {
    const c = "#f8f4ea", cd = "#d8d0bc", ink = "#8a8070";
    for (const s of [-1, 1]) {
      poly(p, [[cx + s * 4, top], [cx + s * 22, top - 13], [cx + s * 27, top - 9], [cx + s * 25, top + 6], [cx + s * 18, top + 13], [cx + s * 4, top + 12]], ink);
      poly(p, [[cx + s * 5, top + 1], [cx + s * 22, top - 12], [cx + s * 26, top - 8], [cx + s * 24, top + 5], [cx + s * 17, top + 12], [cx + s * 5, top + 11]], c);
      for (let f = 0; f < 5; f++) p.line(cx + s * (8 + f * 3), top + 11 - f, cx + s * (12 + f * 3), top + 4 - f * 2, cd);
      p.line(cx + s * 6, top + 3, cx + s * 22, top - 9, cd);
    }
  } else if (m === "demonWings") {
    const c = "#4a2a3a", cd = "#2a1622";
    for (const s of [-1, 1]) {
      poly(p, [[cx + s * 5, top + 2], [cx + s * 23, top - 10], [cx + s * 19, top + 2], [cx + s * 24, top + 7], [cx + s * 15, top + 9], [cx + s * 5, top + 12]], c);
      p.line(cx + s * 6, top + 3, cx + s * 22, top - 8, cd);
    }
  }
}
function fromHead(p, cx, cy, r, s, path, rad, cols) {
  const k = r / 11, pts = [];
  for (let j = 0; j <= 16; j++) {
    const t = j / 16, [x, y] = path(t);
    pts.push([cx + 0.5 + s * x * k, cy - r + y * k, Math.max(0.6, rad(t) * k), t]);
  }
  const dot = (x, y, rr, c) => { const q = Math.max(1, Math.round(rr)); ell(p, Math.round(x), Math.round(y), q, q, c); };
  for (const [x, y, rr] of pts) dot(x, y, rr + 0.8, cols.ink);
  for (const [x, y, rr, t] of pts) dot(x, y, rr, cols.tip && t > (cols.tipFrom ?? 0.7) ? cols.tip : cols.body);
}
function markFront(p, look, cx, cy, r) {
  const m = look.mark;
  if (FOX_MARKS.has(m)) foxEars(p, look, cx, cy, r);
  else if (m === "horns" || m === "demonWings") {
    for (const s of [-1, 1]) fromHead(p, cx, cy, r, s, (t) => [8 + t * 8 - t * t * 3, 5 - t * 6 - t * t * 8], (t) => 2.4 * (1 - t * 0.72), { ink: "#0e080c", body: "#5a4652", tip: "#c8384a", tipFrom: 0.7 });
  } else if (m === "dragon") {
    for (const s of [-1, 1]) {
      fromHead(p, cx, cy, r, s, (t) => [3.5 + t * 4, 2 - t * 11], (t) => 1.3 * (1 - t * 0.5), { ink: "#5a4010", body: "#e0b848", tip: "#f8e08a", tipFrom: 0.8 });
      fromHead(p, cx, cy, r, s, (t) => [5 + t * 4.5, -3.5 - t * 3], (t) => 1 * (1 - t * 0.5), { ink: "#5a4010", body: "#e0b848" });
    }
  } else if (m === "wolf") {
    const hc = look.hairColor ?? "#2a2025", k = r / 11;
    for (const s of [-1, 1]) {
      const X = (dx) => cx + 0.5 + s * (2.6 * k + dx * k * 0.8), by = cy - r + 3 * k;
      poly(p, [[X(0), by + 1], [X(3.5), by - 11 * k], [X(8), by + 1]], "#2a2a30");
      poly(p, [[X(1), by], [X(3.6), by - 9.5 * k], [X(7), by]], "#7c7c86");
      poly(p, [[X(2.4), by], [X(3.7), by - 6 * k], [X(5.4), by]], "#e8d6d0");
      for (let x = Math.round(Math.min(X(0), X(8))); x <= Math.round(Math.max(X(0), X(8))); x++) p.r(x, Math.round(by), 1, 2, hc);
    }
  } else if (m === "phoenix") {
    [-1, 0, 1].forEach((d) => fromHead(p, cx + d * 2, cy, r, d || 1, (t) => [Math.abs(d) * (1 + t * 3), -1 - t * 9 - (d ? 0 : 2) * t], (t) => 1.2 * (1 - t * 0.5), { ink: "#5a1408", body: "#d8401c", tip: "#f8c840", tipFrom: 0.6 }));
  } else if (m === "halo") {
    for (let a = 0; a < 24; a++) { const x = cx + Math.round(Math.cos((a / 24) * 6.283) * (r + 2)), y = cy - r - 4 + Math.round(Math.sin((a / 24) * 6.283) * 2); p.px(x, y, "#ffe27a"); }
  }
}

// ------------------------------------------------------------------ person

function person(raw, pose, phase = 0) {
  const noSword = pose === "flyerBare";
  if (noSword) pose = "flyer";
  const look = norm(raw);
  const cv = canvas(FIG_W, FIG_H);
  const p = figPainter(cv.getContext("2d"));
  const B = BODY[look.stage] ?? BODY.adult;
  const fem = !!look.female, baby = look.stage === "baby", kid = baby || look.stage === "child", old = look.stage === "old";
  const skin = look.skin, robe = look.robe, trim = look.trim ?? "#efe7d6", sash = look.sash ?? "#8a4b2f";
  const SK = ramp(skin, "skin"), RB = ramp(robe), TR = ramp(trim), SA = ramp(sash), HR = ramp(look.hairColor), ST = ramp(STEEL), G = ramp(C.gold);
  const pants = look.under ? skin : "#3b3542", boot = look.under ? shade(skin, -0.18) : "#2a2530";
  const PA = look.under ? SK : ramp(pants), BT = ramp(boot);
  const away = (R) => ({ o: R.o, d2: mixHex(R.d2, R.o, 0.5), d1: R.d2, b: R.d1, l1: R.b, l2: R.l1 });
  const sit = pose === "sit" || pose === "swordsit", walk = pose === "walkA" ? 1 : pose === "walkB" ? -1 : 0, punch = pose.startsWith("punch"), sweep = pose.startsWith("sweep");
  const cx = FIG_CX, r = B.r, S = (dx) => cx + 0.5 + dx;
  const man = !fem && !kid, sh = B.sh + (fem ? -1 : man ? 1 : 0), hem = B.hem + (fem ? 1 : 0);
  const legTop = FEET - B.leg + 1, waistAt = Math.round(B.torso * (fem ? 0.36 : 0.42));
  const dy = sit ? FEET - Math.round(B.torso * 0.45) - 2 - (legTop - B.torso + waistAt + 3) : pose === "flyer" ? -2 : 0;
  const top = legTop - B.torso + dy, waist = top + waistAt, cy = top - r - 2;
  const hemY = sit ? waist + 2 : fem ? FEET - 2 + dy : legTop - 1 + dy;
  const half = (y) => sh + ((hem - sh) * (y - top)) / Math.max(1, (sit ? legTop - 1 + dy : hemY) - top);
  const hatted = ["straw", "scholar", "helmet", "official", "crown"].includes(look.hat);
  const fill = (fn, R, o) => shapeFill(p, maskOf(fn), R, o);

  p.R = { o: "#2a1418" };
  markBack(p, look, cx, waist, top, phase);
  if (look.cape && !kid) {
    const CP = ramp(look.cape), foot = sit ? FEET : FEET - 1;
    fill((q) => poly(q, [[S(-sh - 1), top + 1], [S(sh + 1), top + 1], [S(hem + 4), foot], [S(-hem - 4), foot]]), CP, { sx: 2, base: CP.d1, lit: CP.b, dark: CP.d2, darker: CP.d2, edge: true });
    fill((q) => poly(q, [[S(-sh - 1), top + 1], [S(-sh + 2), top + 1], [S(-hem - 1), foot], [S(-hem - 4), foot]]), CP, { sx: 1, sy: 0, deep: false });
    p.R = CP;
    p.line(S(-hem - 3), foot - 1, S(-sh), top + 3, CP.l1);
    p.line(S(hem + 2), foot - 1, S(sh), top + 4, CP.d2);
  }
  hairBack(p, look, cx, cy, r, top);
  if (!sit) {
    const apart = punch ? 2 : 0, lw = r >= 10 ? 6 : 4;
    for (const s of [-1, 1]) {
      const lift = walk === s ? 2 : 0, x0 = s < 0 ? cx - 1 - apart - lw : cx + 2 + apart, foot = FEET + dy - lift;
      fill((q) => q.r(x0, legTop + dy, lw, foot - 2 - (legTop + dy)), s < 0 ? PA : away(PA), { sx: 1, sy: 0, deep: false });
      p.R = PA;
      p.r(x0, legTop + dy, lw, 1, PA.d2);
      const bx = s < 0 ? x0 - 1 : x0, bh = baby ? 2 : 3;
      fill((q) => q.r(bx, foot - (baby ? 1 : 2), lw + 1, bh), BT, { sx: 1, rim: false });
      p.R = BT;
      p.r(s < 0 ? x0 : x0 + 1, foot - (baby ? 1 : 2), 2, 1, BT.l1);
      p.px(s < 0 ? x0 : x0 + 1, foot - (baby ? 1 : 2), BT.l2);
    }
  }
  const drawUnder = () => {
    const top0 = top, hip = sit ? waist + 1 : top + Math.round(B.torso * 0.66), low = sit ? waist + 4 : legTop + (fem ? 1 : 2);
    fill((q) => poly(q, [[S(-sh), top0], [S(sh), top0], [S(half(hip) + 1), hip + 1], [S(-half(hip) - 1), hip + 1]]), SK, { sx: 2, deep: false });
    if (fem) {
      const CM = ramp("#e8b4c4");
      p.R = CM;
      for (const sd of [-1, 1]) p.r(Math.round(S(sd * (sh - 3))) - (sd < 0 ? 1 : 0), top0, 1, 3, CM.b);
      fill((q) => poly(q, [[S(-sh + 1), top0 + 3], [S(sh - 1), top0 + 3], [S(half(waist)), waist + 2], [S(-half(waist)), waist + 2]]), CM, { sx: 2 });
      p.R = CM;
      p.r(Math.round(S(-sh + 1)), top0 + 3, Math.round(2 * sh - 2), 1, CM.d1);
      p.line(cx - 1, top0 + 6, cx - 2, waist, CM.d1);
      const SC = ramp("#c8788a");
      fill((q) => poly(q, [[S(-half(hip) - 1), hip], [S(half(hip) + 1), hip], [S(half(hip) + 2), low], [S(-half(hip) - 2), low]]), SC, { sx: 2 });
      p.R = SC;
      p.r(Math.round(S(-half(hip) - 1)), hip, Math.round(2 * half(hip) + 2), 1, SC.d1);
      if (!sit) p.line(cx, hip + 2, cx, low, SC.d2);
    } else {
      const VS = ramp("#f0eee6");
      fill((q) => poly(q, [[S(-sh + 3), top0], [S(sh - 3), top0], [S(half(hip)), hip], [S(-half(hip)), hip]]), VS, { sx: 2 });
      p.R = SK;
      p.r(cx - 1, top0, 3, 2, SK.d1); p.px(cx, top0 + 2, SK.d1);
      p.R = VS;
      p.line(cx - 2, top0 + 5, cx - 3, hip - 2, VS.d1);
      const BX = ramp("#3f6ab0");
      fill((q) => poly(q, [[S(-half(hip) - 1), hip], [S(half(hip) + 1), hip], [S(half(hip) + 2), low], [S(-half(hip) - 2), low]]), BX, { sx: 2 });
      p.R = BX;
      for (let x = -Math.round(half(hip)); x <= Math.round(half(hip)) - 2; x += 3) p.line(S(x), hip + 1, S(x * 1.1), low - 1, BX.l2);
      p.r(Math.round(S(-half(hip) - 1)), hip, Math.round(2 * half(hip) + 2), 1, "#f0eee6");
      if (!sit) p.line(cx, hip + 2, cx, low, BX.d2);
    }
    if (sit) {
      const kw = hem + 1, LG = ramp(fem ? "#c8788a" : "#3f6ab0");
      fill((q) => poly(q, [[S(-half(hip) - 2), low], [S(half(hip) + 2), low], [S(kw + 1), FEET - 3], [S(-kw - 1), FEET - 3]]), LG, { sx: 3 });
      for (const sd of [-1, 1]) fill((q) => ell(q, Math.round(S(sd * (kw - 3))), FEET - 3, 5, 3), SK, { sx: 2, hi: 2 });
      fill((q) => ell(q, cx, FEET - 1, 4, 2), SK, { sx: 2, base: SK.d1, lit: SK.b, dark: SK.d2 });
    }
  };
  if (look.under) drawUnder();
  else {
    fill((q) => poly(q, [[S(-sh), top], [S(sh), top], [S(half(hemY)), hemY + 1], [S(-half(hemY)), hemY + 1]]), RB, { sx: 3, sy: 0, edge: true, hi: 2 });
    p.R = RB;
    if (sit && man) {
      const lt = hemY + 1, kw = hem + 2;
      fill((q) => poly(q, [[S(-sh), lt], [S(sh), lt], [S(kw), FEET - 4], [S(kw + 1), FEET - 1], [S(kw - 1), FEET + 1], [S(-kw + 1), FEET + 1], [S(-kw - 1), FEET - 1], [S(-kw), FEET - 4]]), PA, { sx: 4 });
      p.R = PA;
      for (const k of [-1, 1]) { p.r(Math.round(S(k * (kw - 2))) - 1, FEET - 5, 3, 2, k < 0 ? PA.l1 : PA.b); p.px(Math.round(S(k * (kw - 2))) - 1, FEET - 5, k < 0 ? PA.l2 : PA.l1); }
      poly(p, [[S(kw - 1), FEET - 3], [S(kw), FEET - 1], [S(-3), FEET + 1], [S(-4), FEET - 1]], PA.d1);
      poly(p, [[S(-kw + 1), FEET - 3], [S(-kw), FEET - 1], [S(3), FEET + 1], [S(4), FEET - 1]], PA.b);
      p.line(S(-kw + 1), FEET - 3, S(3), FEET - 1, PA.l1);
      p.R = BT;
      p.r(cx + 2, FEET - 1, 4, 2, BT.b); p.r(cx + 2, FEET, 4, 1, BT.d1);
      p.r(cx - 5, FEET - 1, 4, 2, BT.b); p.r(cx - 5, FEET, 4, 1, BT.d1);
      p.px(cx + 5, FEET - 1, BT.l1);
      p.px(cx - 5, FEET - 1, BT.l1);
      fill((q) => poly(q, [[S(-sh + 1), lt], [S(sh - 1), lt], [S(sh - 2), FEET - 4], [S(-sh + 2), FEET - 4]]), RB, { sx: 2, sy: 0, rim: false });
      p.R = TR;
      p.r(Math.round(S(-sh + 2)), FEET - 5, Math.round(2 * sh - 4), 1, TR.b);
      p.r(Math.round(S(sh - 4)), FEET - 5, 2, 1, TR.d1);
    } else if (sit) {
      const lt = hemY + 1;
      fill((q) => poly(q, [[S(-sh - 1), lt], [S(sh + 1), lt], [S(hem + 5), FEET - 2], [S(hem + 4), FEET + 1], [S(-hem - 4), FEET + 1], [S(-hem - 5), FEET - 2]]), RB, { sx: 5, sy: 0, edge: true });
      p.R = RB;
      p.line(S(-hem - 2), FEET - 3, S(-3), lt + 3, RB.d1);
      p.line(S(-hem - 3), FEET - 3, S(-4), lt + 3, RB.l1);
      p.line(S(hem + 1), FEET - 3, S(3), lt + 3, RB.d2);
      p.R = TR;
      p.r(cx - hem - 3, FEET - 1, 2 * hem + 7, 2, TR.b);
      p.r(cx - hem - 3, FEET - 1, 4, 1, TR.l1);
      p.r(cx - hem - 3, FEET, 2 * hem + 7, 1, TR.d1);
      p.r(cx + hem, FEET - 1, 4, 2, TR.d1);
      p.R = BT;
      p.r(cx - 4, FEET - 2, 3, 2, BT.b); p.px(cx - 4, FEET - 2, BT.l1);
      p.r(cx + 2, FEET - 2, 3, 2, BT.d1);
    } else {
      for (const s of fem ? [-5, 0, 5] : [-4, 4]) {
        const y0 = Math.max(waist + 5, hemY - 8);
        p.line(S(s), y0, S(s * 1.2), hemY - 2, RB.d1);
        if (s <= 0) p.line(S(s) - 1, y0 + 1, S(s * 1.2) - 1, hemY - 2, RB.l1);
      }
      if (look.patched) for (let x = -half(hemY); x < half(hemY); x += 3) p.px(S(x), hemY + 1, RB.b);
      const hx = Math.round(S(-half(hemY))), hw = Math.round(2 * half(hemY));
      p.R = TR;
      p.r(hx, hemY - 1, hw, 2, TR.b);
      p.r(hx, hemY - 1, 3, 1, TR.l1);
      p.r(hx + hw - 4, hemY - 1, 4, 1, TR.d1);
      p.r(hx, hemY, hw, 1, TR.d1);
      p.r(hx + hw - 3, hemY, 3, 1, TR.d2);
    }
    p.R = SK;
    p.r(cx - (man ? 3 : 2), cy + r - 1, man ? 7 : 5, top - (cy + r - 1) + 1, SK.b);
    p.r(cx - 1, cy + r + 1, 4, 1, SK.d1);
    p.px(cx, cy + r + 1, SK.d2);
    p.px(cx + 1, cy + r + 2, SK.d1);
    p.r(cx + (man ? 2 : 1), cy + r + 1, 2, top - cy - r - 1, SK.d1);
    const deep = kid ? 4 : 6;
    if (look.armor) {
      p.R = ST;
      for (let y = top + 1; y < waist; y++) {
        const hw = Math.round(half(y)) - 1, row = (y - top) % 3;
        p.r(cx - hw, y, 2 * hw + 1, 1, row === 0 ? ST.d2 : row === 1 ? ST.l1 : ST.b);
        p.r(cx + hw - 2, y, 3, 1, row === 0 ? ST.o : ST.d1);
        p.px(cx - hw, y, row === 0 ? ST.d1 : ST.l2);
        if (row === 2) for (let x = -hw + ((y - top) % 6 < 3 ? 1 : 2); x < hw - 2; x += 3) p.px(cx + x, y, ST.d1);
      }
      p.R = TR;
      p.r(cx - 3, top, 7, 2, TR.b);
      p.r(cx - 3, top, 3, 1, TR.l1);
      p.r(cx - 3, top + 1, 7, 1, TR.d1);
    } else {
      for (let i = 0; i < deep; i++) {
        p.R = RB; p.r(cx - deep + 1 + i, top + i, 2 * (deep - i) - 1, 1, RB.l1);
        const nw = (man ? 5 : 3) - 2 * i;
        if (nw > 0) { p.R = SK; p.r(cx - (nw >> 1), top + i, nw, 1, SK.d1); }
      }
      p.R = TR;
      p.line(cx + deep - 1, top, cx - 1, top + deep, TR.b);
      p.line(cx + deep, top, cx, top + deep, TR.d1);
      p.line(cx - deep + 1, top, cx + 1, top + deep, TR.b);
      p.line(cx - deep, top, cx, top + deep, TR.l1);
      p.R = RB;
      p.line(cx + 2, top + deep, cx + deep + 1, top + 1, RB.d1);
    }
    if (look.garb === "leather") {
      p.R = RB;
      p.line(S(-sh + 1), top + 1, S(half(waist) - 1), waist, RB.o);
      p.line(S(-sh + 2), top + 1, S(half(waist)), waist, RB.d2);
      p.line(S(-sh + 3), top + 1, S(half(waist) + 1), waist, RB.d1);
      p.R = G;
      const by = Math.round(top + (waist - top) / 2);
      p.r(Math.round(S(-2)), by - 1, 2, 2, G.b); p.px(Math.round(S(-2)), by - 1, G.l2); p.px(Math.round(S(-1)), by, G.d1);
    }
    if (look.garb === "fur") {
      const FU = ramp(look.fur ?? "#e8e0d0");
      p.R = FU;
      for (let x = -sh; x <= sh; x += 2) {
        const y = top + 1 + (Math.abs(x) > sh - 2 ? 1 : 0), X0 = Math.round(S(x)), lit = x < sh / 2;
        ell(p, X0, y, 2, 2, (x / 2) % 2 ? FU.d1 : lit ? FU.b : FU.d1);
        p.px(X0 - 1, y - 1, lit ? FU.l2 : FU.b);
        p.px(X0 + 1, y + 2, FU.d2);
      }
    }
    if ((look.orn ?? 0) >= 3 && !look.armor && !sit) {
      const ex = cx - Math.round(sh / 2) - 1, ey = top + 6;
      p.R = TR;
      p.px(ex, ey - 2, TR.l1); p.r(ex - 1, ey - 1, 3, 1, TR.b); p.r(ex - 2, ey, 5, 1, TR.b); p.r(ex - 1, ey + 1, 3, 1, TR.d1); p.px(ex, ey + 2, TR.d1);
      p.px(ex - 1, ey - 1, TR.l1);
      p.R = G;
      p.px(ex, ey, G.l1);
      for (let i = 0; i < deep; i++) { p.px(cx + deep - 1 - i, top + i, G.d1); p.px(cx - deep + 1 + i, top + i, G.b); }
      p.px(cx - deep + 1, top, G.l2);
    }
    if ((look.monk || look.kasaya) && !sit) {
      p.R = SA;
      for (let t = 0; t < 4; t++) p.line(S(-sh + 1), top + t, S(half(hemY) - 2), hemY - 8 + t, [SA.l1, SA.b, SA.b, SA.d1][t]);
      p.line(S(-sh + 3), top + 4, S(half(hemY) - 2), hemY - 4, SA.d2);
    }
    {
      const hw = Math.round(half(waist + 1));
      p.R = SA;
      p.r(cx - hw, waist, 2 * hw + 1, 1, SA.l1);
      p.r(cx - hw, waist + 1, 2 * hw + 1, 1, SA.b);
      p.r(cx - hw, waist + 2, 2 * hw + 1, 1, SA.d1);
      p.r(cx + hw - 2, waist, 3, 3, SA.d1); p.px(cx + hw, waist + 2, SA.d2);
      p.R = RB;
      if (!sit) {
        p.r(cx - hw + 1, waist + 3, 2 * hw - 1, 1, RB.d1);
        for (const s of [-1, 1]) { p.line(cx + s * 3, waist + 4, cx + s * 4, waist + 6, RB.d1); p.px(cx + s * 3 - 1, waist + 4, RB.l1); }
        p.r(cx - hw + 2, waist - 1, 3, 1, RB.d1); p.r(cx + 3, waist - 1, Math.max(1, hw - 4), 1, RB.d2);
      }
      if (!kid) {
        p.R = SA;
        p.r(cx - 1, waist - 1, 3, 4, SA.b);
        p.px(cx - 1, waist - 1, SA.l2); p.px(cx, waist - 1, SA.l1);
        p.r(cx + 1, waist, 1, 3, SA.d1);
        p.px(cx, waist + 1, SA.d2);
        p.line(cx - 1, waist + 3, cx - 2, waist + 6, SA.b);
        p.px(cx - 2, waist + 6, SA.d1);
        p.line(cx + 1, waist + 3, cx + 2, waist + 5, SA.d1);
        p.px(cx + 2, waist + 5, SA.d2);
        if (!sit) p.r(cx - 1, waist + 3, 3, 1, RB.d2);
        p.R = SA;
        p.line(cx - 1, waist + 3, cx - 2, waist + 6, SA.b);
        p.line(cx + 1, waist + 3, cx + 2, waist + 5, SA.d1);
      }
      if ((look.orn ?? 0) >= 2 && !kid && !sit) {
        const J = ramp(look.jade ?? "#5ab08a");
        p.R = SA;
        p.r(cx + 4, waist + 2, 1, 3, SA.d2);
        p.R = J;
        p.r(cx + 3, waist + 5, 3, 2, J.b); p.px(cx + 3, waist + 5, J.l2); p.px(cx + 5, waist + 6, J.d1); p.px(cx + 4, waist + 7, J.d1);
        p.R = SA;
        if (fem) for (const sd of [-1, 1]) { p.line(S(sd * (hw - 1)), waist + 2, S(sd * (hw + 1)), Math.min(hemY - 2, waist + 14), sd < 0 ? SA.b : SA.d1); p.line(S(sd * (hw - 1)) + 1, waist + 3, S(sd * (hw + 1)) + 1, Math.min(hemY - 2, waist + 14), SA.d2); }
      }
    }
    if (look.armor && !sit) for (const s of [-1, 1]) {
      const x0 = s < 0 ? cx - Math.round(half(waist + 4)) + 1 : cx + 2, w = Math.round(half(waist + 4)) - 2;
      fill((q) => q.r(x0, waist + 3, w, 6), ST, { sx: s < 0 ? 1 : 2, base: ST.d1, lit: ST.b, dark: ST.d2, darker: ST.o });
      p.R = ST;
      p.r(x0, waist + 3, w, 1, s < 0 ? ST.l1 : ST.b);
      p.r(x0, waist + 6, w, 1, s < 0 ? ST.b : ST.d1);
    }
    if (look.monk) for (let i = -5; i <= 5; i++) { p.R = ramp("#8a5a32"); p.px(cx + i, top + Math.round((25 - i * i) / 5) + 1, i % 2 ? "#5a3a22" : i < 0 ? "#b07a48" : "#8a5a32"); }
    if (look.patched) {
      p.R = RB;
      p.r(cx - 6, waist + 5, 4, 3, RB.l1); p.px(cx - 6, waist + 5, RB.d2); p.px(cx - 3, waist + 7, RB.d2); p.px(cx - 4, waist + 5, RB.d2);
      p.r(cx + 3, top + 4, 3, 3, RB.d2); p.px(cx + 3, top + 4, RB.d1); p.px(cx + 5, top + 6, RB.o);
    }
  }
  const shoulder = (s) => [S(s * (sh - 1)), top + 2];
  const wristY = top + 2 + Math.round(B.torso * 0.68);
  const caned = look.cane && !sit && !punch && !sweep && pose !== "hop" && pose !== "flyer";
  const WD = ramp(C.wood);
  if (caned) {
    const x = Math.round(S(sh + 4.5));
    p.R = WD;
    p.r(x, wristY - 4, 2, FEET - wristY + 5, WD.b);
    p.r(x + 1, wristY - 4, 1, FEET - wristY + 5, WD.d1);
    p.r(x - 2, wristY - 5, 4, 2, WD.b);
    p.r(x - 2, wristY - 5, 3, 1, WD.l1);
    p.px(x + 1, wristY - 4, WD.d2);
  }
  let hand2 = null;
  if (sweep) {
    const b = pose === "sweepA" ? 0 : 5, a = [S(sh + 6), top - 6], z = [S(-4 + b), FEET - 4], W = ramp(C.straw);
    const at = (t) => [a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t];
    p.R = WD;
    p.line(a[0], a[1], z[0], z[1], WD.l1);
    p.line(a[0] + 1, a[1], z[0] + 1, z[1], WD.d1);
    fill((q) => poly(q, [[z[0] - 2, FEET - 5], [z[0] + 3, FEET - 5], [z[0] + 6, FEET + 1], [z[0] - 5, FEET + 1]]), W, { sx: 2 });
    p.R = W;
    for (const dx of [-2, 1, 4]) p.line(z[0] + dx * 0.5, FEET - 4, z[0] + dx, FEET, W.d1);
    p.r(z[0] - 2, FEET - 4, 5, 1, ramp("#8a5a3a").b);
    hand2 = [at(0.22), at(0.55)];
  }
  const bare = look.under, sl = bare ? [2, 2] : B.sl;
  const bareL = { ...SK, d2: SK.d1 }, bareR = { ...away(SK), d2: SK.d2 };
  const armL = (to, fist) => sleeve(p, shoulder(-1), to, sl, bare ? bareL : RB, bare ? bareL : TR, SK, fist);
  const armR = (to, fist) => sleeve(p, shoulder(1), to, sl, bare ? bareR : away(RB), bare ? bareR : TR, SK, fist);
  const hang = (s, up = 0) => [S(s * (sh + 2)), wristY - up];
  const arms = () => {
    if (pose === "hop") { armL([S(-sh - 5), cy - 2]); armR([S(sh + 5), cy - 2]); }
    else if (pose === "punchA") { armL([S(-sh - 1), waist - 1], 4); armR([S(sh + 11), top + 3], 4); }
    else if (pose === "punchB") { armL([S(-3), top + 6], 4); armR([S(3), top + 5], 4); }
    else if (sit) { armL([S(-3), waist + 2]); armR([S(3), waist + 2]); }
    else if (sweep) { armL(hand2[1]); armR(hand2[0]); }
    else if (pose === "flyer") { armL([S(-sh - 6), wristY - 4]); armR([S(sh + 6), wristY - 4]); }
    else {
      armL(hang(-1, walk > 0 ? 2 : 0));
      armR(caned ? [S(sh + 4.5), wristY - 3] : hang(1, walk < 0 ? 2 : 0));
    }
  };
  if (pose !== "hop") arms();
  if (look.armor) for (const s of [-1, 1]) {
    const x = Math.round(S(s * (sh - 1))) - (s < 0 ? 1 : 0), PD = look.orn >= 4 ? G : ST;
    p.R = ST;
    p.r(x - 4, top + 4, 9, 1, ST.d2);
    fill((q) => ell(q, x, top + 2, look.orn >= 4 ? 5 : 4, 3), PD, { sx: 2, hi: 2 });
    p.R = PD;
    p.px(x - 1, top, PD.l2);
  }
  else if ((look.orn ?? 0) >= 4 && !kid) for (const s of [-1, 1]) {
    const x = Math.round(S(s * (sh - 2))) - (s < 0 ? 1 : 0);
    fill((q) => ell(q, x, top + 1, 4, 2), s < 0 ? TR : away(TR), { sx: 2, hi: 2 });
    p.R = RB;
    p.r(x - 3, top + 3, 7, 1, RB.d2);
  }
  for (const s of [-1, 1]) {
    const ex0 = s < 0 ? cx - r - 1 : cx + r;
    fill((q) => q.r(ex0, cy + 2, 2, 4), s < 0 ? SK : away(SK), { sx: 1, deep: false });
    p.R = SK;
    p.px(s < 0 ? cx - r : cx + r, cy + 3, SK.d2);
  }
  const face = maskOf((q) => {
    if (man) {
      ell(q, cx, cy, r, r, null, cy);
      poly(q, [[S(-r), cy], [S(r), cy], [S(r - 0.5), cy + r - 4], [S(r - 2.5), cy + r - 1.5], [S(2.5), cy + r + 0.5], [S(-2.5), cy + r + 0.5], [S(-r + 2.5), cy + r - 1.5], [S(-r + 0.5), cy + r - 4]]);
    } else ell(q, cx, cy, r, r);
  });
  shapeFill(p, face, SK, { sx: 2, sy: 0, deep: false });
  p.R = SK;
  for (let y = cy + 2; y <= cy + r + 1; y++) for (let x = cx + 1; x < FIG_W; x++) if (inM(face, x, y) && !inM(face, x, y + 1) && y > cy + r - 5) p.px(x, y, SK.d1);
  const ex = r >= 10 ? 4 : 3, eyeY = cy + 2, mouthY = cy + (r >= 10 ? 8 : 7);
  const iris = IRIS[look.eyeColor] ?? look.eyeColor ?? (look.hairColor === "#8a2626" ? IRIS.red : IRIS.brown), irisDk = shade(iris, -0.35);
  const shape = pose === "sleep" ? "closed" : baby ? "round" : old && look.eyes === "sparkly" ? "round" : EYE_MAPS[look.eyes] ? look.eyes : "round";
  let map = EYE_MAPS[shape];
  const shine = map.findIndex((row) => row.includes("w"));
  if (man && shine > 0 && shine < map.length - 2) map = map.filter((_, y) => y !== shine + 1);
  const ew = Math.max(...map.map((row) => row.length));
  const ink = { K: EYE, i: iris, d: irisDk, w: "#ffffff" };
  for (const s of [-1, 1]) {
    const at = (c) => (s < 0 ? cx - ex - (ew - 1) + c : cx + ex + (ew - 1) - c), x0 = s < 0 ? cx - ex - 2 : cx + ex;
    const brow = fem ? HR.l1 : HR.d1;
    p.R = HR;
    if (!kid && !man) {
      if (shape === "fierce") { p.px(at(0), eyeY - 3, brow); p.r(Math.min(at(1), at(2)), eyeY - 2, 2, 1, brow); }
      else if (shape === "gentle") { p.r(Math.min(at(0), at(1)), eyeY - 2, 2, 1, brow); p.px(at(2), eyeY - 3, brow); }
      else p.r(x0, eyeY - 2, 3, 1, brow);
    }
    p.R = { o: EYE };
    map.forEach((row, y) => [...row].forEach((ch, c) => ink[ch] && p.px(at(c), eyeY - 1 + y, ink[ch])));
    const open = shape !== "closed" && shape !== "crescent";
    if (open && map.length >= 4 && !baby) { const yb = eyeY - 1 + map.length - 2; const cI = [...map[map.length - 2]].findIndex((ch) => ch === "i"); if (cI >= 0) p.px(at(Math.max(cI, ew - 2)), yb, shade(iris, 0.35)); }
    if (open && look.charm >= 80) p.px(at(ew - 1), eyeY + 2, shade(iris, 0.5));
    if (open && fem && !kid) p.px(at(-1), eyeY + (shape === "sleepy" ? 1 : 0), EYE);
    p.R = SK;
    if (old) p.px(at(-1), eyeY + 3, SK.d1);
    if (fem || kid) { p.r(s < 0 ? cx - ex - 3 : cx + ex + 2, mouthY - 1, 2, 1, BLUSH); }
    if (old || look.stage === "middle") p.px(cx + s * 3, mouthY, SK.d1);
  }
  if (!baby) { p.R = SK; p.px(cx + 1, mouthY - 2, SK.d1); if (!kid) p.px(cx + 1, mouthY - 3, SK.b); }
  p.R = SK;
  if (pose === "talk") { p.r(cx - 1, mouthY - 1, 3, 2, "#6a2a2a"); p.px(cx, mouthY, "#d06060"); }
  else {
    const mc = fem ? "#c0505a" : kid ? "#b5605a" : SK.d2, w = fem || kid ? 2 : 3;
    switch (look.mouth) {
      case "smile": p.r(cx - 1, mouthY, w, 1, mc); p.px(cx - 2, mouthY - 1, mc); p.px(cx + w - 1, mouthY - 1, mc); break;
      case "small": p.r(cx, mouthY, 1, 1, mc); break;
      case "wide": p.r(cx - 2, mouthY, w + 2, 1, mc); break;
      case "frown": p.r(cx - 1, mouthY, w, 1, mc); p.px(cx - 2, mouthY + 1, mc); p.px(cx + w - 1, mouthY + 1, mc); break;
      case "pout": p.r(cx - 1, mouthY, w, 1, mc); p.r(cx, mouthY + 1, Math.max(1, w - 1), 1, mc); break;
      default: p.r(cx - 1, mouthY, w, 1, mc);
    }
    if (fem && !look.mouth) p.px(cx - 1, mouthY + 1, SK.d1);
  }
  if (look.charm <= 15) p.line(cx + ex + 1, cy - 1, cx + ex + 3, cy + 5, "#b8706a");
  hairFront(p, look, cx, cy, r, top, hatted);
  if (!baby && look.hair.cap !== "bald") {
    const marks = [];
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (p.at(x, y) !== SK) continue;
      if (p.at(x, y - 1) === HR || (x > cx + 2 && p.at(x - 1, y) === HR)) marks.push([x, y]);
    }
    p.R = SK;
    for (const [x, y] of marks) p.px(x, y, SK.d1);
  }
  hat(p, look, cx, cy, r);
  if ((look.orn ?? 0) >= 5 && !hatted && !kid) {
    const top0 = cy - r - 2;
    p.R = G;
    if (fem) for (const sd of [-1, 1]) { p.line(cx + sd * 4, top0 + 2, cx + sd * 8, top0 - 1, sd < 0 ? G.b : G.d1); p.px(cx + sd * 8, top0 - 1, G.l2); p.px(cx + sd * 7, top0 + 1, "#e85a6a"); }
    else {
      p.r(cx - 2, top0 - 3, 5, 3, G.b); p.r(cx - 2, top0 - 3, 2, 1, G.l1); p.r(cx + 2, top0 - 3, 1, 3, G.d1);
      p.px(cx - 2, top0 - 4, G.l1); p.px(cx + 2, top0 - 4, G.b); p.px(cx, top0 - 4, "#e85a6a");
      p.line(cx - 4, top0 - 2, cx + 4, top0 - 2, G.d2); p.px(cx - 4, top0 - 2, G.b);
    }
  }
  p.R = { o: "#2a1418" };
  markFront(p, look, cx, cy, r);
  if (man) for (const s of [-1, 1]) {
    const brow = shade(look.hairColor, ["#e4e4e0", "#c6ced8", "#8f8f8f"].includes(look.hairColor) ? -0.3 : -0.15), x = s < 0 ? cx - ex - 3 : cx + ex;
    const outer = s < 0 ? x : x + 2, inner = s < 0 ? x + 2 : x;
    p.R = HR;
    if (shape === "fierce") { p.r(outer, eyeY - 5, 2, 1, brow); p.r(x, eyeY - 4, 4, 1, brow); p.r(inner, eyeY - 3, 2, 1, brow); }
    else if (shape === "gentle") { p.r(inner, eyeY - 5, 2, 1, brow); p.r(x, eyeY - 4, 4, 1, brow); p.r(outer, eyeY - 3, 2, 1, brow); }
    else { p.r(x, eyeY - 4, 4, 2, brow); p.r(x, eyeY - 3, 4, 1, shade(brow, -0.25)); }
  }
  if (look.beard) {
    p.R = HR;
    p.r(cx - 3, mouthY - 2, 3, 1, HR.b); p.r(cx + 1, mouthY - 2, 3, 1, HR.d1);
    p.px(cx - 3, mouthY - 2, HR.l1);
    p.px(cx - 4, mouthY - 1, HR.b); p.px(cx + 4, mouthY - 1, HR.d1);
    p.px(cx - 4, mouthY, HR.d1); p.px(cx + 4, mouthY, HR.d2);
    if (old) {
      fill((q) => poly(q, [[S(-3.5), mouthY + 2], [S(3.5), mouthY + 2], [S(3), top + 6], [S(0), top + 11], [S(-3), top + 6]]), HR, { sx: 2 });
      p.R = HR;
      p.line(cx - 1, mouthY + 3, cx - 1, top + 7, HR.l1);
      p.line(cx + 1, mouthY + 4, cx, top + 9, HR.d1);
    } else {
      fill((q) => poly(q, [[S(-2), mouthY + 2], [S(2), mouthY + 2], [S(1), cy + r + 2], [S(-1), cy + r + 2]]), HR, { sx: 1 });
    }
  }
  if (pose === "hop") arms();
  if ((pose === "flyer" || pose === "swordsit") && !noSword) {
    const y = FEET - 1;
    p.R = ramp("#9aa8b2");
    p.r(S(-14), y, 31, 1, "#eef3f6");
    p.r(S(-14), y, 8, 1, "#ffffff");
    p.r(S(-14), y + 1, 31, 1, "#9aa8b2");
    p.px(S(17), y + 1, "#9aa8b2");
    p.R = G;
    p.r(S(-16), y - 2, 2, 4, G.b); p.px(S(-16), y - 2, G.l2); p.r(S(-15), y - 1, 1, 3, G.d1);
    p.R = ramp("#4a3a2a");
    p.r(S(-21), y, 5, 2, "#4a3a2a"); p.r(S(-21), y, 5, 1, "#6a5440");
    p.R = G;
    p.px(S(-22), y, G.b);
    p.R = ramp(C.red);
    p.line(S(-23), y + 1, S(-26), y + 2, C.red);
  }
  return selOut(cv, p);
}

// ------------------------------------------------------------------ portraits

// A face for the People tab and cards: the head and shoulders of the same
// chibi figure the scene shows, cropped to a square.
const PORTRAIT = 40;
function portrait(raw) {
  const fig = person(norm(raw), "stand");
  const data = fig.getContext("2d").getImageData(0, 0, FIG_W, FIG_H).data;
  let top = 0;
  find: for (let y = 0; y < FIG_H; y++) for (let x = 0; x < FIG_W; x++) if (data[(y * FIG_W + x) * 4 + 3]) { top = y; break find; }
  const y0 = Math.max(0, Math.min(FIG_H - PORTRAIT, top - 2));
  const cv = canvas(PORTRAIT, PORTRAIT);
  cv.getContext("2d").drawImage(fig, FIG_CX - PORTRAIT / 2, y0, PORTRAIT, PORTRAIT, 0, 0, PORTRAIT, PORTRAIT);
  return cv;
}

// Lying on the ground, head to the left: the standing figure turned over,
// in a square frame as wide as the figure is tall.
function lying(look) {
  const cv = canvas(FIG_H, FIG_H);
  const ctx = cv.getContext("2d");
  ctx.translate(0, FIG_H + 13);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(person({ ...look, cane: false }, "sleep"), 0, 0);
  return cv;
}

// One frame of a person as a canvas (FIG_W x FIG_H fine pixels, feet on row
// FEET), for pictures that scale it down themselves (clan-estate.js).
function personCanvas(look, pose = "stand") {
  return pose === "lying" ? lying(look) : person(look, pose);
}

// The hero's look: from src/looks.js, or (older callers) from a few flags.
function heroLook(look) {
  if (look.hair?.cap) return look;
  const { female, child, baby, cultivator } = look;
  if (baby) return { female, baby, robe: "#e6d6b2", sash: "#c8a878", trim: "#f4ecd8" };
  if (cultivator) return { female, child, robe: "#eef2f0", trim: "#3f8f78", sash: "#3f8f78" };
  if (child) return { female, child, robe: female ? "#c8584a" : "#c0783a", sash: "#6a3a22" };
  return { female, child, robe: female ? "#a8607a" : "#4f7aa6", sash: "#8a4b2f" };
}

const HAIR_SPECS_M = [
  { back: "none", cap: "full", fringe: "none", top: "knot", tail: "none", locks: false, band: false, orn: null },
  { back: "none", cap: "full", fringe: "none", top: "crown", tail: "none", locks: false, band: false, orn: "gold" },
  { back: "none", cap: "full", fringe: "none", top: "none", tail: "pony", locks: false, band: false, orn: null },
  { back: "long", cap: "full", fringe: "none", top: "none", tail: "none", locks: true, band: false, orn: null },
  { back: "long", cap: "full", fringe: "none", top: "knot", tail: "none", locks: false, band: false, orn: null },
  { back: "none", cap: "full", fringe: "straight", top: "none", tail: "none", locks: false, band: false, orn: null },
  { back: "none", cap: "bald", fringe: "none", top: "none", tail: "none", locks: false, band: false, orn: null },
  { back: "none", cap: "full", fringe: "spiky", top: "spiky", tail: "none", locks: false, band: false, orn: null },
  { back: "none", cap: "full", fringe: "none", top: "none", tail: "lowPony", locks: false, band: false, orn: null },
  { back: "long", cap: "full", fringe: "none", top: "none", tail: "none", locks: false, band: true, orn: null },
  { back: "none", cap: "full", fringe: "none", top: "none", tail: "braid", locks: false, band: false, orn: null },
  { back: "none", cap: "full", fringe: "side", top: "none", tail: "none", locks: false, band: false, orn: null },
  { back: "none", cap: "full", fringe: "none", top: "bun", tail: "none", locks: false, band: false, orn: "jade" },
  { back: "shoulder", cap: "full", fringe: "parted", top: "none", tail: "none", locks: false, band: false, orn: null },
  { back: "long", cap: "full", fringe: "spiky", top: "spiky", tail: "none", locks: true, band: false, orn: null },
  { back: "none", cap: "full", fringe: "none", top: "knot", tail: "none", locks: true, band: false, orn: null },
  { back: "none", cap: "full", fringe: "straight", top: "knot", tail: "none", locks: false, band: false, orn: null },
  { back: "nape", cap: "thin", fringe: "none", top: "none", tail: "lowPony", locks: false, band: false, orn: null },
  { back: "none", cap: "full", fringe: "none", top: "bun", tail: "none", locks: false, band: true, orn: null },
  { back: "long", cap: "full", fringe: "none", top: "none", tail: "lowPony", locks: false, band: false, orn: "ribbon" },
];
const HAIR_SPECS_F = [
  { back: "none", cap: "full", fringe: "straight", top: "doubleBun", tail: "none", locks: false, band: false, orn: "ribbon" },
  { back: "none", cap: "full", fringe: "side", top: "none", tail: "pony", locks: false, band: false, orn: "ribbon" },
  { back: "long", cap: "full", fringe: "straight", top: "none", tail: "none", locks: false, band: false, orn: null },
  { back: "long", cap: "full", fringe: "parted", top: "bun", tail: "none", locks: false, band: false, orn: "flower" },
  { back: "none", cap: "full", fringe: "side", top: "none", tail: "braid", locks: false, band: false, orn: null },
  { back: "none", cap: "full", fringe: "straight", top: "none", tail: "twin", locks: false, band: false, orn: null },
  { back: "none", cap: "full", fringe: "parted", top: "tallBun", tail: "none", locks: false, band: false, orn: "gold" },
  { back: "nape", cap: "full", fringe: "side", top: "none", tail: "lowPony", locks: false, band: false, orn: "jade" },
  { back: "long", cap: "full", fringe: "parted", top: "crown", tail: "none", locks: true, band: false, orn: "gold" },
  { back: "nape", cap: "full", fringe: "straight", top: "none", tail: "none", locks: false, band: false, orn: null },
  { back: "long", cap: "full", fringe: "parted", top: "none", tail: "braid", locks: false, band: false, orn: "ribbon" },
  { back: "shoulder", cap: "full", fringe: "side", top: "none", tail: "none", locks: true, band: false, orn: null },
  { back: "none", cap: "full", fringe: "side", top: "none", tail: "side", locks: false, band: false, orn: "flower" },
  { back: "long", cap: "full", fringe: "none", top: "bun", tail: "none", locks: false, band: false, orn: "jade" },
  { back: "none", cap: "full", fringe: "straight", top: "loops", tail: "none", locks: false, band: false, orn: "ribbon" },
  { back: "long", cap: "full", fringe: "none", top: "none", tail: "none", locks: false, band: true, orn: null },
  { back: "none", cap: "full", fringe: "side", top: "none", tail: "none", locks: false, band: false, orn: null },
  { back: "shoulder", cap: "full", fringe: "straight", top: "none", tail: "lowPony", locks: true, band: false, orn: "ribbon" },
  { back: "none", cap: "full", fringe: "parted", top: "bun", tail: "none", locks: false, band: true, orn: "flower" },
  { back: "veryLong", cap: "full", fringe: "parted", top: "none", tail: "none", locks: true, band: false, orn: null },
];

// ---- portrait cache (v2) ----
// renderPanel() เรียก portrait() ใหม่ทุก input — cache เพื่อกันการวาดซ้ำ
// ของ NPC ที่ไม่เปลี่ยน (NPC 100 ตัว + แก้ช่องเดียว = 100 hit ไม่ใช่ 100 miss)
const _portraitCache = new Map();
const _PORTRAIT_CACHE_MAX = 400;

function portraitCached(raw) {
  let key;
  try { key = JSON.stringify(raw); } catch { return portrait(raw); }
  let cached = _portraitCache.get(key);
  if (!cached) {
    cached = portrait(raw);
    if (_portraitCache.size >= _PORTRAIT_CACHE_MAX) {
      _portraitCache.delete(_portraitCache.keys().next().value);
    }
    _portraitCache.set(key, cached);
  }
  // คืน clone — ผู้เรียกอาจ append เข้า DOM หลายที่
  const out = canvas(PORTRAIT, PORTRAIT);
  out.getContext("2d").drawImage(cached, 0, 0);
  return out;
}

window.WoxPreview = {
  personCanvas, portrait: portraitCached, heroLook,
  FIG_W, FIG_H, STOCK_HAIR, HAIR_SPECS_M, HAIR_SPECS_F,
  clearPortraitCache: () => _portraitCache.clear(),
  get portraitCacheSize() { return _portraitCache.size; },
};
})();