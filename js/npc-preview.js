// npc-preview.js v3 (2026-11-07) — derive NPC look, stats, role text from save data
// Ports the lookOf/stat derivation from src/looks.js, src/world.js, src/growth.js
// and src/martial.js. Reads only from the save (no API calls).
// v2: hair, colour, outfit and stat tables come from the catalog (regenerate
// with export-catalog-v3.js) so NPCs stay in sync with the game's looks.js.
// v3: MORTAL_BASE moved to catalog-extra.js (CAT.npcStats.mortalBase) — the
//     fallback here is a single role so a missing catalog-extra.js stays readable.
// Only the child/baby hair lists are hardcoded (too small to warrant a catalog key).
(function () {
  "use strict";

  const CAT = window.WOX_CATALOG ?? {};
  const LK = CAT.looks ?? {};

  // ============================================================
  // From catalog (with fallbacks for a stale catalog.js)
  // ============================================================
  const FALLBACK_HAIR_M = [{ th: "Topknot", en: "Topknot", back: "none", cap: "full", fringe: "none", top: "knot", tail: "none", locks: false, band: false, orn: null }];
  const HAIR_M = LK.hairM?.length ? LK.hairM : FALLBACK_HAIR_M;
  const HAIR_F = LK.hairF?.length ? LK.hairF : HAIR_M;
  const HAIR_COLORS = LK.hairColors ?? { black: "#2b2222", dark: "#3b2a22", brown: "#5a3e2c", chestnut: "#6e3b22", grey: "#8f8f8f", white: "#e4e4e0", silver: "#c6ced8", red: "#8a2626" };
  const SKINS = LK.skins ?? ["#f6d8b8", "#f0c8a0", "#e2b48a", "#c99a72"];
  const EYE_SHAPES = LK.eyeShapes ?? ["round", "phoenix", "gentle", "sharp", "sleepy", "sparkly", "fierce", "crescent"];
  const EYE_COLORS = LK.eyeColors ?? ["brown", "dark", "amber", "grey", "blue", "red", "gold", "violet"];
  const ROLE_OUTFITS = CAT.roleOutfits ?? {};
  const SECT_OUTFITS = CAT.sectOutfits ?? {};
  const CLASS_OUTFITS = CAT.classOutfits ?? {};
  const NPC_ORN = CAT.npcOrn ?? {};
  const DEMON_SKINS = CAT.demonSkins ?? {};

  const O = (robe, trim, sash, hat = "none", more = {}) => ({ robe, trim, sash, hat, ...more });
  const H = (en, f) => ({ th: en, en, back: "none", cap: "full", fringe: "none", top: "none", tail: "none", locks: false, band: false, orn: null, ...f });

  // Children / baby (too small to warrant a catalog key).
  const KID_M = [H("A tuft", { cap: "thin", top: "knot" }), H("Cropped", { cap: "thin" }), H("Short with bangs", { fringe: "straight" })];
  const KID_F = [H("Twin buns", { top: "doubleBun", fringe: "straight" }), H("Pigtails", { tail: "twin", fringe: "straight" }), H("Bob with bangs", { back: "nape", fringe: "straight" })];
  const BALD = { th: "Shaven head", en: "Shaven head", back: "none", cap: "bald", fringe: "none", top: "none", tail: "none", locks: false, band: false, orn: null };

  const SECT_ORDER = ["servant", "outer", "inner", "direct", "heir", "elder", "master"];
  const SECT_ORN = [0, 1, 2, 3, 4, 4, 5];
  const BABY = O("#e6d6b2", "#f4ecd8", "#c8a878");
  const KID = [O("#c8584a", "#f0e8d8", "#6a3a22"), O("#c0783a", "#f0e8d8", "#6a3a22"), O("#5a8ab0", "#f0e8d8", "#3a4a6a"), O("#7aa05a", "#f0e8d8", "#5a3a22")];

  // ============================================================
  // Growth / stats tables (from catalog with fallbacks)
  // ============================================================
  const CUM_YEARS = CAT.cumYears ?? [0, 0, 20, 80, 250, 700, 1800, 4500, 11000];
  const NPC_YEARS = CAT.npcYears ?? [0, 4, 10, 18, 30, 50, 80];
  const REALMS_LIFESPAN = (() => {
    const arr = (CAT.realms ?? []).map((r) => r.lifespan).filter((n) => typeof n === "number");
    return arr.length ? arr : [80, 120, 200, 400, 800, 1500, 3000, 6000, 10000];
  })();
  const STAT_NORM_X = CAT.statNorm?.x ?? {
    1: { body: 90, mind: 100, will: 95, charm: 85, luck: 75 },
    2: { body: 135, mind: 145, will: 145, charm: 110, luck: 105 },
    3: { body: 220, mind: 195, will: 195, charm: 145, luck: 145 },
    4: { body: 345, mind: 260, will: 300, charm: 225, luck: 235 },
    5: { body: 445, mind: 335, will: 380, charm: 290, luck: 260 },
    6: { body: 550, mind: 435, will: 490, charm: 390, luck: 315 },
    7: { body: 625, mind: 530, will: 580, charm: 430, luck: 335 },
    8: { body: 705, mind: 630, will: 680, charm: 470, luck: 355 },
  };
  const STAT_NORM_M = CAT.statNorm?.m ?? {
    1: { body: 75, mind: 85, will: 65, charm: 80, luck: 70 },
    2: { body: 95, mind: 95, will: 80, charm: 90, luck: 75 },
    3: { body: 115, mind: 115, will: 105, charm: 100, luck: 80 },
    4: { body: 140, mind: 130, will: 120, charm: 115, luck: 90 },
    5: { body: 175, mind: 160, will: 150, charm: 150, luck: 125 },
    6: { body: 240, mind: 205, will: 215, charm: 195, luck: 170 },
  };

  // Mortal baseline per role — มาจาก catalog-extra.js (ถ้าไม่มีไฟล์ ให้ใช้ค่า fallback เดียว)
  const MORTAL_BASE = CAT.npcStats?.mortalBase ?? {
    farmer: { body: 50, mind: 50, will: 50, charm: 50, luck: 50 },
  };

  // ============================================================
  // Helpers
  // ============================================================
  function hash(n, salt) {
    let h = (n * 2654435761 + salt * 40503) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519) >>> 0;
    h ^= h >>> 13;
    return h >>> 0;
  }
  const pickBy = (n, salt, list) => list[hash(n, salt) % list.length];

  const ageAt = (p, t) => (t - p.b) / 12;

  function stageOfAge(age) {
    if (age < 3) return "baby";
    if (age < 10) return "child";
    if (age < 16) return "teen";
    if (age < 40) return "adult";
    if (age < 60) return "middle";
    return "old";
  }

  function realmAt(p, age) {
    if (!p.pk || age < (p.st ?? 12)) return 0;
    let r = 1;
    const t = p.t ?? 1;
    while (r < p.pk && age >= (p.st ?? 12) + CUM_YEARS[r + 1] / t) r++;
    return r;
  }

  function martialRankAt(p, age) {
    if (!p.mr || age < (p.st ?? 8)) return 0;
    if (p.mrFix) return p.mr;
    let r = 0;
    const t = p.t ?? 1;
    while (r < p.mr && age >= (p.st ?? 8) + NPC_YEARS[r + 1] / t) r++;
    return r;
  }

  function faceAgeOf(p, t) {
    const age = Math.max(0, ageAt(p, t));
    const realm = realmAt(p, age);
    const a = Math.max(Math.min(age, 20), age - (p.lookYouth ?? 0));
    if (!realm || a <= 20) return a;
    return 20 + (a - 20) * (REALMS_LIFESPAN[0] / REALMS_LIFESPAN[realm]);
  }

  function charmOf(p, t) {
    const age = ageAt(p, t);
    const realm = realmAt(p, age);
    const base = p.ch ?? Math.round(Math.max(2, Math.min(98, 50 + ((hash(p.id, 7) % 1000) / 1000 - 0.5) * 70 + ((hash(p.id, 8) % 1000) / 1000 - 0.5) * 30)));
    return Math.min(100, base + realm * 4);
  }

  function eyeColorOf(id, tint) {
    if (tint) return tint;
    const n = hash(id, 33) % 100;
    return n < 2 ? "gold" : n < 4 ? "violet" : n < 10 ? "blue" : n < 20 ? "grey" : n < 32 ? "amber" : n < 60 ? "dark" : "brown";
  }

  function hairColorOf(id, age, special) {
    if (special && HAIR_COLORS[special]) return HAIR_COLORS[special];
    if (age >= 72) return HAIR_COLORS.white;
    if (age >= 55) return HAIR_COLORS.grey;
    return pickBy(id, 3, [HAIR_COLORS.black, HAIR_COLORS.black, HAIR_COLORS.black, HAIR_COLORS.dark, HAIR_COLORS.dark, HAIR_COLORS.brown, HAIR_COLORS.chestnut]);
  }

  function sectRankApprox(world, p, t) {
    if (!p.sect) return "outer";
    if (world?.masters?.[p.sect] === p.id) {
      return world.heroMaster === p.sect ? "elder" : "master";
    }
    if (p.fig !== undefined) return p.fig <= 1 ? "elder" : "inner";
    const realm = realmAt(p, ageAt(p, t));
    if (realm === 0) return "servant";
    if (realm >= 3) return "elder";
    if (realm === 2) return (p.t ?? 1) > 1.6 ? "direct" : "inner";
    return "outer";
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
    return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, "0")).join("")}`;
  }

  function sectUniform(sect, rank) {
    const base = SECT_OUTFITS[sect] ?? { robe: "#e8ece8", trim: "#4f8a6a", sash: "#4f8a6a" };
    const i = Math.max(0, SECT_ORDER.indexOf(rank ?? "outer"));
    return {
      ...base,
      trim: i === 0 ? shade(base.robe, -0.18) : base.trim,
      orn: SECT_ORN[i],
      cape: i >= 5 ? base.trim : undefined,
    };
  }

  function build(id, female, age, outfit, extra = {}) {
    const stage = stageOfAge(age);
    const kid = stage === "baby" || stage === "child";
    const styles = kid ? (female ? KID_F : KID_M) : female ? HAIR_F : HAIR_M;
    const hair = styles[(extra.hairIndex ?? id) % styles.length];
    const look = {
      female, stage, hair,
      hairColor: hairColorOf(id, age, extra.hairTint),
      skin: pickBy(id, 5, SKINS),
      ...(stage === "baby" ? BABY : kid && !extra.ownClothes ? pickBy(id, 9, KID) : outfit),
      beard: !female && (stage === "middle" || stage === "old") && hash(id, 11) % 3 !== 0,
      cane: stage === "old" && age >= 75 && hash(id, 12) % 2 === 0,
      charm: extra.charm ?? 50,
      eyes: stage === "baby" ? "round" : pickBy(id, 31, EYE_SHAPES),
      eyeColor: eyeColorOf(id, extra.hairTint === "red" ? "red" : undefined),
    };
    if (kid) look.hat = "none";
    if (look.monk && !female) look.hair = BALD;
    return look;
  }

  function demonLook(look, id, dm) {
    if (!dm) return look;
    if (DEMON_SKINS[dm]) look.skin = pickBy(id, 41, DEMON_SKINS[dm]);
    look.eyeColor = pickBy(id, 42, ["red", "red", "gold", "violet"]);
    return look;
  }

  // ============================================================
  // Main API: lookOf
  // ============================================================
  function lookOf(p, t, world) {
    if (!p) return null;
    if (p.look) return p.look;
    const age = ageAt(p, t);
    const seen = faceAgeOf(p, t);
    let outfit;
    const ofSect = p.role === "sect" || (p.role === "family" && !!p.sect && !p.crown);
    if (ofSect && SECT_OUTFITS[p.sect]) {
      let rank = "outer";
      try { rank = sectRankApprox(world, p, t); } catch { /* fallback outer */ }
      outfit = sectUniform(p.sect, rank);
    } else if (p.role === "sect") {
      outfit = ROLE_OUTFITS.rogue?.[0] ?? { robe: "#c8ccc8", trim: "#5a6a6a", sash: "#5a6a6a", hat: "none" };
    } else if (p.role === "family") {
      outfit = p.crown
        ? { ...(ROLE_OUTFITS.emperor?.[0] ?? { robe: "#e0b828", trim: "#a82020", sash: "#a82020", hat: "crown" }), ...(NPC_ORN.emperor ?? {}) }
        : CLASS_OUTFITS[world?.cls] ?? CLASS_OUTFITS.middle ?? { robe: "#4f7aa6", trim: "#e8e0d0", sash: "#8a4b2f", hat: "none" };
    } else {
      const list = ROLE_OUTFITS[p.role] ?? ROLE_OUTFITS.farmer ?? [{ robe: "#7a6a4a", trim: "#d8c8a0", sash: "#5a3a22", hat: "straw" }];
      const base = pickBy(p.id, 13, list);
      outfit = { ...base, ...(NPC_ORN[p.role] ?? {}) };
    }
    const tint = p.al === "demonic" && hash(p.id, 21) % 3 === 0
      ? "red"
      : p.sect === "frost-palace" && hash(p.id, 22) % 2
        ? "silver"
        : undefined;
    const out = build(p.id, p.g === "f", seen, outfit, { hairTint: tint, charm: charmOf(p, t) });
    if (p.mk) out.mark = p.mk;
    return demonLook(out, p.id, p.dm);
  }

  // ============================================================
  // Stats derivation
  // ============================================================
  function deriveStats(p, t) {
    const age = ageAt(p, t);
    const realm = realmAt(p, age);
    const rank = martialRankAt(p, age);
    let base;
    if (realm > 0 && STAT_NORM_X[Math.min(8, realm)]) {
      base = STAT_NORM_X[Math.min(8, realm)];
    } else if (rank > 0 && STAT_NORM_M[Math.min(6, rank)]) {
      base = STAT_NORM_M[Math.min(6, rank)];
    } else {
      base = MORTAL_BASE[p.role] ?? { body: 50, mind: 50, will: 50, charm: 50, luck: 50 };
    }
    const tf = 0.85 + (p.t ?? 1) * 0.15;
    return {
      body:  Math.round(base.body  * tf),
      mind:  Math.round(base.mind  * tf),
      will:  Math.round(base.will  * tf),
      charm: Math.round(base.charm * tf),
      luck:  Math.round(base.luck  * tf),
    };
  }

  // ============================================================
  // Role text
  // ============================================================
  const ROLE_NAMES = {
    farmer:"ชาวนา", hunter:"นายพราน", herbalist:"หมอยา", headman:"ผู้ใหญ่บ้าน",
    craftsman:"ช่างฝีมือ", merchant:"พ่อค้า", artisan:"ช่างในเมือง", doctor:"หมอ",
    innkeeper:"เจ้าของโรงน้ำชา", scholar:"บัณฑิต", thug:"นักเลง", courtesan:"นางคณิกา",
    guard:"ทหารยามเมือง", noble:"ขุนนาง", official:"ขุนนางราชสำนัก", soldier:"ทหารหลวง",
    general:"แม่ทัพ", eunuch:"ขันที", royal:"เชื้อพระวงศ์", emperor:"จักรพรรดิ",
    bandit:"โจรภูเขา", banditChief:"หัวหน้าโจร", traveler:"นักเดินทาง",
    rogue:"ผู้ฝึกตนอิสระ", hermit:"ฤๅษี", hiddenMaster:"ผู้เฒ่าแปลกหน้า",
    evilMaster:"ปรมาจารย์มาร", evilDisciple:"ผู้ฝึกตนสายมาร",
    sect:"ศิษย์สำนัก", family:"ครอบครัว", beast:"สัตว์อสูร",
    demonSovereign:"จอมมาร", demonPrince:"เจ้าชายมาร", demonMinister:"ขุนนางวังมาร",
    demonGeneral:"แม่ทัพมาร", demonChief:"ประมุขตระกูลมาร", demonWarrior:"นักรบมาร",
    demonMerchant:"พ่อค้ามาร", demonHunter:"พรานมาร", demonShaman:"หมอผีมาร",
    demonFolk:"ชาวมาร", halfDemon:"ลูกครึ่งมาร", humanThrall:"ทาสมนุษย์ในแดนมาร",
  };
  const MARTIAL_RANK_TH = (CAT.martialRanks ?? []).map((r) => r.th).filter(Boolean);
  if (!MARTIAL_RANK_TH.length) MARTIAL_RANK_TH.push("ผู้ฝึกยุทธ์", "จอมยุทธ์ชั้นสาม", "จอมยุทธ์ชั้นสอง", "จอมยุทธ์ชั้นหนึ่ง", "ยอดฝีมือ", "ผู้เหนือมนุษย์", "ปรมาจารย์");
  const REALM_TH = (CAT.realms ?? []).map((r) => r.th).filter(Boolean);
  if (!REALM_TH.length) REALM_TH.push("คนธรรมดา", "หลอมปราณ", "สร้างฐาน", "แก่นทอง", "วิญญาณก่อเกิด", "แปลงวิญญาณ", "ผสานความว่าง", "ข้ามทัณฑ์สวรรค์", "บรรลุเซียน");

  function roleText(p, t) {
    if (!p) return "";
    if (p.kind === "beast") return `สัตว์อสูร #${p.id}`;
    const age = ageAt(p, t);
    const realm = realmAt(p, age);
    const rank = martialRankAt(p, age);
    if (age < 14) return `เด็ก (ลูก${ROLE_NAMES[p.role] ?? p.role})`;
    if (p.fam === "father") return "พ่อ";
    if (p.fam === "mother") return "แม่";
    if (p.fam === "sibling") return p.g === "f" ? "พี่น้องหญิง" : "พี่น้องชาย";
    if (p.fam === "child") return p.g === "f" ? "ลูกสาว" : "ลูกชาย";
    const base = ROLE_NAMES[p.role] ?? p.role;
    if (realm > 0) return `${base} · ${REALM_TH[Math.min(8, realm)]}`;
    if (rank > 0) return `${base} · ${MARTIAL_RANK_TH[Math.min(6, rank)]}`;
    return base;
  }

  // ============================================================
  // Portrait (canvas)
  // ============================================================
  function portrait(p, t, world) {
    if (!p) return null;
    if (p.kind === "beast") return null;
    if (!window.WoxPreview?.portrait) return null;
    const look = lookOf(p, t, world);
    if (!look) return null;
    try { return window.WoxPreview.portrait(look); }
    catch (err) { console.warn("[NpcPreview] portrait failed:", err); return null; }
  }

  // ============================================================
  // Public API
  // ============================================================
  window.NpcPreview = {
    lookOf, deriveStats, roleText, portrait,
    realmAt, martialRankAt, faceAgeOf, stageOfAge, charmOf,
    hash, pickBy, sectRankApprox,
    REALM_TH, MARTIAL_RANK_TH, ROLE_NAMES,
  };
})();