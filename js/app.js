// app.js v13.4 — 2026-11-07
// P0 fixes: hidden traits, flags, sects, mk/nat/dm, recipes, root.rev, sync married
// v13.1: define HIDDEN_SECTS/ALL_SECT_IDS (crash on Origin/Life panels),
//        guard r.elements undefined, auto-fix covers hair + tech slots,
//        reset life panel also restores armyRank.
// v13.2: dirty state ใช้ WoxIO.hash(JSON.stringify(S)) แทน full-string compare
//        — input latency บน save ใหญ่ลดลง ~5-10 เท่า
// v13.3: NPC kit อ่านจาก p.kit (ตามโครงสร้าง src/npc-kit.js) แทน p.bag/p.equip/p.techs
//        renderNpcGear / renderNpcTalents / npcSummaryHtml อ่านฟิลด์จริง (p.t/p.tr/p.pk/p.mr)
//        เพิ่มช่องแก้ไขพรสวรรค์ & ศักยภาพในแท็บ Info (t/tr/pk/mr/role/sect)
// v13.4: cleanup — remove dead helper iName, alias `checks = checksFixable`
//        (was identity map), rename local `isDirty` in pRel → `hasChanges`
//        (avoid shadowing module-level isDirty()).
(() => {
  const C = window.WOX_CATALOG;
  const IO = window.WoxIO;
  if (!C || !IO) {
    const miss = [!C && "catalog.js", !IO && "wox-io.js"].filter(Boolean).join(", ");
    const box = document.getElementById("panel");
    if (box) box.innerHTML = `<h2>โหลดสคริปต์ไม่ครบ</h2><p>หาไฟล์ <b>${miss}</b> ไม่เจอ</p>`;
    return;
  }
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clone = (o) => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  const SAVE_VER = 3;

  let S = null, ORIG = null, FILE = "", WRAP = "gzip", TAB = "file";
  let PL = { c: "central", r: "city", t: "" };
  let POSE = "stand";
  let SELECTED_REL = null;
  let NPC_TAB = "info";
  let GEAR_TAB = "items";

  let UNDO_STACK = [];
  let UNDO_IDX = -1;
  const UNDO_MAX = 30;
  let SELECTED_MULTI = new Set();
  let BOOKMARKS = new Set();
  let NOTES = new Map();
  let LOOK_OVERRIDES = new Map();
  let COMPARE_S = null, COMPARE_FILE = "";
  const FILTER = { bag: "", bagTier: "", bagSlot: "", tech: "", techKind: "", relQ: "", relTag: "", tlQ: "", tlKind: "" };

  // ===== BUILTIN FALLBACKS =====
  const BUILTIN_SURNAMES = [["หลิน","Lin"],["หวัง","Wang"],["จาง","Zhang"],["หลี่","Li"],["เฉิน","Chen"],["จ้าว","Zhao"],["หลิว","Liu"],["หยาง","Yang"],["ซู","Su"],["เย่","Ye"],["ฉิน","Qin"],["เซียว","Xiao"],["มู่","Mu"],["ไป๋","Bai"],["หาน","Han"],["ถัง","Tang"],["ซ่ง","Song"],["กู้","Gu"],["เสิ่น","Shen"],["ลู่","Lu"],["เจียง","Jiang"],["สวี","Xu"],["โจว","Zhou"],["อู๋","Wu"],["เจิ้ง","Zheng"],["เฝิง","Feng"],["เฉา","Cao"],["เซี่ย","Xie"],["หลัว","Luo"],["เกา","Gao"],["ฟาง","Fang"],["เหยียน","Yan"],["ฮวา","Hua"],["หลง","Long"],["หยุน","Yun"],["หลิง","Ling"],["เมิ่ง","Meng"],["มู่หรง","Murong"],["ซ่างกวน","Shangguan"],["โอวหยาง","Ouyang"],["ตู๋กู","Dugu"],["ซือถู","Situ"],["หนานกง","Nangong"],["ซีเหมิน","Ximen"],["จูเก๋อ","Zhuge"],["จิน","Jin"],["เหลย","Lei"],["สือ","Shi"],["ต้วน","Duan"],["จี้","Ji"],["ข่ง","Kong"],["เว่ย","Wei"],["เผย","Pei"],["เฉียว","Qiao"],["เริ่น","Ren"],["เถียน","Tian"],["ชื่อเยี่ยน","Chiyan"],["โม่หยวน","Moyuan"],["เซวี่ยหลง","Xuelong"],["อินซา","Yinsha"],["กุ่ยฟาง","Guifang"],["เย่ลั่ว","Yeluo"],["ฉือโหยว","Chiyou"],["ซิงเทียน","Xingtian"]];
  const BUILTIN_GIVEN = { male: [["เฟิง","Feng"],["ห่าว","Hao"],["หมิง","Ming"],["เทียน","Tian"],["หลง","Long"],["อวี่","Yu"],["เจี๋ย","Jie"],["ฟาน","Fan"],["เหยียน","Yan"],["ชวน","Chuan"],["อี้","Yi"],["ซง","Song"],["เฉิน","Chen"],["เสวียน","Xuan"],["ข่าย","Kai"],["เวย","Wei"],["เหลย","Lei"],["หยุน","Yun"],["เจิน","Zhen"],["รุ่ย","Rui"],["เจ๋อ","Ze"],["หาน","Han"],["ปั๋ว","Bo"],["เหวิน","Wen"],["จวิน","Jun"],["เชียน","Qian"],["ซาน","Shan"],["เย่","Ye"],["หง","Hong"],["ผิง","Ping"],["คุน","Kun"],["เซิง","Sheng"],["อ้าว","Ao"],["เหิง","Heng"],["เทา","Tao"],["อู่","Wu"]], female: [["เสวี่ย","Xue"],["หลาน","Lan"],["เยว่","Yue"],["ชิง","Qing"],["เหมย","Mei"],["อิง","Ying"],["หรู","Ru"],["ซิน","Xin"],["หว่าน","Wan"],["เหยา","Yao"],["ลี่","Li"],["ฉิง","Qing"],["หนิง","Ning"],["ซวง","Shuang"],["เหลียน","Lian"],["โหรว","Rou"],["เยี่ยน","Yan"],["ฮวา","Hua"],["จือ","Zhi"],["เฟย","Fei"],["หยุน","Yun"],["จิ้ง","Jing"],["เสีย","Xia"],["เตี๋ย","Die"],["หลิง","Ling"],["อี๋","Yi"],["ซู","Su"],["ชิว","Qiu"],["ซี","Xi"],["ลู่","Lu"],["ฉือ","Ci"],["เวย","Wei"],["หรง","Rong"],["ถิง","Ting"],["หลัน","Lan"],["เสวียน","Xuan"]] };
  const BUILTIN_EPITHETS = [["เขี้ยวเงิน","Silverfang"],["ตาเดียว","One-eyed"],["เกล็ดดำ","Black-scaled"],["หางเพลิง","Flametail"],["ขนหิมะ","Snowpelt"],["เขาเหล็ก","Ironhorn"],["เงาจันทร์","Moonshadow"],["กรงเล็บเลือด","Bloodclaw"],["อัสนี","Thunder"],["หินผา","Stoneback"],["ม่วงพิษ","Venom-purple"],["เมฆา","Cloud"]];
  const BUILTIN_ROLES = { farmer:"ชาวนา", hunter:"นายพราน", herbalist:"หมอยา", headman:"ผู้ใหญ่บ้าน", craftsman:"ช่างฝีมือ", merchant:"พ่อค้า", artisan:"ช่างในเมือง", doctor:"หมอ", innkeeper:"เจ้าของโรงน้ำชา", scholar:"บัณฑิต", thug:"นักเลง", courtesan:"นางคณิกา", guard:"ทหารยามเมือง", noble:"ขุนนาง", official:"ขุนนางราชสำนัก", soldier:"ทหารหลวง", general:"แม่ทัพ", eunuch:"ขันที", royal:"เชื้อพระวงศ์", emperor:"จักรพรรดิ", bandit:"โจรภูเขา", banditChief:"หัวหน้าโจร", traveler:"นักเดินทาง", rogue:"ผู้ฝึกตนอิสระ", hermit:"ฤๅษี", hiddenMaster:"ผู้เฒ่าแปลกหน้า", evilMaster:"ปรมาจารย์มาร", evilDisciple:"ผู้ฝึกตนสายมาร", sect:"ศิษย์สำนัก", family:"ครอบครัว", beast:"สัตว์อสูร", demonSovereign:"จอมมาร", demonPrince:"เจ้าชายมาร", demonMinister:"ขุนนางวังมาร", demonGeneral:"แม่ทัพมาร", demonChief:"ประมุขตระกูลมาร", demonWarrior:"นักรบมาร", demonMerchant:"พ่อค้ามาร", demonHunter:"พรานมาร", demonShaman:"หมอผีมาร", demonFolk:"ชาวมาร", halfDemon:"ลูกครึ่งมาร", humanThrall:"ทาสมนุษย์ในแดนมาร" };
  const BUILTIN_DEGREES = [{ id:"xiucai", th:"ซิ่วไฉ" },{ id:"juren", th:"จวี่เหริน" },{ id:"jinshi", th:"จิ้นซื่อ" },{ id:"zhuangyuan", th:"จ้วงหยวน" }];
  const BUILTIN_GRADES = { 9:{th:"เสมียนที่ว่าการอำเภอ"},8:{th:"ปลัดอำเภอ"},7:{th:"นายอำเภอ"},6:{th:"ปลัดจังหวัด"},5:{th:"เจ้ากรมในกระทรวง"},4:{th:"เจ้าเมือง"},3:{th:"รองเสนาบดี"},2:{th:"เสนาบดี"},1:{th:"อัครมหาเสนาบดี"} };
  const BUILTIN_TITLES = [{ id:"nan", th:"หนาน" },{ id:"zi", th:"จื่อ" },{ id:"bo", th:"ป๋อ" },{ id:"hou", th:"โหว" },{ id:"gong", th:"กง" }];
  const BUILTIN_ARMY = [{ id:"private", th:"พลทหาร" },{ id:"squad", th:"หัวหน้าหมู่" },{ id:"captain", th:"หัวหน้ากองร้อย" },{ id:"battalion", th:"ผู้บังคับกองพัน" },{ id:"general", th:"ขุนพล" },{ id:"marshal", th:"แม่ทัพใหญ่" }];
  const BUILTIN_ADVISORS = [{ id:"scribe", th:"กุนซือฝึกหัด" },{ id:"unit", th:"กุนซือประจำกอง" },{ id:"army", th:"กุนซือประจำทัพ" },{ id:"chief", th:"ที่ปรึกษาใหญ่" },{ id:"staff", th:"เสนาธิการ" },{ id:"master", th:"กุนซือเอก" }];
  const REL_TAG_TH = { family:"ครอบครัว",spouse:"คู่ครอง",consort:"อนุ",lover:"คนรัก",betrothed:"คู่หมั้น",exSpouse:"อดีตคู่ครอง",ex:"คนรักเก่า",companion:"คู่หู",sworn:"สาบานพี่น้อง",master:"อาจารย์",student:"ศิษย์",rival:"คู่แข่ง",enemy:"ศัตรู",watched:"ถูกจับตา",spirit:"วิญญาณ",escort:"องครักษ์",benefactor:"ผู้มีพระคุณ" };

  const HIDDEN_TH = {
    lostClan: "ตระกูลสาบสูญ", massacre: "ถูกฆ่าล้างตระกูล", bastard: "ลูกนอกสมรส",
    swapped: "สลับตัวแต่เกิด", demonChild: "ลูกมาร", immortalChild: "ลูกเซียน",
    sealedBody: "กายถูกผนึก", hiddenRoot: "รากซ่อนเร้น", dragonBlood: "สายเลือดมังกร",
    vessel: "ภาชนะ", sealedDemon: "มารถูกผนึก", pastLife: "ความจำชาติก่อน",
    transmigrator: "ผู้ข้ามภพ", ringSpirit: "วิญญาณในแหวน", familyCurse: "คำสาปตระกูล",
    betrothal: "คู่หมั้นแต่กำเนิด", luckyStar: "ดาวนำโชค", doomStar: "ดาวหายนะ",
    lifeDebt: "หนี้ชีวิตแต่กำเนิด", heirloom: "มรดกตกทอด", birthmark: "ปานแต่กำเนิด",
  };
  const NAT_TH = { fox: "จิ้งจอก", dragon: "มังกร", demon: "มาร", wolf: "หมาป่า", phoenix: "หงส์", celestial: "นางฟ้า", god: "เทพ", beast: "สัตว์อสูร" };
  const MARK_TH = {
    nineTails: "เก้าหาง (จิ้งจอก)", foxTail: "หางจิ้งจอก", dragon: "เขามังกร",
    horns: "เขามาร", demonWings: "ปีกมาร", wolf: "หูหมาป่า",
    phoenix: "หงส์", wings: "ปีกนางฟ้า", halo: "รัศมีเทพ",
  };
  const SECT_NAMES_TH = {"azure-cloud-sword": "สำนักกระบี่เมฆาคราม","frost-palace": "วังเหมันต์","blood-demon-cult": "ลัทธิโลหิตมาร","thousand-blossom-valley": "หุบเขาโอสถพันบุปผา","nine-star-formation": "สำนักค่ายกลดาราเก้าชั้น","thousand-venom-shadow": "นิกายเงาพันพิษ","joyful-blossom": "สำนักบุปผาสราญรมย์","vajra-temple": "อารามกายาวัชระ","mountain-beast": "สำนักอสูรภูผา","wandering-wind": "สำนักวายุพเนจร","dragon-guard": "หอพิทักษ์มังกร","thunder-peak": "สำนักยอดเขาอัสนี","shaolin": "วัดเส้าหลิน","wudang": "สำนักบู๊ตึ๊ง","emei": "สำนักง๊อไบ๊","hengshan-nuns": "สำนักชีเฮงซัว (เหนือ)","quanzhen": "สำนักช้วนจิน","beggars": "พรรคกระยาจก","huashan": "สำนักฮั้วซัว","dali": "ตระกูลต้วน (ต้าหลี่)","kunlun": "สำนักคุนลุ้น","taishan": "สำนักไท่ซัว","hengshan": "สำนักเหิงซัว (ใต้)","diancang": "สำนักเตียมชง","songshan": "สำนักซงซัว","kongtong": "สำนักคงท้ง","qingcheng": "สำนักชิงเฉิง","ancient-tomb": "สำนักสุสานโบราณ","peach-blossom": "เกาะดอกท้อ","xiaoyao": "สำนักเซียวเหยา","lingjiu": "วังเหลงจิ้ว","murong": "ตระกูลมู่หยง","heavenly-eagle": "พรรคอินทรีสวรรค์","sun-moon": "พรรคสุริยันจันทรา","ming": "พรรคเม้งก่า","white-camel": "ภูเขาอูฐขาว","iron-palm": "พรรคฝ่ามือเหล็ก","xingxiu": "สำนักซิงซิ่ว","five-poisons": "พรรคห้าพิษ","blood-saber": "สำนักดาบโลหิต","divine-dragon": "พรรคมังกรเทพ"};

  const HIDDEN_SECTS = [];
  const ALL_SECT_IDS = Object.keys(SECT_NAMES_TH);

  const NAME_SUR = C.surnames?.length ? [...C.surnames, ...(C.moreSurnames ?? []), ...(C.demonSurnames ?? [])] : BUILTIN_SURNAMES;
  const NAME_GIVEN = { male: (C.givenNames?.male?.length ? C.givenNames.male : BUILTIN_GIVEN.male).concat(C.moreGiven?.male ?? []), female: (C.givenNames?.female?.length ? C.givenNames.female : BUILTIN_GIVEN.female).concat(C.moreGiven?.female ?? []) };
  const EPITHETS = C.epithets ?? BUILTIN_EPITHETS;
  const ROLES_MAP = C.roles ?? BUILTIN_ROLES;
  const DEGREES = C.degrees ?? BUILTIN_DEGREES;
  const GRADES = C.grades ?? BUILTIN_GRADES;
  const TITLES_NOBLE = C.nobleTitles ?? BUILTIN_TITLES;
  const ARMY = C.armyRanks ?? BUILTIN_ARMY;
  const ADVISORS = C.advisorRanks ?? BUILTIN_ADVISORS;

  function nameOf(p) {
    if (!p) return "#?";
    if (p.nm?.th) return p.nm.th;
    if (p.kind === "beast") { const sp = C.beasts?.[p.sp], ep = EPITHETS[p.ep]; return sp && ep ? `${sp.th}${ep[0]}` : `สัตว์อสูร #${p.id}`; }
    if (Array.isArray(p.n) && p.n.length >= 2) {
      const [s, a, b] = p.n; const sur = NAME_SUR[s]; const given = p.g === "f" ? NAME_GIVEN.female : NAME_GIVEN.male;
      const g1 = given[a], g2 = b >= 0 ? given[b] : null;
      if (sur && g1) return sur[0] + g1[0] + (g2?.[0] ?? "");
    }
    return `NPC #${p.id}`;
  }
  const roleTh = (r) => ROLES_MAP[r] ?? r ?? "?";
  const tagTh = (t) => REL_TAG_TH[t] ?? t;
  const degreeTh = (id) => DEGREES.find((d) => d.id === id)?.th ?? id ?? "—";
  const gradeTh = (g) => g == null ? "—" : (GRADES[g]?.th ?? `ขั้น ${g}`);
  const titleTh = (id) => TITLES_NOBLE.find((t) => t.id === id)?.th ?? id ?? "—";
  const armyTh = (id) => ARMY.find((r) => r.id === id)?.th ?? id ?? "—";
  const advisorTh = (id) => ADVISORS.find((r) => r.id === id)?.th ?? id ?? "—";

  function fmtAbsMonths(m) {
    if (m == null || isNaN(m)) return "—";
    const abs = Math.abs(m), y = Math.floor(abs / 12), mo = abs % 12;
    const p = []; if (y > 0) p.push(`${y} ปี`); if (mo > 0) p.push(`${mo} เดือน`);
    if (!p.length) return "0"; return (m < 0 ? "ก่อน " : "") + p.join(" ");
  }
  function fmtAge(months) {
    if (months == null || isNaN(months)) return "—";
    const y = Math.floor(months / 12), mo = Math.round(months % 12);
    if (y <= 0) return `${mo} เดือน`; return mo > 0 ? `${y} ปี ${mo} เดือน` : `${y} ปี`;
  }
  function splitMonths(m) {
    m = m == null || m === "" ? 0 : Math.round(Number(m));
    const neg = m < 0, abs = Math.abs(m); return { y: (neg ? -1 : 1) * Math.floor(abs / 12), mo: abs % 12 };
  }
  const joinMonths = (y, mo) => { const yn = Number(y) || 0, mn = Number(mo) || 0; return (yn < 0 ? -1 : 1) * (Math.abs(yn) * 12 + Math.abs(mn)); };

  const ITEM = new Map((C.items ?? []).map((x) => [x.id, x]));
  const TECH = new Map((C.techniques ?? []).map((x) => [x.id, x]));
  const TALENT = new Map((C.talents ?? []).map((x) => [x.id, x]));
  const CLASS = new Map((C.classes ?? []).map((x) => [x.id, x]));
  const SLOTS = C.slots ?? ["weapon","armor","accessory1","accessory2","treasure"];
  const slotKind = (s) => (s.startsWith("accessory") ? "accessory" : s);
  const SLOT_TH = { weapon:"ศาสตราวุธ", armor:"เกราะ", accessory1:"ประดับ 1", accessory2:"ประดับ 2", treasure:"สมบัติ" };
  const ITEM_SLOT_TH = { weapon:"ศาสตราวุธ", armor:"เกราะ", accessory:"เครื่องประดับ", treasure:"สมบัติ", pill:"ยา", supply:"ของใช้", material:"วัสดุ", tool:"เครื่องมือ", talisman:"ยันต์", keepsake:"ของที่ระลึก" };
  const KIND_TH = { main:"วิชาหลัก", combat:"ต่อสู้", movement:"ตัวเบา", defense:"ป้องกัน", support:"สนับสนุน" };
  const STAT_TH = { body:"กาย", mind:"ปัญญา", will:"จิตใจ", charm:"เสน่ห์", luck:"โชค" };
  const AXIS_TH = { diligent:"ขยัน", kind:"เมตตา", ambitious:"ทะเยอทะยาน", faithful:"ภักดี" };
  const TIER_TH = (t) => C.tiers?.[t]?.th ?? `ขั้น ${t}`;
  const TIER_CLASS = (t) => `tier-t${Math.max(0, Math.min(5, Number(t) ?? 0))}`;
  const iLabel = (x) => `[${TIER_TH(x.tier)}] ${x.th}`;
  const MASTERY = [[0,"เริ่มต้น"],[100,"ชำนาญ"],[300,"เชี่ยวชาญ"],[700,"สมบูรณ์"],[1500,"บรรลุแก่นแท้"]];
  const TALENT_CLASH = C.talentClash ?? [];
  const IMMORTAL_IDX = C.immortalIdx ?? 8;
  const ROOT_COUNT = C.rootCount ?? Object.fromEntries((C.create?.root ?? []).map((x) => [x.id, x.count ?? 0]));
  const REL_TAGS = ["family","spouse","consort","lover","betrothed","exSpouse","ex","companion","sworn","master","student","rival","enemy","watched","spirit","escort","benefactor"];

  // 🆕 v13.3 — NPC kit helpers (อ่าน p.kit ตาม src/npc-kit.js)
  const KIT_GEAR_SLOTS = ["weapon", "armor", "accessory1", "accessory2", "treasure"];
  const KIT_ART_SLOTS  = ["combat", "main", "support", "movement", "defense"];
  const ART_SLOT_TH    = { combat: "ต่อสู้", main: "วิชาหลัก", support: "สนับสนุน", movement: "ตัวเบา", defense: "ป้องกัน" };
  const MASTERY_TH     = ["เริ่มต้น", "ชำนาญ", "เชี่ยวชาญ", "สมบูรณ์", "บรรลุแก่นแท้"];
  const MASTERY_AT     = [0, 100, 300, 700, 1500];
  const GRADES_TH      = ["ต่ำ", "กลาง", "สูง", "เลิศ", "ลายเมฆ"];
  const TALENT_TIERS_TH = [
    [0.6, "ต่ำ"], [0.9, "ธรรมดา"], [1.3, "ดี"], [2, "สูง"], [3, "อัจฉริยะ"], [Infinity, "ปีศาจอัจฉริยะ"],
  ];
  const TRAITS_TH = ["ใจดี", "หยิ่ง", "โลภ", "ซื่อสัตย์", "เจ้าเล่ห์", "เย็นชา", "ร่าเริง", "ทะเยอทะยาน", "ขี้อาย", "ใจร้อน"];
  const DILIGENCE_BY_TRAIT = [1, 1.05, 0.95, 1.05, 1, 1.1, 0.92, 1.2, 1, 0.9];

  function readNpcKit(p) {
    const k = p?.kit;
    if (!k || !Array.isArray(k.g) || !Array.isArray(k.a)) return null;
    const gear = {}, arts = {};
    KIT_GEAR_SLOTS.forEach((slot, i) => { gear[slot] = k.g[i] || null; });
    KIT_ART_SLOTS.forEach((slot, i) => {
      arts[slot] = k.a[i] ? { id: k.a[i], mastery: k.m?.[i] ?? 0 } : null;
    });
    return { level: k.l ?? null, gear, arts };
  }
  function parseKitLevel(key) {
    if (!key || typeof key !== "string") return null;
    if (key.startsWith("x")) {
      const n = Number(key.slice(1));
      return { path: "x", n, label: n ? (C.realms?.[n]?.th ?? `ขั้น ${n}`) : "คนธรรมดา" };
    }
    if (key.startsWith("m")) {
      const n = Number(key.slice(1));
      return { path: "m", n, label: C.martialRanks?.[n]?.th ?? `ขั้น ${n}` };
    }
    return null;
  }
  function masteryTierOf(pts) {
    let lvl = 0;
    MASTERY_AT.forEach((at, i) => { if (pts >= at) lvl = i; });
    return lvl;
  }
  function npcTalentTh(score) { return TALENT_TIERS_TH.find(([lim]) => score < lim)[1]; }
  function npcWuOf(p) {
    const h = (Math.imul(p.id ?? 0, 2246822519) + (p.b ?? 0) * 31 + 7) >>> 0;
    return 0.8 + ((h % 1000) / 1000) * 0.45;
  }
  function npcWuTh(wu) { return wu < 0.9 ? "ทึบ" : wu < 1.05 ? "พอใช้" : wu < 1.17 ? "ไว" : "เฉียบแหลม"; }
  function npcDilOf(p) { return DILIGENCE_BY_TRAIT[p.tr ?? 0] ?? 1; }
  function npcDilTh(d) { return d < 0.94 ? "เกียจคร้าน" : d < 1.02 ? "ปานกลาง" : d < 1.12 ? "ขยัน" : "มุมานะยิ่ง"; }
  function npcRootLabel(p) {
    const tScore = p.t ?? 1;
    const pk = p.pk ?? 0;
    if (pk <= 0) return null;
    const ROOT_BY_TALENT = [
      [0.6, "รากเทียม", 5], [1, "รากสี่ธาตุ", 4], [1.6, "รากสามธาตุ", 3], [2.5, "รากสองธาตุ", 2], [Infinity, "รากสวรรค์", 1],
    ];
    const [, rName, n] = ROOT_BY_TALENT.find(([lim]) => tScore < lim);
    let h = (p.id ?? 0) * 2654435761 >>> 0;
    const idxs = [0, 1, 2, 3, 4].sort(() => { h = (h * 1103515245 + 12345) >>> 0; return (h % 3) - 1; });
    return `${rName} (${idxs.slice(0, n).map((i) => ["ทอง", "ไม้", "น้ำ", "ไฟ", "ดิน"][i]).join(", ")})`;
  }
  function npcCurLabel(p, npcAge) {
    const pk = p.pk ?? 0, mr = p.mr ?? 0;
    if (pk > 0) { const r = NpcPreview.realmAt(p, npcAge); return C.realms?.[r]?.th ?? `ขั้น ${r}`; }
    if (mr > 0) { const r = NpcPreview.martialRankAt(p, npcAge); return C.martialRanks?.[r]?.th ?? `ขั้น ${r}`; }
    return "คนธรรมดา";
  }
  function npcPeakLabel(p) {
    const pk = p.pk ?? 0, mr = p.mr ?? 0;
    if (pk > 0) return C.realms?.[pk]?.th ?? `ขั้น ${pk}`;
    if (mr > 0) return C.martialRanks?.[mr]?.th ?? `ขั้น ${mr}`;
    return "คนธรรมดา";
  }

  const toast = (msg, bad) => {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; t.className = "toast" + (bad ? " err" : ""); t.hidden = false;
    clearTimeout(toast.id); toast.id = setTimeout(() => (t.hidden = true), 4500);
  };

  const DANGER_RE = /ลบ|คืนค่า|ล้าง/;
  const ask = (m) => window.Dialog
    ? Dialog.confirm(m, { danger: DANGER_RE.test(m), okText: /^ลบ/.test(m) ? "ลบ" : "ตกลง" })
    : Promise.resolve(window.confirm(m));
  const askText = (m, d) => window.Dialog ? Dialog.prompt(m, d ?? "") : Promise.resolve(window.prompt(m, d ?? ""));

  const getPath = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => { const ks = p.split("."), last = ks.pop(); let cur = o; for (const k of ks) cur = cur[k] ??= {}; cur[last] = v; };
  const delPath = (o, p) => { const ks = p.split("."), last = ks.pop(); let cur = o; for (const k of ks) { cur = cur?.[k]; if (!cur) return; } delete cur[last]; };

  let SAVED_HASH = null, dirtyTimer = 0;
  const isDirty = () => !!S && WoxIO.hash(JSON.stringify(S)) !== SAVED_HASH;
  function refreshDirty() { const b = $("#save"); if (b) b.classList.toggle("dirty", isDirty()); }
  function scheduleDirty() { clearTimeout(dirtyTimer); dirtyTimer = setTimeout(refreshDirty, 250); }
  function markSaved() { SAVED_HASH = S ? WoxIO.hash(JSON.stringify(S)) : null; refreshDirty(); }
  ["input", "change", "click"].forEach((t) => document.addEventListener(t, scheduleDirty, true));
  window.addEventListener("beforeunload", (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ""; } });

  function pushUndo() {
    if (!S) return;
    UNDO_STACK = UNDO_STACK.slice(0, UNDO_IDX + 1);
    const snap = JSON.stringify(S);
    if (UNDO_STACK[UNDO_IDX] === snap) return;
    UNDO_STACK.push(snap);
    if (UNDO_STACK.length > UNDO_MAX) UNDO_STACK.shift();
    UNDO_IDX = UNDO_STACK.length - 1;
    updateUndoButtons();
  }
  function undo() { if (UNDO_IDX <= 0) return; UNDO_IDX--; S = JSON.parse(UNDO_STACK[UNDO_IDX]); renderAll(); updateUndoButtons(); toast("↶ ย้อนกลับ"); }
  function redo() { if (UNDO_IDX >= UNDO_STACK.length - 1) return; UNDO_IDX++; S = JSON.parse(UNDO_STACK[UNDO_IDX]); renderAll(); updateUndoButtons(); toast("↷ ทำซ้ำ"); }
  function updateUndoButtons() { const u = $("#undo-btn"), r = $("#redo-btn"); if (u) u.disabled = UNDO_IDX <= 0; if (r) r.disabled = UNDO_IDX >= UNDO_STACK.length - 1; scheduleDirty(); }
  function resetUndo() { UNDO_STACK = S ? [JSON.stringify(S)] : []; UNDO_IDX = S ? 0 : -1; updateUndoButtons(); }

  function persistKey() { return S?.seed ? `wox-meta-${S.seed}` : null; }
  function loadMeta() {
    BOOKMARKS.clear(); NOTES.clear(); LOOK_OVERRIDES.clear();
    const k = persistKey(); if (!k) return;
    try { const raw = JSON.parse(localStorage.getItem(k) || "{}"); (raw.bookmarks || []).forEach((id) => BOOKMARKS.add(id)); (raw.notes || []).forEach(([id, txt]) => NOTES.set(id, txt)); (raw.looks || []).forEach(([id, look]) => LOOK_OVERRIDES.set(id, look)); } catch {}
  }
  function persistMeta() {
    const k = persistKey(); if (!k) return;
    try { localStorage.setItem(k, JSON.stringify({ bookmarks: [...BOOKMARKS], notes: [...NOTES.entries()], looks: [...LOOK_OVERRIDES.entries()] })); } catch {}
  }
  function toggleBookmark(id) { const n = Number(id); if (BOOKMARKS.has(n)) BOOKMARKS.delete(n); else BOOKMARKS.add(n); persistMeta(); renderPanel(); }

  function openGlobalSearch() {
    if (!S) return toast("ยังไม่ได้เปิดไฟล์", true);
    const host = document.createElement("div"); host.className = "gs-overlay";
    host.innerHTML = `<div class="gs-box"><input class="gs-input" id="gs-input" placeholder="ค้นหา NPC, ไอเทม, วิชา, log..." autocomplete="off"><div class="gs-results" id="gs-results"></div><div class="gs-hint"><span>⏎ jump</span><span>↑↓ เลือก</span><span>Esc ปิด</span></div></div>`;
    document.body.appendChild(host);
    const input = host.querySelector("#gs-input"), results = host.querySelector("#gs-results");
    let activeIdx = 0, flatResults = [];
    const buildResults = (q) => {
      const lower = q.toLowerCase(), groups = [];
      if (lower) {
        const npcHits = (S.world?.people ?? []).filter((p) => `${nameOf(p)} ${p.nm?.en ?? ""} ${p.id} ${roleTh(p.role)}`.toLowerCase().includes(lower)).slice(0, 20);
        if (npcHits.length) groups.push({ label: "NPC", icon: "👤", items: npcHits.map((p) => ({ key: `npc-${p.id}`, title: nameOf(p), sub: `${roleTh(p.role)} · #${p.id}`, jump: () => { if (S.world.rel?.[p.id]) { TAB = "rel"; SELECTED_REL = p.id; NPC_TAB = "info"; renderNav(); renderPanel(); renderSide(); } else { toast("NPC นี้ยังไม่อยู่ในความสัมพันธ์"); } close(); } })) });
        const itemHits = Object.entries(S.bag ?? {}).filter(([id, n]) => n > 0 && `${id} ${ITEM.get(id)?.th ?? ""} ${ITEM.get(id)?.en ?? ""}`.toLowerCase().includes(lower)).slice(0, 15);
        if (itemHits.length) groups.push({ label: "ไอเทมในถุง", icon: "🎒", items: itemHits.map(([id, n]) => ({ key: `item-${id}`, title: `${ITEM.get(id)?.th ?? id} ×${n}`, sub: id, jump: () => { TAB = "gear"; GEAR_TAB = "items"; FILTER.bag = id; renderNav(); renderPanel(); renderSide(); close(); } })) });
        const techHits = Object.keys(S.techs ?? {}).filter((id) => `${id} ${TECH.get(id)?.th ?? ""} ${TECH.get(id)?.en ?? ""}`.toLowerCase().includes(lower)).slice(0, 15);
        if (techHits.length) groups.push({ label: "วิชา", icon: "📖", items: techHits.map((id) => ({ key: `tech-${id}`, title: TECH.get(id)?.th ?? id, sub: id, jump: () => { TAB = "gear"; GEAR_TAB = "arts"; FILTER.tech = id; renderNav(); renderPanel(); renderSide(); close(); } })) });
        const logHits = (S.log ?? []).filter((l) => (l.th ?? "").toLowerCase().includes(lower)).slice(0, 15);
        if (logHits.length) groups.push({ label: "Log", icon: "📜", items: logHits.map((l, i) => ({ key: `log-${i}`, title: l.th, sub: `${l.age ?? "?"} ปี`, jump: () => { TAB = "timeline"; renderNav(); renderPanel(); renderSide(); close(); } })) });
      }
      return groups;
    };
    const render = () => {
      const q = input.value.trim(), groups = q ? buildResults(q) : []; flatResults = [];
      if (!groups.length) { results.innerHTML = q ? `<div class="gs-empty">ไม่พบ "${esc(q)}"</div>` : `<div class="gs-empty">พิมพ์เพื่อค้นหา NPC, ไอเทม, วิชา, log</div>`; return; }
      results.innerHTML = groups.map((g) => `<div class="gs-group">${g.icon} ${esc(g.label)}</div>${g.items.map((it) => { flatResults.push(it); return `<div class="gs-item${flatResults.length - 1 === activeIdx ? " active" : ""}" data-idx="${flatResults.length - 1}"><div class="gs-item-icon">${g.icon}</div><div class="gs-item-body"><div class="gs-item-title">${esc(it.title)}</div><div class="gs-item-sub">${esc(it.sub)}</div></div></div>`; }).join("")}`).join("");
    };
    const close = () => { host.remove(); document.removeEventListener("keydown", onKey, true); };
    const onKey = (e) => {
      if (e.key === "Escape") { close(); e.preventDefault(); }
      else if (e.key === "ArrowDown") { activeIdx = Math.min(flatResults.length - 1, activeIdx + 1); render(); results.querySelector(".active")?.scrollIntoView({ block: "nearest" }); e.preventDefault(); }
      else if (e.key === "ArrowUp") { activeIdx = Math.max(0, activeIdx - 1); render(); results.querySelector(".active")?.scrollIntoView({ block: "nearest" }); e.preventDefault(); }
      else if (e.key === "Enter" && flatResults[activeIdx]) { flatResults[activeIdx].jump(); e.preventDefault(); }
    };
    input.addEventListener("input", () => { activeIdx = 0; render(); });
    results.addEventListener("click", (e) => { const el = e.target.closest("[data-idx]"); if (!el) return; const idx = Number(el.dataset.idx); if (flatResults[idx]) flatResults[idx].jump(); });
    host.addEventListener("click", (e) => { if (e.target === host) close(); });
    document.addEventListener("keydown", onKey, true); render(); setTimeout(() => input.focus(), 50);
  }

  document.addEventListener("keydown", (e) => {
    const cmd = e.ctrlKey || e.metaKey, inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");
    if (cmd && e.key === "k") { e.preventDefault(); openGlobalSearch(); return; }
    if (cmd && e.key === "s") { e.preventDefault(); if (S) save(false); return; }
    if (cmd && e.key === "o") { e.preventDefault(); $("#file")?.click(); return; }
    if (cmd && e.key === "z" && !e.shiftKey && !inField) { e.preventDefault(); undo(); return; }
    if (cmd && (e.key === "y" || (e.key === "z" && e.shiftKey)) && !inField) { e.preventDefault(); redo(); return; }
    if (e.key === "Escape") { document.querySelectorAll(".gs-overlay, .modal").forEach((m) => m.remove()); }
  });

  const initGear = () => { S.bag ??= {}; S.equip ??= {}; S.techs ??= {}; S.slots ??= { main: null, combat: [], movement: null, defense: null, support: [] }; S.slots.combat ??= []; S.slots.support ??= []; S.chosen ??= {}; S.world ??= {}; S.world.rel ??= {}; };
  const wearing = (id) => SLOTS.filter((x) => S.equip?.[x] === id).length;
  const combatSlots = () => 2 + ((S.realm ?? 0) >= 2 ? 1 : 0) + ((S.realm ?? 0) >= 3 ? 1 : 0);
  const supportSlots = () => 1 + ((S.realm ?? 0) >= 3 ? 1 : 0);
  const setStat = (k, v) => { const old = S.stats[k] ?? 50; S.stats[k] = v; S.statSrc ??= {}; const src = (S.statSrc[k] ??= { born: old }); src.born = (src.born ?? 0) + (v - old); };
  const applyTalentFx = (id, sign = 1) => { const T = TALENT.get(id); if (!T?.fx) return; S.statSrc ??= {}; for (const [k, v] of Object.entries(T.fx)) { const old = S.stats[k] ?? 50; S.stats[k] = Math.max(1, old + sign * v); S.statSrc[k] ??= { born: old }; S.statSrc[k].talent = (S.statSrc[k].talent ?? 0) + (S.stats[k] - old); } };
  const setTalent = (id, on) => { const had = S.talents.includes(id); if (on === had) return; S.talents = on ? [...S.talents, id] : S.talents.filter((x) => x !== id); if ($("#talfx")?.checked ?? true) applyTalentFx(id, on ? 1 : -1); };
  const talentSlotsUsed = () => ({ good: S.talents.filter((id) => TALENT.get(id)?.good && !TALENT.get(id)?.crossing).length, bad: S.talents.filter((id) => !TALENT.get(id)?.good && !TALENT.get(id)?.crossing).length, cross: S.talents.filter((id) => TALENT.get(id)?.crossing).length, goodCap: 5 });
  const talentClashes = () => TALENT_CLASH.filter(([a, b]) => S.talents.includes(a) && S.talents.includes(b));
  const setRootType = (type) => { if (type === "none") { S.root = { type: null, elements: [], purity: 0, known: !!S.root?.known }; return; } const need = ROOT_COUNT[type] ?? 1; const pool = type === "special" ? C.specialElements : C.basicElements; const keep = (S.root?.elements ?? []).filter((e) => pool.includes(e)).slice(0, need); const fill = pool.filter((e) => !keep.includes(e)).slice(0, need - keep.length); const rev = S.root?.rev; S.root = { type, elements: [...keep, ...fill], purity: S.root?.purity || 60, known: !!S.root?.known }; if (rev) S.root.rev = rev; };
  const toggleElem = (e, on) => { const r = S.root; if (!r?.type) return; const need = ROOT_COUNT[r.type] ?? 1; let list = (r.elements ?? []).filter((x) => x !== e); if (on) { list.push(e); if (list.length > need) list = list.slice(list.length - need); } r.elements = list; };

  const relOf = (id) => S.world?.rel?.[id];
  const npcOf = (id) => S.world?.people?.find((p) => p.id === id);
  const addRelPerson = (id) => { if (relOf(id)) return; const p = npcOf(id); if (!p) return; const r = { c: 0, tags: [], met: S.ageMonths ?? 0, last: S.ageMonths ?? 0, n: 1 }; if (S.world.family?.includes(id)) r.tags.push("family"); if (S.spouseId === id) { r.tags.push("spouse"); r.c = 60; p.wed = true; } S.world.rel[id] = r; };
  const delRel = (id) => { if (!relOf(id)) return; delete S.world.rel[id]; if (S.spouseId === id) { S.spouseId = null; S.married = false; S.spouse = null; } if (SELECTED_REL === id) SELECTED_REL = null; SELECTED_MULTI.delete(Number(id)); };
  const setRelField = (id, key, val) => { const r = relOf(id); if (!r) return; if (val === null || val === "" || val === undefined) delete r[key]; else r[key] = val; };

  // 🆕 v13.3 — setNpcField: เพิ่ม t/tr/pk/mr/role/sect
  const setNpcField = (p, key, val) => {
    if (key.startsWith("stats.")) {
      p.stats ??= (window.NpcPreview?.deriveStats ? window.NpcPreview.deriveStats(p, S?.ageMonths ?? 0) : { body: 50, mind: 50, will: 50, charm: 50, luck: 50 });
      p.stats[key.split('.')[1]] = val; return;
    }
    if (key === "nm.th") { p.nm ??= { th: "", en: "" }; p.nm.th = val; return; }
    if (key === "nm.en") { p.nm ??= { th: "", en: "" }; p.nm.en = val; return; }
    if (key === "t")  { p.t  = Math.max(0.35, Math.min(4.5, Number(val) || 1)); return; }
    if (key === "tr") { p.tr = Math.max(0, Math.min(9, Math.round(Number(val) || 0))); return; }
    if (key === "pk") { p.pk = Math.max(0, Math.min(8, Math.round(Number(val) || 0))); return; }
    if (key === "mr") { p.mr = Math.max(0, Math.min(6, Math.round(Number(val) || 0))); if (p.mr) p.pk = 0; return; }
    if (key === "role") { p.role = String(val || "traveler"); return; }
    if (key === "sect") { if (val) p.sect = String(val); else delete p.sect; return; }
    if (key === "dead") { p.dead = val; return; }
    if (key === "nat") { if (val) p.nat = val; else delete p.nat; return; }
    if (key === "mk") { if (val) p.mk = val; else delete p.mk; return; }
    if (key === "dm") { if (val === "" || val === null) delete p.dm; else p.dm = Number(val); return; }
    if (val === null || val === "" || val === undefined) delete p[key];
    else p[key] = val;
  };

  const getNpcLook = (p) => {
    if (LOOK_OVERRIDES.has(p.id)) return LOOK_OVERRIDES.get(p.id);
    if (p.look) return p.look;
    if (window.NpcPreview?.lookOf) { const look = window.NpcPreview.lookOf(p, S?.ageMonths ?? 0, S?.world); if (look) return look; }
    const P = window.WoxPreview; if (!P) return {};
    const L = C.looks ?? {}; let seed = p.id || 0;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const fem = p.g === 'f';
    return { female: fem, stage: 'adult', hair: fem ? pick(P.HAIR_SPECS_F) : pick(P.HAIR_SPECS_M), hairColor: pick(Object.keys(L.hairColors ?? {black:'#2b2222'})), skin: pick(L.skins ?? ['#f0c8a0']), eyes: pick(L.eyeShapes ?? ['round']), eyeColor: pick(L.eyeColors ?? ['brown']), mouth: pick(C.create?.mouths ?? ['calm']), robe: fem ? "#a8607a" : (p.role === 'scholar' ? "#e8dfca" : "#4f7aa6"), sash: "#8a4b2f", trim: "#efe7d6", armor: false, monk: false, charm: 50 };
  };

  function renderNpcThumb(p, size = 40) {
    if (!p) return "";
    if (p.kind === "beast") return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:#292524;border:1px solid #44403c;border-radius:4px;color:#a8a29e;font-size:${Math.round(size*0.45)}px;">🐾</span>`;
    if (!window.WoxPreview?.portrait) return "";
    try { const look = getNpcLook(p); const cv = window.WoxPreview.portrait(look); if (!cv) return ""; return `<img src="${cv.toDataURL()}" width="${size}" height="${size}" style="image-rendering:pixelated;border-radius:4px;background:#1c1917;border:1px solid #44403c;display:block;">`; } catch { return ""; }
  }

  function npcStatsOf(p) { if (p.stats) return p.stats; if (window.NpcPreview?.deriveStats) return window.NpcPreview.deriveStats(p, S?.ageMonths ?? 0); return { body: 50, mind: 50, will: 50, charm: 50, luck: 50 }; }
  function statMaxFor(stats) { const vals = Object.values(stats ?? {}); return Math.max(300, ...vals); }

  const diffAgainstOrig = () => { const out = []; walkDiff(ORIG, S, "", out); return out; };
  function walkDiff(a, b, prefix, out) {
    if (a === b) return; const ta = typeof a, tb = typeof b;
    if (ta !== tb || a === null || b === null || ta !== "object") { out.push({ path: prefix, old: a, new: b }); return; }
    if (Array.isArray(a) !== Array.isArray(b)) { out.push({ path: prefix, old: a, new: b }); return; }
    if (Array.isArray(a)) { for (let i = 0; i < Math.max(a.length, b.length); i++) walkDiff(a[i], b[i], `${prefix}[${i}]`, out); return; }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of keys) walkDiff(a[k], b[k], prefix ? `${prefix}.${k}` : k, out);
  }
  function showDiffModal(onConfirm) {
    const diffs = diffAgainstOrig(); const host = document.createElement("div");
    host.innerHTML = `<div class="modal"><div class="modal-body"><h3>การเปลี่ยนแปลง (${diffs.length})</h3><table><thead><tr><th>path</th><th>เดิม</th><th>ใหม่</th></tr></thead><tbody>${diffs.slice(0, 100).map((d) => `<tr><td class="mute">${esc(d.path)}</td><td>${esc(JSON.stringify(d.old))}</td><td>${esc(JSON.stringify(d.new))}</td></tr>`).join("")}${diffs.length > 100 ? `<tr><td colspan="3" class="mute">+${diffs.length - 100} รายการ...</td></tr>` : ""}</tbody></table><div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost" id="diff-cancel">ยกเลิก</button><button class="btn primary" id="diff-confirm">ดาวน์โหลด</button></div></div></div>`;
    document.body.appendChild(host); const close = () => host.remove();
    host.querySelector("#diff-cancel").onclick = close; host.querySelector("#diff-confirm").onclick = () => { close(); onConfirm(); };
    host.querySelector(".modal").onclick = (e) => { if (e.target.classList.contains("modal")) close(); };
  }

  const BACKUP_KEY = "wox-editor-backups-v1";
  function saveBackup(name, size, snapshot) {
    let all = [];
    try { all = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? "[]"); } catch {}
    all.unshift({ name, size, at: Date.now(), snapshot });
    while (all.length > 10) all.pop();
    let dropped = 0;
    for (;;) {
      try { localStorage.setItem(BACKUP_KEY, JSON.stringify(all)); return dropped; }
      catch {
        if (all.length <= 1) { toast("พื้นที่เบราว์เซอร์เต็ม บันทึกประวัติสำรองไม่ได้", true); return dropped; }
        all.pop(); dropped++;
      }
    }
  }
  const listBackups = () => { try { return JSON.parse(localStorage.getItem(BACKUP_KEY) ?? "[]"); } catch { return []; } };

  const HAIR_COL_TH = { black:"ดำ", dark:"น้ำตาลเข้ม", brown:"น้ำตาล", chestnut:"น้ำตาลแดง", grey:"เทา", white:"ขาว", silver:"เงิน", red:"แดง" };
  const EYE_SH_TH = { round:"กลม", phoenix:"หงส์", gentle:"อ่อนโยน", sharp:"คม", sleepy:"ง่วง", sparkly:"ประกาย", fierce:"ดุ", crescent:"หยี" };
  const EYE_COL_TH = { brown:"น้ำตาล", dark:"ดำ", amber:"อำพัน", grey:"เทา", blue:"ฟ้า", red:"แดง", gold:"ทอง", violet:"ม่วง" };
  const MOUTH_TH = { calm:"เรียบ", smile:"ยิ้ม", small:"เล็ก", wide:"กว้าง", frown:"บึ้ง", pout:"มุ่ย" };
  function lookList(k) {
    const L = C.looks ?? {};
    if (k === "gender") return [["male","ชาย"],["female","หญิง"]];
    if (k === "hair") { const hs = S?.gender === "female" ? (L.hairF ?? []) : (L.hairM ?? []); return hs.map((h, i) => [i, `${i} · ${h.th}`]); }
    if (k === "hairColor") return Object.entries(L.hairColors ?? {}).map(([id, hex]) => [id, HAIR_COL_TH[id] ?? id, hex]);
    if (k === "skin") return (L.skins ?? []).map((hex, i) => [i, `เฉด ${i}`, hex]);
    if (k === "eyes") return (L.eyeShapes ?? []).map((id) => [id, EYE_SH_TH[id] ?? id]);
    if (k === "eyeColor") return (L.eyeColors ?? []).map((id) => [id, EYE_COL_TH[id] ?? id]);
    if (k === "mouth") return (C.create?.mouths ?? ["calm"]).map((id) => [id, MOUTH_TH[id] ?? id]);
    return [];
  }
  function stepLook(k, dir) {
  if (!S) return; S.look ??= {}; const list = lookList(k); if (!list.length) return;
  const cur = k === "gender" ? S.gender : S.look[k];
  let idx = list.findIndex(([v]) => String(v) === String(cur)); if (idx < 0) idx = 0;
  const next = (idx + dir + list.length) % list.length;
  if (k === "gender") {
    S.gender = list[next][0];
    const hs = S.gender === "female" ? (C.looks?.hairF ?? []) : (C.looks?.hairM ?? []);
    if (hs.length && Number(S.look.hair) >= hs.length) S.look.hair = 0;
  } else S.look[k] = list[next][0];
}
  function renderLook() {
    const L = C.looks ?? {}, P = window.WoxPreview ?? {};
    const fem = S?.gender === "female";
    const specs = fem ? P.HAIR_SPECS_F : P.HAIR_SPECS_M;
    const hIdx = Number(S?.look?.hair) || 0;
    const hairSpec = specs?.[hIdx] ?? P.STOCK_HAIR?.[fem ? 1 : 0] ?? { back:"none", cap:"full", fringe:"none", top:"knot", tail:"none", locks:false, band:false, orn:null };
    const hcKey = S?.look?.hairColor ?? "black";
    const hairColor = L.hairColors?.[hcKey] ?? (hcKey.startsWith?.("#") ? hcKey : "#2b2222");
    let skin = L.skins?.[Number(S?.look?.skin) || 0] ?? "#f0c8a0";
    const yrs = Math.floor((S?.ageMonths ?? 192) / 12);
    const stage = yrs < 3 ? "baby" : yrs < 12 ? "child" : yrs < 17 ? "teen" : yrs >= 65 ? "old" : yrs >= 42 ? "middle" : "adult";
    const base = P.heroLook ? P.heroLook({ female:fem, baby:stage==="baby", child:stage==="child", cultivator:!!(S?.cultivating || (S?.realm ?? 0) > 0) }) : { robe:fem?"#a8607a":"#4f7aa6", sash:"#8a4b2f", trim:"#efe7d6" };
    let eyeColor = S?.look?.eyeColor ?? "brown";
    if (S?.dm) {
      const DEMON_SKINS = C.demonSkins ?? {};
      const hash = (n, salt) => {
        let h = (n * 2654435761 + salt * 40503) >>> 0;
        h ^= h >>> 15;
        h = Math.imul(h, 2246822519) >>> 0;
        h ^= h >>> 13;
        return h >>> 0;
      };
      const pickBy = (n, salt, list) => list[hash(n, salt) % list.length];
      if (DEMON_SKINS[S.dm]) skin = pickBy(0, 41, DEMON_SKINS[S.dm]);
      eyeColor = pickBy(0, 42, ["red", "red", "gold", "violet"]);
    }

    const look = { 
      female: fem, 
      stage, 
      hair: hairSpec, 
      hairColor, 
      skin, 
      eyes: S?.look?.eyes ?? "round", 
      eyeColor, 
      mouth: S?.look?.mouth ?? "calm", 
      robe: base.robe, 
      trim: base.trim ?? "#efe7d6", 
      sash: base.sash ?? "#8a4b2f", 
      armor: !!(S?.equip?.armor && ITEM.get(S.equip.armor)?.slot === "armor"), 
      monk: S?.equip?.armor === "wx_monk_robe", 
      charm: S?.stats?.charm ?? 50 
    };

    if (S?.mark) {
      look.mark = S.mark;
    } else if (S?.nat) {
      const natMap = { fox: "nineTails", dragon: "dragon", demon: "horns", wolf: "wolf", phoenix: "phoenix", celestial: "wings", god: "halo", beast: "wolf" };
      if (natMap[S.nat]) look.mark = natMap[S.nat];
    }

    return look;
  }

  function mountLook() {
    const isNpc = TAB === "rel" && SELECTED_REL !== null && relOf(SELECTED_REL);
    const p = isNpc ? npcOf(SELECTED_REL) : S;
    const host = document.getElementById("look-canvas");
    if (host) {
      host.replaceChildren();
      if (!window.WoxPreview) host.textContent = "ตัวอย่างไม่โหลด";
      else try { const look = isNpc ? getNpcLook(p) : renderLook(); const cv = window.WoxPreview.personCanvas(look, POSE); cv.className = "look-pic"; cv.style.width = `${cv.width * 3}px`; host.appendChild(cv); } catch (err) { host.textContent = "วาดไม่ได้: " + err.message; }
    }
    const faceHost = document.getElementById("pv-face");
    if (faceHost && window.WoxPreview?.portrait && S) {
      faceHost.replaceChildren();
      try { const look = isNpc ? getNpcLook(p) : renderLook(); faceHost.appendChild(window.WoxPreview.portrait(look)); } catch {}
    }
  }
  function lookSelects() {
    const rows = [["gender","เพศ"],["hair","ทรงผม"],["hairColor","สีผม"],["skin","สีผิว"],["eyes","ตา"],["eyeColor","สีตา"],["mouth","ปาก"]].map(([k, label]) => {
      const list = lookList(k); const cur = k === "gender" ? S.gender : S.look?.[k];
      const idx = list.findIndex(([v]) => String(v) === String(cur));
      const item = idx >= 0 ? list[idx] : [cur, `${cur ?? "—"} (นอกรายการ)`, null];
      const sw = item[2] ? `<i class="swatch" style="background:${esc(item[2])}"></i>` : "";
      return `<div class="opt"><span>${label}</span><button type="button" class="btn sm" data-act="look-step" data-k="${k}" data-d="-1">◀</button><span class="opt-v">${sw}${esc(item[1])}</span><button type="button" class="btn sm" data-act="look-step" data-k="${k}" data-d="1">▶</button><span class="opt-n">${idx >= 0 ? idx + 1 : "?"}/${list.length}</span></div>`;
    }).join("");
    const poses = [["stand","ยืน"],["walkA","เดิน"],["sit","นั่ง"],["punchA","ต่อย"],["flyer","เหาะ"]].map(([p, th]) => `<button type="button" class="btn sm${POSE === p ? " primary" : " ghost"}" data-act="look-pose" data-pose="${p}">${th}</button>`).join("");
    return `<div class="look-box"><div class="look-stage"><div id="look-canvas"></div><div class="look-poses">${poses}</div></div><div class="opts">${rows}</div></div>`;
  }

  const PANEL_KEYS = {
    id: ["name","gender","ageMonths","money","karma","fame","health","nat","mark","dm"],
    origin: ["cls","structure","sinew","root","talents","hidden","flags","found"],
    stats: ["stats","statSrc","personality"],
    place: ["continent","region","homeRegion","home","placeAt","visit","stayTown","staySect","spot"],
    gear: ["bag","equip","chosen","techs","slots","recipes"],
    life: ["alive","ascended","realm","layer","qi","cultivating","martial","health","death","immortalStay","immortalStayDue","stayRevived","degree","office","merit","army","armyRank","advisor","ennobled","noble","sect","path"],
  };
  function resetPanel() { const keys = PANEL_KEYS[TAB]; if (!keys) return toast("แผงนี้ไม่มีอะไรคืน"); pushUndo(); for (const k of keys) { const o = getPath(ORIG, k); if (o === undefined) delete S[k]; else S[k] = clone(o); } toast(`คืนค่าแผง ${TAB}`); renderPanel(); renderSide(); }

  function pFile() {
    if (!S) return `<div class="welcome"><h2>เริ่มต้น</h2><ol><li>ในเกม สร้าง/เปิดเซฟ แล้วส่งออกเป็นไฟล์ <code>.wox</code></li><li>เปิดไฟล์ที่นี่ (ปุ่มด้านบน หรือลากมาวางในกรอบ)</li><li>แก้ค่า แล้วกด "ดาวน์โหลด .wox"</li></ol><div class="drop" id="drop">ลากไฟล์ .wox มาวางที่นี่</div></div>`;
    const kb = (JSON.stringify(S).length / 1024).toFixed(0), backups = listBackups(), realmCal = S.realmCal?.list ?? [];
    const upcoming = realmCal.filter((e) => (S.ageMonths ?? 0) < e.end).slice(0, 3);
    return `<h2>ไฟล์ที่เปิดอยู่</h2>
      <dl class="pv-grid">
        <dt>ชื่อไฟล์</dt><dd>${esc(FILE)}</dd><dt>รูปแบบ</dt><dd>${WRAP === "gzip" ? "gzip" : "plain"}</dd>
        <dt>ขนาด</dt><dd>${kb} KB</dd><dt>seed</dt><dd>${esc(S.seed)}</dd>
        <dt>สถานะ</dt><dd>${S.alive ? "มีชีวิต" : S.ascended ? "บรรลุเซียน" : "เสียชีวิต"}</dd>
        <dt>ผู้คนในโลก</dt><dd>${S.world?.people?.length ?? 0}</dd>
        <dt>บันทึก</dt><dd>${S.log?.length ?? 0}${S.logBase ? ` (+${S.logBase} ตัด)` : ""}</dd>
        <dt>เวอร์ชัน</dt><dd>${S.version ?? "-"}</dd>
      </dl>
      ${upcoming.length ? `<h3>แดนลับจะเปิด</h3><table><thead><tr><th>ที่</th><th>ใกล้เมือง</th><th>เปิดเมื่อ</th></tr></thead><tbody>${upcoming.map((e) => { const t = (C.trips ?? {})[e.id]; const town = C.towns?.[e.town]?.th ?? e.town; const at = e.at - (S.ageMonths ?? 0); return `<tr><td>${esc(t?.title?.th ?? t?.th ?? e.id)}</td><td>${esc(town)}</td><td>อีก ${Math.max(0, Math.ceil(at / 12))} ปี</td></tr>`; }).join("")}</tbody></table>` : ""}
      ${backups.length ? `<h3>ประวัติการบันทึก</h3><table><thead><tr><th>เวลา</th><th>ชื่อ</th><th>ขนาด</th><th></th></tr></thead><tbody>${backups.slice(0, 5).map((b, i) => `<tr><td>${new Date(b.at).toLocaleString("th-TH")}</td><td>${esc(b.name)}</td><td>${(b.size / 1024).toFixed(0)} KB</td><td><button class="btn sm" data-act="load-backup" data-id="${i}">โหลด</button></td></tr>`).join("")}</tbody></table>` : ""}`;
  }

  function pId() {
    const yrs = Math.floor((S.ageMonths ?? 0) / 12), mo = (S.ageMonths ?? 0) % 12;
    return `<h2>ตัวตน</h2><div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn ghost sm" data-act="reset-panel">คืนค่าแผงนี้</button></div>
      <div class="grid">
        <label class="f"><span>ชื่อ (ไทย)</span><input type="text" data-p="name.th" data-t="str" value="${esc(S.name?.th ?? "")}"></label>
        <label class="f"><span>ชื่อ (อังกฤษ)</span><input type="text" data-p="name.en" data-t="str" value="${esc(S.name?.en ?? "")}"></label>
        <label class="f"><span>เงิน (ตำลึง)</span><input type="number" data-p="money" data-t="int" min="0" value="${S.money ?? 0}"></label>
        <label class="f"><span>กรรม</span><input type="number" data-p="karma" data-t="int" min="-300" max="300" value="${S.karma ?? 0}"></label>
        <label class="f"><span>ชื่อเสียง</span><input type="number" data-p="fame" data-t="int" min="0" value="${S.fame ?? 0}"></label>
        <label class="f"><span>พลังชีวิต</span><input type="number" data-p="health" data-t="float" min="0" max="100" value="${Math.round(S.health ?? 100)}"></label>
        <label class="f"><span>ปี</span><input type="number" data-act="age" id="age-y" min="0" max="2000" value="${yrs}"></label>
        <label class="f"><span>เดือน (0–11)</span><input type="number" data-act="age" id="age-m" min="0" max="11" value="${mo}"></label>
      </div>
      <div class="note bad">เปลี่ยนอายุไม่สร้างเหตุการณ์หรือความทรงจำให้</div>
      <h3>สายเลือด & เครื่องหมาย</h3>
      <div class="grid">
        <label class="f"><span>สายเลือด (nat)</span><select data-act="hero-nat"><option value="">— ไม่มี —</option>${Object.entries(NAT_TH).map(([k, v]) => `<option value="${k}"${S.nat === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
        <label class="f"><span>เครื่องหมาย (mark)</span><select data-act="hero-mark"><option value="">— ไม่มี —</option>${Object.entries(MARK_TH).map(([k, v]) => `<option value="${k}"${S.mark === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
        <label class="f"><span>ผิว/ตา มาร (dm)</span><select data-act="hero-dm"><option value="">— ไม่มี —</option><option value="1"${S.dm === 1 ? " selected" : ""}>ผิวเทามาร (1)</option><option value="2"${S.dm === 2 ? " selected" : ""}>ลูกครึ่ง (2)</option><option value="3"${S.dm === 3 ? " selected" : ""}>ผิวแดงมาร (3)</option></select></label>
      </div>
      <h3>รูปลักษณ์</h3>${lookSelects()}`;
  }

  function pOrigin() {
    const r = S.root ?? { type: null, elements: [] };
    const rElems = r.elements ?? [];
    const need = r.type ? (ROOT_COUNT[r.type] ?? 1) : 0;
    const pool = r.type === "special" ? C.specialElements : C.basicElements;
    const elems = r.type ? `<div class="chips">${pool.map((e) => `<label class="chip"><input type="checkbox" data-act="elem" data-id="${e}"${rElems.includes(e) ? " checked" : ""}>${esc(C.elements[e].th)}</label>`).join("")}</div><div class="mute">ต้อง ${need} ธาตุ (เลือก ${rElems.length})</div>` : "";
    const ts = talentSlotsUsed(), clashes = talentClashes(), clashIds = new Set(clashes.flat());
    const tal = (good) => (C.talents ?? []).filter((t) => t.good === good && !t.crossing).sort((a, b) => b.tier - a.tier).map((t) => `<label class="chip ${good ? "" : "bad"}"${clashIds.has(t.id) ? ' title="ชนกับพรสวรรค์ที่เลือก"' : ""}><input type="checkbox" data-act="talent" data-id="${t.id}"${S.talents.includes(t.id) ? " checked" : ""}>${esc(t.th)} <small class="mute">T${t.tier}</small></label>`).join("");
    const cross = (C.talents ?? []).filter((t) => t.crossing).map((t) => `<label class="chip"><input type="checkbox" data-act="talent" data-id="${t.id}"${S.talents.includes(t.id) ? " checked" : ""}>${esc(t.th)}</label>`).join("");
    return `<h2>กำเนิด</h2><div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn ghost sm" data-act="reset-panel">คืนค่าแผงนี้</button></div>
      <div class="grid">
        <label class="f"><span>ตระกูล</span><select data-p="cls" data-t="str">${(C.classes ?? []).map((x) => `<option value="${esc(x.id)}"${x.id === S.cls ? " selected" : ""}>${esc(x.th ?? x.id)}</option>`).join("")}</select></label>
        <label class="f"><span>โครงครอบครัว</span><select data-p="structure" data-t="str">${(C.structures ?? []).map((x) => `<option value="${esc(x.id)}"${x.id === S.structure ? " selected" : ""}>${esc(x.th)}</option>`).join("")}</select></label>
        <label class="f"><span>เส้นเอ็น</span><select data-p="sinew" data-t="str">${(C.sinews ?? []).map((x) => `<option value="${esc(x.id)}"${x.id === (S.sinew ?? "common") ? " selected" : ""}>${esc(x.th)}${x.life ? ` (อายุ ×${x.life})` : ""}</option>`).join("")}</select></label>
      </div><h3>รากปราณ</h3>${r.rev ? `<div class="grid"><label class="f"><span>รากวิญญาณย้อนกลับ · grade</span><input type="number" min="1" max="5" data-act="rev-grade" value="${r.rev.grade ?? 1}"></label><label class="f"><span>เปิดเผยแล้ว</span><select data-p="root.rev.shown" data-t="bool"><option value="true"${r.rev.shown ? " selected" : ""}>ใช่</option><option value="false"${!r.rev.shown ? " selected" : ""}>ยัง</option></select></label><label class="f"><span>ลบ</span><button type="button" class="btn sm danger" data-act="del-rev">ลบ root.rev</button></label></div>` : (r.type ? `<div><button class="btn sm" data-act="add-rev">+ เพิ่มรากวิญญาณย้อนกลับ</button></div>` : "")}
      <div class="grid">
        <label class="f"><span>ชนิด</span><select data-act="roottype"><option value="none"${!r.type ? " selected" : ""}>ไม่มีราก</option>${(C.create?.root ?? []).filter((x) => x.id !== "none").map((x) => `<option value="${x.id}"${r.type === x.id ? " selected" : ""}>${esc(x.th)}</option>`).join("")}</select></label>
        <label class="f"><span>ความบริสุทธิ์</span><input type="number" data-p="root.purity" data-t="int" min="0" max="100" value="${r.purity ?? 0}"></label>
        <label class="f"><span>รู้รากแล้ว</span><select data-p="root.known" data-t="bool"><option value="true"${r.known ? " selected" : ""}>รู้</option><option value="false"${!r.known ? " selected" : ""}>ไม่รู้</option></select></label>
      </div>${elems}
      <h3>พรสวรรค์ <span class="mute">(ดี ${ts.good}/${ts.goodCap} · เสีย ${ts.bad} · ข้ามสาย ${ts.cross})</span></h3>
      ${clashes.length ? `<div class="note bad">ขัดกัน: ${clashes.map(([a, b]) => `${TALENT.get(a)?.th ?? a} + ${TALENT.get(b)?.th ?? b}`).join(", ")}</div>` : ""}
      <label class="chip"><input type="checkbox" id="talfx" checked> ปรับสเตตัสตาม fx</label><div class="chips">${tal(true)}</div>
      <h3>ข้อเสีย</h3><div class="chips">${tal(false)}</div><h3>ข้ามสาย</h3><div class="chips">${cross}</div>
      <h3>ลักษณะซ่อนเร้น <span class="mute">(hidden traits)</span></h3>
      <div class="chips">${Object.entries(HIDDEN_TH).map(([hid, hth]) => `<label class="chip"><input type="checkbox" data-act="hidden" data-id="${hid}"${(S.hidden ?? []).includes(hid) ? " checked" : ""}>${esc(hth)} <small class="mute">${hid}</small></label>`).join("")}</div>
      <h3>ธงสถานะ</h3>
      <div class="chips">
        <label class="chip" title="ในเกม flag นี้ไม่เปลี่ยนรูปลักษณ์ — สีผิว/ตาเปลี่ยนเมื่อ S.realm >= 3 และ S.look.hairColor = red"><input type="checkbox" data-act="flag" data-k="demonic"${S.flags?.demonic ? " checked" : ""}>สายมาร (demonic)</label>
        <label class="chip"><input type="checkbox" data-act="flag" data-k="wanderer"${S.flags?.wanderer ? " checked" : ""}>พเนจร (wanderer)</label>
        <label class="chip"><input type="checkbox" data-act="flag" data-k="mentor"${S.flags?.mentor ? " checked" : ""}>มีอาจารย์ (mentor)</label>
        <label class="chip"><input type="checkbox" data-act="flag" data-k="transcended"${S.flags?.transcended ? " checked" : ""}>ข้ามสาย (transcended)</label>
      </div>
      <h3>นิกายลับ <span class="mute">(hidden sects)</span></h3>
      ${HIDDEN_SECTS.map((hid) => { const st = S.found?.[hid] ?? ""; return `<label class="f"><span>${esc(hid)}</span><select data-act="found" data-id="${hid}"><option value=""${!st ? " selected" : ""}>— ไม่พบ —</option><option value="seen"${st === "seen" ? " selected" : ""}>พบแล้ว</option><option value="open"${st === "open" ? " selected" : ""}>เปิดประตู</option><option value="closed"${st === "closed" ? " selected" : ""}>ถูกปฏิเสธ</option><option value="joined"${st === "joined" ? " selected" : ""}>เข้าร่วมแล้ว</option></select></label>`; }).join("")}`;
  }
  
function pStats() {
    const rows = Object.keys(STAT_TH).map((k) => `<div class="stat-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="width:60px;font-size:.85rem">${STAT_TH[k]}:</span><input type="number" min="1" max="9999" data-act="stat-num" data-k="${k}" value="${S.stats[k] ?? 50}" style="width:80px;padding:4px 8px;"><input type="range" min="1" max="${Math.max(999, S.stats[k] ?? 50)}" data-act="stat" data-k="${k}" value="${S.stats[k] ?? 50}" style="flex:1;"></div>`).join("");
    const per = Object.keys(S.personality ?? {}).map((k) => `<label class="f"><span>${AXIS_TH[k] ?? k}: <b>${Math.round(S.personality[k])}</b></span><input type="range" min="-50" max="50" data-p="personality.${k}" data-t="float" value="${Math.round(S.personality[k])}"></label>`).join("");
    return `<h2>สเตตัส</h2><div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn ghost sm" data-act="reset-panel">คืนค่าแผงนี้</button></div><div class="grid">${rows}</div><h3>นิสัย</h3><div class="grid">${per}</div>`;
  }

  function pLife() {
    const isAscended = S.ascended || (S.realm === IMMORTAL_IDX && S.death?.cause?.en === "ascended to immortality");
    return `<h2>ชีวิต</h2><div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn ghost sm" data-act="reset-panel">คืนค่าแผงนี้</button></div>
      <div class="grid"><label class="f"><span>สถานะ</span><select data-act="alive"><option value="true"${S.alive ? " selected" : ""}>มีชีวิต</option><option value="false"${!S.alive ? " selected" : ""}>เสียชีวิต</option></select></label>${isAscended ? `<label class="f"><span>บรรลุเซียน</span><select data-act="ascended"><option value="false"${!S.ascended ? " selected" : ""}>ไม่</option><option value="true"${S.ascended ? " selected" : ""}>ใช่</option></select></label>` : ""}</div>
      ${isAscended ? `<div class="note">ชีวิตนี้จบด้วยการบรรลุเซียน — ฟื้นกลับมาเป็นเซียนได้</div><p><button class="btn primary" data-act="revive-ascended">ฟื้นกลับมาเป็นเซียน</button></p>` : ""}
      <h3>สังกัด & เส้นทาง</h3>
      <div class="grid">
        <label class="f"><span>สำนัก (sect)</span><select data-act="set-sect"><option value=""${!S.sect ? " selected" : ""}>— ไม่มี —</option>${ALL_SECT_IDS.map((id) => `<option value="${id}"${S.sect === id ? " selected" : ""}>${esc(SECT_NAMES_TH[id] ?? id)}</option>`).join("")}</select></label>
        <label class="f"><span>เส้นทาง (path)</span><select data-act="set-path"><option value=""${!S.path ? " selected" : ""}>— ไม่ระบุ —</option><option value="cultivation"${S.path === "cultivation" ? " selected" : ""}>บำเพ็ญ (cultivation)</option><option value="martial"${S.path === "martial" ? " selected" : ""}>ยุทธ์ (martial)</option><option value="mortal"${S.path === "mortal" ? " selected" : ""}>คนธรรมดา (mortal)</option></select></label>
      </div>
      <h3>ยศ / ตำแหน่ง (ทางการ)</h3>
      <div class="grid">
        <label class="f"><span>วุฒิบัณฑิต</span><select data-act="set-degree"><option value=""${S.degree == null ? " selected" : ""}>— ไม่มี —</option>${DEGREES.map((d) => `<option value="${esc(d.id)}"${S.degree === d.id ? " selected" : ""}>${esc(d.th)}</option>`).join("")}</select></label>
        <label class="f"><span>ขุนนางขั้น</span><select data-act="set-office"><option value=""${S.office == null ? " selected" : ""}>— ไม่ได้เป็น —</option>${[9,8,7,6,5,4,3,2,1].map((g) => `<option value="${g}"${S.office === g ? " selected" : ""}>ขั้น ${g} · ${esc(GRADES[g]?.th ?? "")}</option>`).join("")}</select></label>
        <label class="f"><span>บรรดาศักดิ์</span><select data-act="set-ennobled"><option value=""${(S.ennobled ?? S.noble) == null ? " selected" : ""}>— ไม่มี —</option>${TITLES_NOBLE.map((t) => `<option value="${esc(t.id)}"${(S.ennobled ?? S.noble) === t.id ? " selected" : ""}>${esc(t.th)}</option>`).join("")}</select></label>
        <label class="f"><span>ยศทหาร</span><select data-act="set-army"><option value=""${(S.army ?? S.armyRank) == null ? " selected" : ""}>— ไม่ได้เป็น —</option>${ARMY.map((r) => `<option value="${esc(r.id)}"${(S.army ?? S.armyRank) === r.id ? " selected" : ""}>${esc(r.th)}</option>`).join("")}</select></label>
        <label class="f"><span>กุนซือ</span><select data-act="set-advisor"><option value=""${S.advisor == null ? " selected" : ""}>— ไม่ได้เป็น —</option>${ADVISORS.map((r) => `<option value="${esc(r.id)}"${S.advisor === r.id ? " selected" : ""}>${esc(r.th)}</option>`).join("")}</select></label>
        <label class="f"><span>ผลงาน</span><input type="number" data-act="set-merit" value="${S.merit ?? ""}" placeholder="—"></label>
      </div>`;
  }

  function pPlace() {
    const regions = ["village","city","capital","wilds","deep"];
    const towns = Object.entries(C.towns).filter(([, t]) => t.continent === PL.c);
    const fit = towns.filter(([, t]) => t.serves.includes(PL.r));
    const list = fit.length ? fit : towns;
    if (!list.some(([id]) => id === PL.t)) PL.t = list[0]?.[0] ?? "";
    const here = S.home ? `${C.towns[S.home.town]?.th ?? S.home.town}` : "ไม่ระบุ";
    return `<h2>พิกัดเกิด / ที่อยู่</h2><div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn ghost sm" data-act="reset-panel">คืนค่าแผงนี้</button></div>
      <div class="mute">ตอนนี้: <b>${esc(here)}</b></div>${S.sect ? `<div class="note bad">ตัวละครสังกัดสำนัก (${esc(S.sect)})</div>` : ""}
      <div class="grid">
        <label class="f"><span>ทวีป</span><select data-act="pl-c">${Object.entries(C.continents).map(([id, c]) => `<option value="${id}"${PL.c === id ? " selected" : ""}>${esc(c.th)}</option>`).join("")}</select></label>
        <label class="f"><span>แบบ</span><select data-act="pl-r">${regions.map((r) => `<option value="${r}"${PL.r === r ? " selected" : ""}>${esc(C.regions[r].th)}</option>`).join("")}</select></label>
        <label class="f"><span>เมือง</span><select data-act="pl-t">${list.map(([id, t]) => `<option value="${id}"${PL.t === id ? " selected" : ""}>${esc(t.th)}</option>`).join("")}</select></label>
      </div>
      <p><button class="btn primary" data-act="pl-apply">ตั้งเป็นบ้านเกิด</button></p>`;
  }

  // 🆕 v13.3 — renderNpcInfo: เพิ่มช่องพรสวรรค์ & ศักยภาพ (t/tr/pk/mr/role/sect)
  function renderNpcInfo(p, r) {
    const heroAge = S.ageMonths ?? 0, bornMonth = p.b ?? 0, deathMonth = p.d ?? null;
    const ageMonths = heroAge - bornMonth, alive = !p.dead && (deathMonth == null || heroAge < deathMonth);
    const bornY = splitMonths(bornMonth), deathY = deathMonth != null ? splitMonths(deathMonth) : null;
    const closeVal = r.c ?? 0, closeColor = closeVal >= 0 ? "var(--jade)" : "var(--red)";
    const note = NOTES.get(p.id) ?? "";
    const tagGroups = [
      { title: "ครอบครัว/คู่ครอง", tags: ["family", "spouse", "consort", "lover", "betrothed", "ex", "exSpouse"] },
      { title: "มิตรภาพ/สังคม", tags: ["companion", "sworn", "master", "student", "benefactor", "escort", "spirit"] },
      { title: "ศัตรู/การเมือง", tags: ["rival", "enemy", "watched"] },
    ];
    return npcSummaryHtml(p, r) + `<h4>ข้อมูลพื้นฐาน (แก้ไขได้)</h4><div class="grid">
        <label class="f"><span>ชื่อ (ไทย)</span><input type="text" data-npc="${p.id}" data-rk="nm.th" data-rt="str" value="${esc(p.nm?.th ?? "")}" placeholder="${esc(nameOf(p))}"></label>
        <label class="f"><span>ชื่อ (อังกฤษ)</span><input type="text" data-npc="${p.id}" data-rk="nm.en" data-rt="str" value="${esc(p.nm?.en ?? "")}"></label>
        <label class="f"><span>เพศ</span><select data-npc="${p.id}" data-rk="g" data-rt="str"><option value="m"${p.g === "m" ? " selected" : ""}>ชาย</option><option value="f"${p.g === "f" ? " selected" : ""}>หญิง</option></select></label>
        <label class="f"><span>สถานะ</span><select data-npc="${p.id}" data-rk="dead" data-rt="bool"><option value="false"${!p.dead ? " selected" : ""}>มีชีวิต</option><option value="true"${p.dead ? " selected" : ""}>ตายแล้ว</option></select></label>
        <label class="f"><span>สายเลือด (nat)</span><select data-npc="${p.id}" data-rk="nat" data-rt="str"><option value="">— ไม่มี —</option>${Object.entries(NAT_TH).map(([k, v]) => `<option value="${k}"${p.nat === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
        <label class="f"><span>เครื่องหมาย (mk)</span><select data-npc="${p.id}" data-rk="mk" data-rt="str"><option value="">— ไม่มี —</option>${Object.entries(MARK_TH).map(([k, v]) => `<option value="${k}"${p.mk === k ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
        <label class="f"><span>ผิว/ตา มาร (dm)</span><select data-npc="${p.id}" data-rk="dm" data-rt="str"><option value="">— ไม่มี —</option><option value="1"${p.dm === 1 ? " selected" : ""}>ผิวเทามาร (1)</option><option value="2"${p.dm === 2 ? " selected" : ""}>ลูกครึ่ง (2)</option><option value="3"${p.dm === 3 ? " selected" : ""}>ผิวแดงมาร (3)</option></select></label>
      </div>

      <h4>พรสวรรค์ & ศักยภาพ (แก้ได้)</h4>
      <div class="grid">
        <label class="f">
          <span>คะแนนพรสวรรค์ (0.35–4.5) <small class="mute">· ผลต่อความเร็วฝึก + เพดานขั้น</small></span>
          <input type="number" step="0.05" min="0.35" max="4.5" data-npc="${p.id}" data-rk="t" data-rt="float" value="${p.t ?? 1}">
        </label>
        <label class="f">
          <span>อุปนิสัย <small class="mute">· เปลี่ยนความขยัน</small></span>
          <select data-npc="${p.id}" data-rk="tr" data-rt="int">
            ${TRAITS_TH.map((t, i) => `<option value="${i}"${(p.tr ?? 0) === i ? " selected" : ""}>${esc(t)}</option>`).join("")}
          </select>
        </label>
        <label class="f">
          <span>เพดานขั้นผู้บำเพ็ญ (pk) <small class="mute">· 0 = ไม่เป็น</small></span>
          <select data-npc="${p.id}" data-rk="pk" data-rt="int">
            ${Array.from({length: 9}, (_, i) => `<option value="${i}"${(p.pk ?? 0) === i ? " selected" : ""}>${i === 0 ? "— ไม่เป็น —" : `${i} · ${esc(C.realms?.[i]?.th ?? `ขั้น ${i}`)}`}</option>`).join("")}
          </select>
        </label>
        <label class="f">
          <span>เพดานขั้นจอมยุทธ์ (mr) <small class="mute">· 0 = ไม่เป็น</small></span>
          <select data-npc="${p.id}" data-rk="mr" data-rt="int">
            ${Array.from({length: 7}, (_, i) => `<option value="${i}"${(p.mr ?? 0) === i ? " selected" : ""}>${i === 0 ? "— ไม่เป็น —" : `${i} · ${esc(C.martialRanks?.[i]?.th ?? `ขั้น ${i}`)}`}</option>`).join("")}
          </select>
        </label>
        <label class="f">
          <span>บทบาท (role)</span>
          <select data-npc="${p.id}" data-rk="role" data-rt="str">
            ${Object.entries(ROLES_MAP).map(([k, v]) => `<option value="${esc(k)}"${p.role === k ? " selected" : ""}>${esc(v)} (${esc(k)})</option>`).join("")}
          </select>
        </label>
        <label class="f">
          <span>สำนัก (sect)</span>
          <select data-npc="${p.id}" data-rk="sect" data-rt="str">
            <option value=""${!p.sect ? " selected" : ""}>— ไม่มี —</option>
            ${ALL_SECT_IDS.map((id) => `<option value="${esc(id)}"${p.sect === id ? " selected" : ""}>${esc(SECT_NAMES_TH[id] ?? id)}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="note" style="font-size:.8rem;margin-top:10px">
        ℹ️ <b>การเปลี่ยนมีผลทันที:</b> อุปกรณ์/วิชาที่เกมคำนวณ (<code>p.kit</code>) จะเปลี่ยนตามหลัง Save + เข้าเกม<br>
        ⚠️ การเปลี่ยน <code>pk</code>/<code>mr</code> ไม่ได้เปลี่ยน "ระดับปัจจุบัน" ตรงๆ — ระดับปัจจุบันคำนวณจาก <code>อายุ + t + pk/mr</code>
      </div>

      <h4>สถานะความสัมพันธ์ (ผลต่อเรื่องราว)</h4>
      <div class="chips" style="margin-bottom:16px;">
        <label class="chip"><input type="checkbox" data-act="rel-flag" data-id="${p.id}" data-flag="pine"${r.pine ? " checked" : ""}>แอบรักอยู่ห่างๆ</label>
        <label class="chip"><input type="checkbox" data-act="rel-flag" data-id="${p.id}" data-flag="tested"${r.tested ? " checked" : ""}>ผ่านบททดสอบมิตรภาพ</label>
        <label class="chip"><input type="checkbox" data-act="rel-flag" data-id="${p.id}" data-flag="close"${r.close ? " checked" : ""}>สนิทเกินขีด</label>
        <label class="chip"><input type="checkbox" data-act="rel-flag" data-id="${p.id}" data-flag="enemy"${r.tags?.includes("enemy") ? " checked" : ""}>เป็นศัตรู</label>
        <label class="chip"><input type="checkbox" data-act="rel-flag" data-id="${p.id}" data-flag="rival"${r.tags?.includes("rival") ? " checked" : ""}>เป็นคู่แข่ง</label>
      </div>

      <div class="npc-note-box">
        <div class="npc-gear-label" style="margin-bottom:6px;">📝 บันทึกส่วนตัว (เก็บในเครื่อง ไม่กระทบเซฟ)</div>
        <textarea data-act="npc-note" data-npc-id="${p.id}" placeholder="เขียนบันทึกของคุณ...">${esc(note)}</textarea>
      </div>

      <h4>วันเกิด / วันตาย</h4>
      <div class="grid">
        <div class="f"><span>เกิด</span><div class="pair"><label class="f"><input type="number" data-npc="${p.id}" data-rk="b-year" data-rt="pair-year" value="${bornY.y}"> ปี</label><label class="f"><input type="number" min="0" max="11" data-npc="${p.id}" data-rk="b-month" data-rt="pair-month" value="${bornY.mo}"> เดือน</label></div><div class="pair-hint">${fmtAbsMonths(bornMonth)} · อายุ ${fmtAge(ageMonths)}</div></div>
        <div class="f"><span>ตาย</span><div class="pair"><label class="f"><input type="number" data-npc="${p.id}" data-rk="d-year" data-rt="pair-year" value="${deathY?.y ?? ""}"> ปี</label><label class="f"><input type="number" min="0" max="11" data-npc="${p.id}" data-rk="d-month" data-rt="pair-month" value="${deathY?.mo ?? ""}"> เดือน</label></div><div class="pair-hint">${deathY ? fmtAbsMonths(deathMonth) : "ไม่ระบุ"}</div></div>
      </div>

      <h4>ความสนิทโดยรวม: <b style="color:${closeColor}">${closeVal > 0 ? "+" : ""}${closeVal}</b></h4>
      <div class="row" style="gap:12px"><input type="range" min="-100" max="100" value="${closeVal}" data-rel="${p.id}" data-rk="c" data-rt="int" style="flex:1"><input type="number" min="-100" max="100" value="${closeVal}" data-rel="${p.id}" data-rk="c" data-rt="int" style="width:80px"></div>
      <div class="slider-labels"><span>ศัตรู</span><span>เป็นกลาง</span><span>เพื่อน</span><span>สนิท</span></div>

      <h4>สถานะความสัมพันธ์ (Tags)</h4>
      ${tagGroups.map(g => {
        const active = g.tags.filter(t => (r.tags ?? []).includes(t));
        return `<div>
          <span class="tag-group-title">${g.title} ${active.length ? `(${active.length})` : ""}</span>
          <div class="chips">${g.tags.map(t => `<label class="chip"><input type="checkbox" data-act="rel-tag" data-id="${p.id}" data-tag="${t}"${(r.tags ?? []).includes(t) ? " checked" : ""}>${esc(tagTh(t))}</label>`).join("")}</div>
        </div>`;
      }).join("")}

      <h4>ค่าความสัมพันธ์เชิงลึก (ละเอียด)</h4>
      <div class="grid">
        <label class="f"><span>ความไว้ใจ <small class="mute">(-100 ถึง 100)</small></span><input type="number" min="-100" max="100" value="${r.tr ?? 0}" data-rel="${p.id}" data-rk="tr" data-rt="int"></label>
        <label class="f"><span>ความนับถือ <small class="mute">(-100 ถึง 100)</small></span><input type="number" min="-100" max="100" value="${r.rs ?? 0}" data-rel="${p.id}" data-rk="rs" data-rt="int"></label>
        <label class="f"><span>ความแค้น <small class="mute">(0 ถึง 3)</small></span><input type="number" min="0" max="3" value="${r.gr ?? 0}" data-rel="${p.id}" data-rk="gr" data-rt="int"></label>
        <label class="f"><span>บุญคุณ <small class="mute">(-100 ถึง 100)</small></span><input type="number" value="${r.fv ?? 0}" data-rel="${p.id}" data-rk="fv" data-rt="int"></label>
        <label class="f"><span>ความรัก <small class="mute">(0 ถึง 2.0)</small></span><input type="number" min="0" max="2" step="0.1" value="${r.ro ?? 0}" data-rel="${p.id}" data-rk="ro" data-rt="float"></label>
        <label class="f"><span>เริ่มมีใจ</span><select data-rel="${p.id}" data-rk="lit" data-rt="bool"><option value="true"${r.lit ? " selected" : ""}>เริ่มแล้ว</option><option value="false"${!r.lit ? " selected" : ""}>ยังไม่เริ่ม</option></select></label>
        <label class="f"><span>แต่งงานเมื่อ</span><input type="number" value="${r.wedAt ?? ""}" data-rel="${p.id}" data-rk="wedAt" data-rt="int-or-null" placeholder="ไม่ระบุ"><small class="pair-hint">${r.wedAt != null ? fmtAbsMonths(r.wedAt) : ""}</small></label>
        <label class="f"><span>เลิกรักเมื่อ</span><input type="number" value="${r.exAt ?? ""}" data-rel="${p.id}" data-rk="exAt" data-rt="int-or-null" placeholder="ไม่ระบุ"><small class="pair-hint">${r.exAt != null ? fmtAbsMonths(r.exAt) : ""}</small></label>
      </div>`;
  }

  function renderNpcStats(p) {
    const isDerived = !p.stats, stats = npcStatsOf(p);
    const note = isDerived ? `<div class="note">ค่าประมาณการจาก Realm/Rank/Talent</div>` : `<div class="note bad">ค่าที่กำหนดเองในเซฟ</div>`;
    const resetBtn = !isDerived ? `<div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn sm ghost" data-act="npc-stats-reset" data-npc-id="${p.id}">คืนค่าประมาณการ</button></div>` : "";
    const rows = Object.keys(STAT_TH).map((k) => `<div class="stat-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="width:60px;font-size:.85rem">${STAT_TH[k]}:</span><input type="number" min="1" max="9999" data-act="npc-stat-num" data-npc="${p.id}" data-k="${k}" value="${stats[k] ?? 50}" style="width:80px;padding:4px 8px;"><input type="range" min="1" max="${Math.max(800, stats[k] ?? 50)}" data-npc="${p.id}" data-rk="stats.${k}" data-rt="int" value="${stats[k] ?? 50}" style="flex:1;"></div>`).join("");
    return note + resetBtn + `<div class="grid">${rows}</div>`;
  }

  // 🆕 v13.3 — renderNpcGear: อ่านจาก p.kit
  function renderNpcGear(p) {
    const kit = readNpcKit(p);
    if (kit) {
      const lvl = parseKitLevel(kit.level);
      const gearRows = KIT_GEAR_SLOTS.map((slot) => {
        const id = kit.gear[slot];
        if (!id) return `<tr><td>${esc(SLOT_TH[slot] ?? slot)}</td><td class="mute">— ว่าง —</td></tr>`;
        const baseId = id.includes("~") ? id.split("~")[0] : id;
        const grade = id.includes("~") ? Number(id.split("~")[1]) : 1;
        const x = ITEM.get(baseId);
        const tc = x ? TIER_CLASS(x.tier) : "";
        const gText = grade !== 1 ? ` · เกรด${GRADES_TH[grade] ?? grade}` : "";
        return `<tr><td>${esc(SLOT_TH[slot] ?? slot)}</td><td class="${tc}">${esc(x ? iLabel(x) : baseId)}<span class="mute">${esc(gText)}</span><div class="mute" style="font-size:.72rem;font-family:ui-monospace,monospace">${esc(id)}</div></td></tr>`;
      }).join("");
      const artsRows = KIT_ART_SLOTS.map((slot) => {
        const a = kit.arts[slot];
        if (!a) return `<tr><td>${esc(ART_SLOT_TH[slot] ?? slot)}</td><td class="mute">— ว่าง —</td></tr>`;
        const x = TECH.get(a.id);
        const tc = x ? TIER_CLASS(x.tier) : "";
        const mTier = masteryTierOf(a.mastery);
        return `<tr><td>${esc(ART_SLOT_TH[slot] ?? slot)}</td><td class="${tc}">${esc(x ? iLabel(x) : a.id)}<div class="mute" style="font-size:.72rem">ความชำนาญ: ${esc(MASTERY_TH[mTier])} (${a.mastery})</div><div class="mute" style="font-size:.72rem;font-family:ui-monospace,monospace">${esc(a.id)}</div></td></tr>`;
      }).join("");
      return `<div class="note">🔎 <b>ชุดของ NPC</b> — อ่านจาก <code>p.kit</code> ตามที่เกมคำนวณไว้${lvl ? ` · ระดับ: <b>${esc(lvl.label)}</b>` : ""}</div>
        <h4 style="margin-top:16px">⚔ อุปกรณ์สวมใส่</h4>
        <table class="bag-table"><thead><tr><th style="width:120px">ช่อง</th><th>ไอเทม</th></tr></thead><tbody>${gearRows}</tbody></table>
        <h4 style="margin-top:20px">📖 วิชาที่ใช้</h4>
        <table class="bag-table"><thead><tr><th style="width:120px">ช่อง</th><th>วิชา</th></tr></thead><tbody>${artsRows}</tbody></table>
        <div class="note" style="margin-top:16px;font-size:.8rem">ℹ️ ข้อมูลนี้ <b>แสดงเพื่อดูเท่านั้น</b> — เกมสร้างชุด NPC จากสูตร (<code>src/npc-kit.js</code>) ไม่สามารถแก้ไขในเซฟโดยตรงได้</div>`;
    }

    // ยังไม่มี p.kit → อธิบายตามสถานะ
    const inRel = !!(S?.world?.rel?.[p.id]);
    const isAdult = (S?.ageMonths ?? 0) - (p.b ?? 0) >= 12 * 12;
    const isBeast = p.kind === "beast";
    const isGhost = !!p.ghost;

    if (!inRel) {
      return `<div class="note bad" style="border-left-color:var(--warn)">🔒 <b>NPC นี้ไม่มีข้อมูลอุปกรณ์ในเกม</b></div>
        <div class="mute" style="margin-top:10px;font-size:.82rem;line-height:1.8">
          เกมสร้างชุดอุปกรณ์เฉพาะ NPC ที่ <b>อยู่ใน "ความสัมพันธ์" (rel)</b> ของตัวละครหลัก
          — NPC ทั่วไปที่ยังไม่รู้จักจะไม่มีข้อมูลนี้ (ตาม <code>src/npc-kit.js</code>: <code>kitFor()</code> ต้องมี <code>S.world.rel[id]</code>)<br><br>
          💡 <b>วิธีทำให้มี:</b> ในเกม ไปคุยกับ NPC คนนี้ให้กลายเป็นคนรู้จักก่อน แล้วค่อยเปิดดูในหน้า People — ระบบจะสร้างชุดอุปกรณ์ให้อัตโนมัติ
        </div>`;
    }
    if (isBeast) return `<div class="note">🐾 <b>NPC นี้เป็นสัตว์อสูร</b> — ไม่มีระบบอุปกรณ์/วิชาแบบมนุษย์</div>`;
    if (isGhost) return `<div class="note">👻 <b>NPC นี้เป็นวิญญาณ</b> — ไม่มีระบบอุปกรณ์/วิชาแบบคนเป็น</div>`;
    if (!isAdult) return `<div class="note">👶 <b>NPC นี้ยังเด็กเกินไป</b> (อายุ &lt; 12 ปี) — เกมจะยังไม่สร้างชุดอุปกรณ์ให้</div>`;

    return `<div class="note" style="border-left-color:var(--gold)">⏳ <b>NPC คนนี้อยู่ในความสัมพันธ์แล้ว แต่ยังไม่มีข้อมูลอุปกรณ์ในเซฟ</b></div>
      <div class="mute" style="margin-top:10px;font-size:.82rem;line-height:1.8">
        เกมสร้างชุดอุปกรณ์ของ NPC แบบ <b>on-demand</b> — จะสร้างให้ก็ต่อเมื่อ:<br>
        &nbsp;&nbsp;• เปิดดู NPC คนนี้ในหน้า People ของเกม 1 ครั้ง, <b>หรือ</b><br>
        &nbsp;&nbsp;• ต่อสู้กับ NPC คนนี้, <b>หรือ</b><br>
        &nbsp;&nbsp;• ขอเรียนวิชาจาก NPC คนนี้<br><br>
        💡 <b>วิธีแก้:</b> ในเกม เปิดดู <b>${esc(p.nm?.th ?? nameOf(p))}</b> ที่หน้า People → ปิด → Save เกม → เอาไฟล์ใหม่มาเปิดที่นี่อีกครั้ง <code>p.kit</code> จะปรากฏครบทันที
      </div>`;
  }

  // 🆕 v13.3 — renderNpcTalents: แสดงค่าจริงจาก p.t/p.tr/p.pk/p.mr
  function renderNpcTalents(p) {
    const tScore = p.t ?? 1;
    const trIdx = p.tr ?? 0;
    const pk = p.pk ?? 0;
    const mr = p.mr ?? 0;
    const lc = p.lc ?? 0, lm = p.lm ?? 0;
    const npcAge = NpcPreview.faceAgeOf(p, S?.ageMonths ?? 0);
    const wu = npcWuOf(p), dil = npcDilOf(p);
    const talentTh = npcTalentTh(tScore);
    const temperTh = TRAITS_TH[trIdx] ?? "?";
    const wuTh = npcWuTh(wu);
    const dilTh = npcDilTh(dil);
    const rootLabel = npcRootLabel(p);
    const curLabel = npcCurLabel(p, npcAge);
    const peakLabel = npcPeakLabel(p);
    const isCultivator = pk > 0;
    const isMartial = !isCultivator && mr > 0;

    return `<div class="note">
      <b>พรสวรรค์ & ศักยภาพ</b> — NPC ไม่มีรายการ checkbox พรสวรรค์แบบตัวละครหลัก
      แต่ใช้ <b>คะแนนพรสวรรค์</b> + <b>อุปนิสัย</b> + <b>เพดานขั้น</b> เป็นตัวกำหนด
      ความเร็วและขีดจำกัดการฝึก (ตาม <code>src/growth.js</code> / <code>src/world.js</code>)
    </div>

    <div class="grid" style="margin-top:16px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
      <div class="card" style="padding:12px">
        <div class="mute" style="font-size:.74rem;text-transform:uppercase;letter-spacing:.05em">คะแนนพรสวรรค์</div>
        <div style="font-size:1.2rem;font-weight:700;color:var(--gold);margin-top:2px">${esc(talentTh)}</div>
        <div class="mute" style="font-size:.72rem">${tScore.toFixed(2)}</div>
      </div>
      <div class="card" style="padding:12px">
        <div class="mute" style="font-size:.74rem;text-transform:uppercase;letter-spacing:.05em">อุปนิสัย</div>
        <div style="font-size:1.2rem;font-weight:700;color:var(--gold);margin-top:2px">${esc(temperTh)}</div>
        <div class="mute" style="font-size:.72rem">index ${trIdx}</div>
      </div>
      <div class="card" style="padding:12px">
        <div class="mute" style="font-size:.74rem;text-transform:uppercase;letter-spacing:.05em">ความเข้าใจ</div>
        <div style="font-size:1.2rem;font-weight:700;color:var(--gold);margin-top:2px">${esc(wuTh)}</div>
        <div class="mute" style="font-size:.72rem">×${wu.toFixed(2)}</div>
      </div>
      <div class="card" style="padding:12px">
        <div class="mute" style="font-size:.74rem;text-transform:uppercase;letter-spacing:.05em">ความขยัน</div>
        <div style="font-size:1.2rem;font-weight:700;color:var(--gold);margin-top:2px">${esc(dilTh)}</div>
        <div class="mute" style="font-size:.72rem">×${dil.toFixed(2)}</div>
      </div>
    </div>

    <h4 style="margin-top:20px">เส้นทางการฝึก</h4>
    <dl class="pv-grid" style="grid-template-columns:140px 1fr;gap:6px 14px">
      <dt>ปัจจุบัน</dt><dd><b>${esc(curLabel)}</b></dd>
      <dt>เพดานสูงสุด</dt><dd><b style="color:var(--gold)">${esc(peakLabel)}</b></dd>
      ${isCultivator && rootLabel ? `<dt>รากปราณ</dt><dd>${esc(rootLabel)}</dd>` : ""}
      ${lc ? `<dt>ขั้นจาก hero</dt><dd>+${lc} ขั้น (ผู้บำเพ็ญ)</dd>` : ""}
      ${lm ? `<dt>ขั้นจาก hero</dt><dd>+${lm} ขั้น (จอมยุทธ์)</dd>` : ""}
      <dt>อายุNPC</dt><dd>${npcAge.toFixed(1)} ปี${!isCultivator && !isMartial ? " (คนธรรมดา)" : ""}</dd>
    </dl>

    <div class="note" style="margin-top:16px;font-size:.8rem">
      ℹ️ <b>ทำไม NPC ถึงไม่มี checkbox พรสวรรค์?</b><br>
      ในเกม NPC ทุกคนถูกสร้างจากสูตร (<code>src/growth.js</code> + <code>src/people.js</code>) ไม่มีระบบ <code>p.talents[]</code> แบบตัวเอก
      — ค่าที่เห็นทั้งหมดนี้ <b>คำนวณซ้ำได้เสมอ</b> จาก <code>p.id</code>, <code>p.t</code>, <code>p.tr</code>, <code>p.pk</code>, <code>p.mr</code> ที่บันทึกไว้ในเซฟ
    </div>`;
  }

  function npcSkillKey(p) { return p.techs !== undefined ? "techs" : p.arts !== undefined ? "arts" : p.skills !== undefined ? "skills" : "techs"; }
  function npcSkillView(p) { const v = p[npcSkillKey(p)]; return Array.isArray(v) ? Object.fromEntries(v.map((id) => [id, 1])) : (v ?? {}); }
  function npcSkillsObj(p) { const k = npcSkillKey(p); if (!p[k] || Array.isArray(p[k])) p[k] = npcSkillView(p); return p[k]; }

  // 🆕 v13.3 — npcSummaryHtml: อ่านค่าจริงจาก p.t/p.tr/p.pk/p.mr
  function npcSummaryHtml(p, r) {
    const npcAge = NpcPreview.faceAgeOf(p, S.ageMonths);
    const tScore = p.t ?? 1;
    const trIdx  = p.tr ?? 0;
    const pk     = p.pk ?? 0;
    const mr     = p.mr ?? 0;
    const talentTh = npcTalentTh(tScore);
    const temperTh = TRAITS_TH[trIdx] ?? "?";
    const wu = npcWuOf(p), wuTh = npcWuTh(wu);
    const dil = npcDilOf(p), dilTh = npcDilTh(dil);
    const isCultivator = pk > 0;
    const isMartial    = !isCultivator && mr > 0;
    const curLabel = npcCurLabel(p, npcAge);
    const peakLabel = npcPeakLabel(p);
    const rootLabel = npcRootLabel(p);
    const heroAge = S.ageMonths ?? 0;
    const alive = !p.dead && (p.d == null || heroAge < p.d);
    const ageMonths = heroAge - (p.b ?? 0);
    const isSpouse = (r.tags ?? []).includes("spouse") || S.spouseId === p.id;
    const hiddenList = (p.hidden ?? []).length
      ? p.hidden.map((h) => esc(HIDDEN_TH[h] ?? h)).join(", ")
      : null;

    return `<div style="margin-bottom:16px;background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:14px;">
      <h3 style="margin-top:0;color:var(--gold);border-bottom:1px dashed var(--line);padding-bottom:8px;font-size:1rem;">รายละเอียด</h3>
      <dl class="pv-grid" style="grid-template-columns:130px 1fr;gap:5px 14px;font-size:.9rem;">
        <dt>สถานะ</dt><dd>${alive ? "ยังมีชีวิต" : "เสียชีวิต"}</dd>
        <dt>อายุ</dt><dd>${fmtAge(ageMonths)}</dd>
        <dt>เพศ</dt><dd>${p.g === "f" ? "หญิง" : "ชาย"}</dd>
        <dt>สังกัด</dt><dd>${esc(roleTh(p.role))}${p.sect ? ` · ${esc(SECT_NAMES_TH[p.sect] ?? p.sect)}` : ""}</dd>

        <dt style="color:var(--gold2);margin-top:8px;">พรสวรรค์</dt><dd style="color:var(--gold2);margin-top:8px;"><b>${esc(talentTh)}</b> <small class="mute">(${tScore.toFixed(2)})</small></dd>
        <dt>ความเข้าใจ</dt><dd>${esc(wuTh)} <small class="mute">×${wu.toFixed(2)}</small></dd>
        <dt>ความขยัน</dt><dd>${esc(dilTh)} <small class="mute">×${dil.toFixed(2)}</small></dd>
        <dt>อุปนิสัย</dt><dd>${esc(temperTh)}</dd>

        <dt style="margin-top:8px;">เส้นทาง</dt><dd style="margin-top:8px;">${esc(curLabel)}</dd>
        <dt>เพดานสูงสุด</dt><dd><b style="color:var(--gold)">${esc(peakLabel)}</b></dd>
        ${isCultivator && rootLabel ? `<dt>รากปราณ</dt><dd>${esc(rootLabel)}</dd>` : ""}
        ${isSpouse ? `<dt>สถานะ</dt><dd><span class="chip-mini gold">คู่ครองของตัวเอก</span></dd>` : ""}
        ${hiddenList ? `<dt>ลักษณะซ่อน</dt><dd>${hiddenList}</dd>` : ""}
      </dl>
    </div>`;
  }

  function renderNpcLooks(p) {
    const C = window.WOX_CATALOG, P = window.WoxPreview;
    if (!P) return `<div class="note bad">โหลด WoxPreview ไม่สำเร็จ</div>`;
    const L = C.looks ?? {};
    const look = getNpcLook(p);
    const isOverridden = LOOK_OVERRIDES.has(p.id);
    const fem = !!look.female;
    const hairSpecs = (fem ? P.HAIR_SPECS_F : P.HAIR_SPECS_M) ?? [];
    const hairNames = (fem ? L.hairF : L.hairM) ?? [];
    const hIdx = hairSpecs.findIndex((h) => JSON.stringify(h) === JSON.stringify(look.hair));
    const hairLabel = hIdx >= 0 ? `${esc(hairNames[hIdx]?.th ?? "ทรงที่ " + (hIdx + 1))} (${hIdx + 1}/${hairSpecs.length})` : "—";
    const hcEntry = Object.entries(L.hairColors ?? {}).find(([id, hex]) => id === look.hairColor || hex === look.hairColor);
    const hcSwatch = hcEntry ? hcEntry[1] : (look.hairColor || "#2b2222");
    const hcLabel = hcEntry ? (HAIR_COL_TH[hcEntry[0]] ?? hcEntry[0]) : (look.hairColor ?? "—");
    const skinList = L.skins ?? [], sIdx = skinList.indexOf(look.skin);
    const rows = [
      ["gender", "เพศ", fem ? "หญิง" : "ชาย", null],
      ["hair", "ทรงผม", hairLabel, null],
      ["hairColor", "สีผม", esc(hcLabel), hcSwatch],
      ["skin", "สีผิว", sIdx >= 0 ? `เฉด ${sIdx + 1}/${skinList.length}` : "—", look.skin],
      ["eyes", "รูปตา", esc(EYE_SH_TH[look.eyes] ?? look.eyes ?? "—"), null],
      ["eyeColor", "สีตา", esc(EYE_COL_TH[look.eyeColor] ?? look.eyeColor ?? "—"), null],
      ["mouth", "ปาก", esc(MOUTH_TH[look.mouth] ?? look.mouth ?? "—"), null],
    ].map(([k, label, val, sw]) => `<div class="opt"><span>${label}</span><button type="button" class="btn sm" data-act="npc-look-step" data-id="${p.id}" data-k="${k}" data-d="-1">◀</button><span class="opt-v">${sw ? `<i class="swatch" style="background:${esc(sw)}"></i>` : ""}${val}</span><button type="button" class="btn sm" data-act="npc-look-step" data-id="${p.id}" data-k="${k}" data-d="1">▶</button><span class="opt-n"></span></div>`).join("");
    return `<div class="note${isOverridden ? " bad" : ""}">${isOverridden ? "⚠️ รูปลักษณ์ NPC นี้ถูกแก้ไขแล้ว (เก็บในเบราว์เซอร์ ไม่กระทบไฟล์เซฟ)" : "ℹ️ ใช้รูปลักษณ์ตามที่เกมสุ่มมา"}</div>${isOverridden ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="npc-look-reset" data-id="${p.id}">คืนค่ารูปลักษณ์เดิมจากเกม</button></div>` : ""}<div class="look-box"><div class="look-stage"><div id="look-canvas"></div></div><div class="opts">${rows}</div></div>`;
  }

  function stepNpcLook(pid, k, dir) {
    const p = npcOf(pid); if (!p) return;
    const C = window.WOX_CATALOG, P = window.WoxPreview ?? {}, L = C.looks ?? {};
    const look = clone(LOOK_OVERRIDES.get(pid) || getNpcLook(p));
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const cycle = (list, cur, d) => { if (!list.length) return cur; let i = list.findIndex((v) => same(v, cur)); if (i < 0) i = 0; return list[(i + d + list.length) % list.length]; };
    if (k === "gender") { look.female = !look.female; look.hair = ((look.female ? P.HAIR_SPECS_F : P.HAIR_SPECS_M) ?? [])[0] ?? look.hair; }
    else if (k === "hair") { const specs = (look.female ? P.HAIR_SPECS_F : P.HAIR_SPECS_M) ?? []; look.hair = cycle(specs, look.hair, dir); }
    else if (k === "hairColor") { const ids = Object.entries(L.hairColors ?? {}); if (ids.length) { let i = ids.findIndex(([id, h]) => id === look.hairColor || h === look.hairColor); if (i < 0) i = 0; look.hairColor = ids[(i + dir + ids.length) % ids.length][1]; } }
    else if (k === "skin") look.skin = cycle(L.skins ?? [], look.skin, dir);
    else if (k === "eyes") look.eyes = cycle(L.eyeShapes ?? [], look.eyes, dir);
    else if (k === "eyeColor") look.eyeColor = cycle(L.eyeColors ?? [], look.eyeColor, dir);
    else if (k === "mouth") look.mouth = cycle(C.create?.mouths ?? ["calm"], look.mouth, dir);
    else return;
    LOOK_OVERRIDES.set(pid, look);
    persistMeta();
  }

  function renderRelEditor(id, p, r) {
    if (!p) return `<p class="mute">ไม่พบ NPC #${id}</p>`;
    const heroAge = S.ageMonths ?? 0, bornMonth = p.b ?? 0, deathMonth = p.d ?? null;
    const ageMonths = heroAge - bornMonth, alive = !p.dead && (deathMonth == null || heroAge < deathMonth);
    const isSpouse = (r.tags ?? []).includes("spouse") || S.spouseId === id, isBookmarked = BOOKMARKS.has(p.id);
    let body = '';
    if (NPC_TAB === 'info') body = renderNpcInfo(p, r);
    else if (NPC_TAB === 'stats') body = renderNpcStats(p);
    else if (NPC_TAB === 'gear') body = renderNpcGear(p);
    else if (NPC_TAB === 'talents') body = renderNpcTalents(p);
    else if (NPC_TAB === 'looks') body = renderNpcLooks(p);
    return `<div class="rel-editor-top">
      <div class="rel-editor-head">
        <div class="rel-head-main">
          <div class="rel-head-thumb">${renderNpcThumb(p, 64)}</div>
          <div class="rel-head-text">
            <h3>${esc(nameOf(p))} <button class="star-btn${isBookmarked ? " on" : ""}" data-act="toggle-bookmark" data-id="${id}" title="${isBookmarked ? "ยกเลิกบุ๊กมาร์ก" : "บุ๊กมาร์ก"}" aria-label="${isBookmarked ? "ยกเลิกบุ๊กมาร์ก" : "บุ๊กมาร์ก"}">${isBookmarked ? "★" : "☆"}</button></h3>
            <div class="rel-head-meta">
              <span class="chip-mini">${esc(roleTh(p.role))}</span>
              ${p.sect ? `<span class="chip-mini">${esc(p.sect)}</span>` : ""}
              <span class="chip-mini${alive ? "" : " dead"}">${alive ? `อายุ ${fmtAge(ageMonths)}` : "เสียชีวิตแล้ว"}</span>
              ${isSpouse ? `<span class="chip-mini gold">คู่ครอง</span>` : ""}
            </div>
          </div>
        </div>
        <button class="btn sm danger-ghost" data-act="del-rel" data-id="${id}">ลบความสัมพันธ์</button>
      </div>
      <div class="rel-sub-tabs" role="tablist" aria-label="หมวดข้อมูล NPC">
        ${[["info", "ข้อมูล"], ["stats", "สเตตัส"], ["gear", "อุปกรณ์ & วิชา"], ["talents", "พรสวรรค์"], ["looks", "รูปลักษณ์"]].map(([s, t]) => `<button class="rel-sub-tab" role="tab" data-act="npc-sub-tab" data-sub="${s}" aria-selected="${NPC_TAB === s}">${t}</button>`).join("")}
      </div>
    </div>
    <div class="rel-editor-body">${body}</div>`;
  }

  function renderBulkToolbar() {
    if (SELECTED_MULTI.size === 0) return "";
    return `<div class="bulk-toolbar-npc"><span class="count">${SELECTED_MULTI.size} เลือกไว้</span><button class="btn sm" data-act="bulk-tag-add">+ เพิ่ม tag</button><button class="btn sm" data-act="bulk-tag-rm">− ลบ tag</button><button class="btn sm" data-act="bulk-set-c">ตั้งค่าความสนิท</button><button class="btn sm ghost" data-act="bulk-del">ลบทั้งหมด</button><button class="btn sm ghost" data-act="bulk-clear">ยกเลิก</button></div>`;
  }

  function pRel() {
    const rel = S.world?.rel ?? {}, people = S.world?.people ?? [], byId = new Map(people.map((p) => [p.id, p]));
    const entries = Object.entries(rel).map(([id, r]) => { const p = byId.get(Number(id)); return p ? { id: Number(id), p, r } : null; }).filter(Boolean);
    const q = FILTER.relQ.toLowerCase();
    const filtered = entries.filter(({ p, r }) => {
      if (q) { const hay = `${nameOf(p)} ${p.nm?.en ?? ""} ${p.id} ${roleTh(p.role)} ${p.sect ?? ""}`.toLowerCase(); if (!hay.includes(q)) return false; }
      if (FILTER.relTag && !(r.tags ?? []).includes(FILTER.relTag)) return false;
      return true;
    }).sort((a, b) => { const bmA = BOOKMARKS.has(a.p.id) ? 1 : 0, bmB = BOOKMARKS.has(b.p.id) ? 1 : 0; if (bmA !== bmB) return bmB - bmA; return Math.abs(b.r.c ?? 0) - Math.abs(a.r.c ?? 0); });
    const tagOpts = REL_TAGS.map((t) => `<option value="${t}"${FILTER.relTag === t ? " selected" : ""}>${esc(tagTh(t))}</option>`).join("");
    const items = filtered.map(({ id, p, r }) => {
      const c = r.c ?? 0, cCls = c >= 60 ? "tier5" : c >= 25 ? "tier2" : c <= -50 ? "tier4" : c < 0 ? "tier3" : "";
      const tShort = (r.tags ?? []).slice(0, 2).map(tagTh).join(", "), isBk = BOOKMARKS.has(id), hasNote = NOTES.has(id);
      const origP = ORIG?.world?.people?.find((x) => x.id === id);
      const origR = ORIG?.world?.rel?.[id];
      // ← v13.4: rename isDirty → hasChanges (ไม่ให้ shadow module-level isDirty())
      const hasChanges = (JSON.stringify(p) !== JSON.stringify(origP)) || (JSON.stringify(r) !== JSON.stringify(origR));
      return `<div class="rel-item${SELECTED_REL === id ? " active" : ""}" data-act="select-rel" data-id="${id}">
        <input type="checkbox" class="bulk-check" data-act="bulk-toggle" data-id="${id}"${SELECTED_MULTI.has(id) ? " checked" : ""} onclick="event.stopPropagation()" aria-label="เลือก ${esc(nameOf(p))}">
        <div class="rel-thumb">${renderNpcThumb(p, 44)}</div>
        <div class="rel-info">
          <div class="rel-name-row">${isBk ? '<span class="star-btn on" aria-label="บุ๊กมาร์ก">★</span>' : ""}<span class="rel-name">${esc(nameOf(p))}</span>${hasNote ? '<span class="note-ind" title="มีบันทึก">📝</span>' : ""}${hasChanges ? '<span class="unsaved-dot" title="มีการแก้ไขที่ยังไม่บันทึก"></span>' : ""}</div>
          <div class="rel-meta"><span class="rel-affinity ${cCls}">❤️ ${c > 0 ? "+" : ""}${c}</span>${tShort ? ` · ${esc(tShort)}${(r.tags ?? []).length > 2 ? "…" : ""}` : ""}</div>
        </div>
        <span class="rel-aff"><i class="${c < 0 ? "neg" : ""}" style="--aff:${(c + 100) / 2}%"></i></span>
      </div>`;
    }).join("");
    return `<div class="rel-page-head"><h2>ความสัมพันธ์<span class="count-chip">${entries.length}</span></h2></div>
      <div class="rel-toolbar">
        <input type="text" id="rel-q" class="rel-search" placeholder="🔍 ค้นหาชื่อ บทบาท หรือ id" value="${esc(FILTER.relQ)}" aria-label="ค้นหา NPC">
        <select id="rel-tag" aria-label="กรองตามสถานะ"><option value="">— ทุกสถานะ —</option>${tagOpts}</select>
        <button class="btn primary" data-act="add-rel">+ เพิ่ม NPC</button>
      </div>
      ${renderBulkToolbar()}
      <div class="rel-layout">
        <div class="rel-list">
          <div class="rel-list-head"><span>${filtered.length === entries.length ? `${entries.length} คน` : `แสดง ${filtered.length} จาก ${entries.length} คน`}</span><span>★ ก่อน · ความสนิท</span></div>
          ${items || `<div class="rel-empty-list">ไม่มี NPC ที่ตรงเงื่อนไข</div>`}
        </div>
        <div class="rel-editor">${SELECTED_REL !== null && relOf(SELECTED_REL) ? renderRelEditor(SELECTED_REL, npcOf(SELECTED_REL), relOf(SELECTED_REL)) : `<div class="rel-placeholder"><div class="rel-placeholder-icon" aria-hidden="true">🤝</div><p>เลือก NPC จากรายการด้านซ้าย<br>เพื่อดูและแก้ไขความสัมพันธ์</p></div>`}</div>
      </div>`;
  }
  const matchStr = (x, q) => { if (!q) return true; const l = q.toLowerCase(); return (x.id ?? "").toLowerCase().includes(l) || (x.th ?? "").toLowerCase().includes(l) || (x.en ?? "").toLowerCase().includes(l); };

  function pGear() {
    initGear();
    const tabs = `<div class="gear-sub-tabs"><button class="gear-sub-tab" data-act="gear-sub-tab" data-sub="items" aria-selected="${GEAR_TAB === 'items'}">🎒 ของในกระเป๋า</button><button class="gear-sub-tab" data-act="gear-sub-tab" data-sub="arts" aria-selected="${GEAR_TAB === 'arts'}">📖 วิชา & ช่องติดตั้ง</button></div>`;
    if (GEAR_TAB === "items") {
      const eq = SLOTS.map((slot) => {
        const list = C.items.filter((x) => x.slot === slotKind(slot)).sort((a, b) => b.tier - a.tier);
        const cur = S.equip[slot] ?? "", curItem = ITEM.get(cur);
        return `<label class="f"><span>${SLOT_TH[slot] ?? slot} ${curItem ? `<small class="${TIER_CLASS(curItem.tier)}">· ${TIER_TH(curItem.tier)}</small>` : ""}</span><select data-act="equip" data-slot="${slot}"><option value="">— ไม่สวม —</option>${list.map((x) => `<option value="${esc(x.id)}" data-tier="${x.tier}"${x.id === cur ? " selected" : ""}>${esc(iLabel(x))}</option>`).join("")}<option value="__auto">ให้เกมเลือกอัตโนมัติ</option></select></label>`;
      }).join("");
      const bagEntries = Object.entries(S.bag ?? {}).filter(([, n]) => n > 0).sort((a, b) => (ITEM.get(b[0])?.tier ?? -1) - (ITEM.get(a[0])?.tier ?? -1));
      const bagRows = bagEntries.map(([id, n]) => { const x = ITEM.get(id), isEq = SLOTS.some(s => S.equip[s] === id); return `<tr class="${isEq ? 'is-equipped' : ''}"><td><input type="checkbox" class="bag-check" data-id="${esc(id)}"></td><td class="${x ? TIER_CLASS(x.tier) : ''}"><span class="item-id-tip" data-id="${esc(id)}">${esc(x ? iLabel(x) : id)}</span></td><td><input type="number" min="0" data-act="bagn" data-id="${esc(id)}" value="${n}" style="width:80px"></td><td style="width:40px;"><button class="btn sm danger-ghost" data-act="bagdel" data-id="${esc(id)}" title="ลบไอเทม">×</button></td></tr>`; }).join("");
      const bagMatches = C.items.filter((x) => matchStr(x, FILTER.bag) && (!FILTER.bagTier || String(x.tier) === FILTER.bagTier) && (!FILTER.bagSlot || x.slot === FILTER.bagSlot)).slice(0, 100);
      return `${tabs}<div class="row" style="justify-content:flex-end;margin-bottom:12px"><button class="btn ghost sm" data-act="reset-panel">คืนค่าแผงนี้</button></div>
        <h3>ช่องสวมใส่</h3><div class="grid" style="margin-bottom:24px">${eq}</div>
        <h3>กระเป๋า (${bagEntries.length})</h3>
        <div class="filter-bar"><label><span>ค้นหาไอเทม</span><input type="text" id="bag-q" placeholder="พิมพ์ชื่อ หรือ ID..." value="${esc(FILTER.bag)}"></label><label style="flex:0 1 140px"><span>กรองขั้น</span><select id="bag-tier"><option value="">ทั้งหมด</option>${(C.tiers ?? []).map((t, i) => `<option value="${i}"${String(i) === String(FILTER.bagTier) ? " selected" : ""}>${esc(t.th)}</option>`).join("")}</select></label><label style="flex:0 1 140px"><span>กรองหมวด</span><select id="bag-slot"><option value="">ทั้งหมด</option>${(C.itemSlots ?? []).map((s) => `<option value="${s}"${s === FILTER.bagSlot ? " selected" : ""}>${esc(ITEM_SLOT_TH[s] ?? s)}</option>`).join("")}</select></label></div>
        <div class="bulk-bar"><button class="btn sm ghost" data-act="bag-check-all">เลือกทั้งหมด</button><button class="btn sm ghost" data-act="bag-check-none">ยกเลิกเลือก</button><button class="btn sm danger" data-act="bag-del-selected">ลบที่เลือก</button><div class="spacer"></div><div class="row" style="gap:6px;"><select id="bag-sel" class="grow" style="width:200px">${bagMatches.map((x) => `<option value="${esc(x.id)}" data-tier="${x.tier}">${esc(iLabel(x))}</option>`).join("")}</select><input type="number" id="bag-n" min="1" value="1" style="width:60px" placeholder="จำนวน"><button class="btn primary" data-act="bagadd">+ เพิ่ม</button></div></div>
        <div class="gear-legend"><span><span class="dot eq"></span> สวมใส่อยู่</span><span><span class="dot avail"></span> ในกระเป๋า</span><span class="mute">(ชี้เมาส์ที่ชื่อเพื่อดูรหัสไอเทม)</span></div>
        <table class="bag-table"><thead><tr><th style="width:30px"></th><th>ไอเทม</th><th style="width:100px">จำนวน</th><th></th></tr></thead><tbody>${bagRows || '<tr><td colspan="4" class="mute" style="text-align:center;padding:20px">กระเป๋าว่างเปล่า</td></tr>'}</tbody></table>
        <h3>ตำราที่รู้ (recipes)</h3>
        <label class="f"><span>รหัสตำรา (คั่นด้วย comma)</span><textarea data-act="recipes" placeholder="healPill, qiPill, foundationPill, w_ironSword, ...">${esc((S.recipes ?? []).join(", "))}</textarea></label>
        <div class="mute">เช่น healPill, qiPill, antidote, foundationPill, corePill, w_ironSword, t_mend, a_mist</div>`;
    }
    const slotSel = (kind) => {
      const list = C.techniques.filter((x) => x.kind === kind).sort((a, b) => b.tier - a.tier);
      const mk = (cur, idx) => `<select data-act="tslot" data-kind="${kind}" data-i="${idx}"><option value="">— ว่าง —</option>${list.map((x) => `<option value="${esc(x.id)}" data-tier="${x.tier}"${x.id === cur ? " selected" : ""}>${esc(iLabel(x))}</option>`).join("")}</select>`;
      if (kind === "combat" || kind === "support") { const n = kind === "combat" ? combatSlots() : supportSlots(); return `<label class="f" style="grid-column: span 2;"><span>${KIND_TH[kind]} (${n} ช่อง)</span>${Array.from({ length: n }, (_, i) => mk(S.slots[kind][i] ?? "", i)).join("")}</label>`; }
      return `<label class="f"><span>${KIND_TH[kind]}</span>${mk(S.slots[kind] ?? "", 0)}</label>`;
    };
    const techEntries = Object.keys(S.techs ?? {}).sort((a, b) => (TECH.get(b)?.tier ?? -1) - (TECH.get(a)?.tier ?? -1));
    const techRows = techEntries.map((id) => {
      const x = TECH.get(id), isEq = [S.slots?.main, S.slots?.movement, S.slots?.defense, ...(S.slots?.combat ?? []), ...(S.slots?.support ?? [])].includes(id);
      return `<tr class="${isEq ? 'is-equipped' : ''}"><td><input type="checkbox" class="tech-check" data-id="${esc(id)}"></td><td class="${x ? TIER_CLASS(x.tier) : ''}"><span class="item-id-tip" data-id="${esc(id)}">${esc(x ? iLabel(x) : id)}</span>${x?.demonic ? '<span class="tag dem">มาร</span>' : ""}${x?.martial ? '<span class="tag mar">ยุทธ์</span>' : ""}</td><td><input type="number" min="0" data-act="techn" data-id="${esc(id)}" value="${Math.round(S.techs[id])}" style="width:80px"></td><td style="width:40px;"><button class="btn sm danger-ghost" data-act="techdel" data-id="${esc(id)}" title="ลบวิชา">×</button></td></tr>`;
    }).join("");
    const techMatches = C.techniques.filter((x) => matchStr(x, FILTER.tech) && (!FILTER.techKind || x.kind === FILTER.techKind)).slice(0, 100);
    return `${tabs}<div class="row" style="justify-content:flex-end;margin-bottom:12px"><button class="btn ghost sm" data-act="reset-panel">คืนค่าแผงนี้</button></div>
      <h3>ช่องติดตั้งวิชา</h3><div class="grid" style="margin-bottom:24px">${["main","movement","defense","combat","support"].map(slotSel).join("")}</div>
      <h3>คลังวิชา (${techEntries.length})</h3>
      <div class="filter-bar"><label><span>ค้นหาวิชา</span><input type="text" id="tech-q" placeholder="พิมพ์ชื่อ หรือ ID..." value="${esc(FILTER.tech)}"></label><label style="flex:0 1 160px"><span>กรองหมวด</span><select id="tech-kind"><option value="">ทั้งหมด</option>${Object.entries(KIND_TH).map(([k, v]) => `<option value="${k}"${k === FILTER.techKind ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label></div>
      <div class="bulk-bar"><button class="btn sm ghost" data-act="tech-check-all">เลือกทั้งหมด</button><button class="btn sm ghost" data-act="tech-check-none">ยกเลิกเลือก</button><button class="btn sm danger" data-act="tech-del-selected">ลบที่เลือก</button><div class="spacer"></div><div class="row" style="gap:6px;"><select id="tech-sel" style="width:200px">${techMatches.map((x) => `<option value="${esc(x.id)}" data-tier="${x.tier}">${esc(iLabel(x))}</option>`).join("")}</select><select id="tech-lv" style="width:120px">${MASTERY.map(([p, n]) => `<option value="${p}">ความชำนาญ: ${n}</option>`).join("")}</select><button class="btn primary" data-act="techadd">+ เรียน</button></div></div>
      <div class="gear-legend"><span><span class="dot eq"></span> ติดตั้งอยู่ในช่อง</span><span><span class="dot avail"></span> ยังไม่ติดตั้ง</span><span class="mute">(ชี้เมาส์ที่ชื่อเพื่อดูรหัสวิชา)</span></div>
      <table class="bag-table"><thead><tr><th style="width:30px"></th><th>วิชา</th><th style="width:100px">ความชำนาญ</th><th></th></tr></thead><tbody>${techRows || '<tr><td colspan="4" class="mute" style="text-align:center;padding:20px">ยังไม่มีวิชา</td></tr>'}</tbody></table>`;
  }

  function pAdv() {
    return `<h2>ขั้นสูง</h2>
      <div class="note bad">ใช้ด้วยความระวัง — แก้ path ตรงๆ</div>
      <div class="grid">
        <label class="f"><span>path</span><input type="text" id="adv-p" placeholder="stats.body"></label>
        <label class="f"><span>ค่า (JSON)</span><input type="text" id="adv-v" placeholder="80"></label>
      </div>
      <div class="row" style="margin-top:8px">
        <button class="btn" data-act="adv-get">ดู</button>
        <button class="btn primary" data-act="adv-set">ตั้ง</button>
        <button class="btn ghost" data-act="adv-del">ลบ</button>
      </div>
      <textarea id="adv-out" readonly placeholder="ผลลัพธ์"></textarea>
      <h3>ฟิลด์ระดับบนสุด (${Object.keys(S).length})</h3>
      <p class="mute">${Object.keys(S).map((k) => `<code>${esc(k)}</code>`).join(" ")}</p>`;
  }

  function pTimeline() {
    const log = S.log ?? [], base = S.logBase ?? 0, total = base + log.length, fKind = FILTER.tlKind ?? "", fQ = (FILTER.tlQ ?? "").toLowerCase();
    let entries = log.map((e, i) => ({ ...e, _idx: i + base })).reverse();
    if (fKind) entries = entries.filter((e) => e.kind === fKind);
    if (fQ) entries = entries.filter((e) => ((e.th ?? "") + " " + (e.en ?? "")).toLowerCase().includes(fQ));
    const kindIcon = (k) => ({ death: "💀", milestone: "⭐", master: "👑" }[k] ?? "📜");
    return `<h2>ประวัติชีวิต (${total} entries)</h2><div class="tl-filter"><input type="text" id="tl-q" placeholder="ค้นหาใน log..." value="${esc(FILTER.tlQ ?? "")}" style="flex:1 1 200px"><select id="tl-kind"><option value="">— ทั้งหมด —</option><option value="milestone"${fKind === "milestone" ? " selected" : ""}>⭐ เหตุการณ์สำคัญ</option><option value="death"${fKind === "death" ? " selected" : ""}>💀 ความตาย</option><option value="master"${fKind === "master" ? " selected" : ""}>👑 ขึ้นเป็นเจ้าสำนัก</option></select></div>
      <div class="timeline-list">${entries.length ? entries.slice(0, 500).map((e) => `<div class="tl-row tl-${esc(e.kind ?? "")}"><span class="tl-date">ปี ${e.age ?? "?"}${e.month != null ? ` · ${e.month}` : ""}</span><span class="tl-icon">${kindIcon(e.kind)}</span><span class="tl-text">${esc(e.th ?? "")}${e.close ? ` <small class="mute">(สนิท ${e.close > 0 ? "+" : ""}${e.close})</small>` : ""}</span></div>`).join("") : `<p class="mute" style="padding:16px;text-align:center;">ไม่มีบันทึกที่ตรงเงื่อนไข</p>`}${entries.length > 500 ? `<p class="mute" style="padding:12px;text-align:center">แสดง 500 จาก ${entries.length}</p>` : ""}</div>`;
  }

  function pHealth() {
    if (!S) return `<p class="mute">ยังไม่ได้เปิดไฟล์</p>`;
    const issues = checksFixable(), people = S.world?.people ?? [], rel = S.world?.rel ?? {}, heroAge = S.ageMonths ?? 0;
    const alive = people.filter((p) => !p.dead && (p.d == null || heroAge < p.d)), relIds = Object.keys(rel).map(Number), unmet = alive.filter((p) => !rel[p.id] && p.role !== "beast");
    const bagCount = Object.values(S.bag ?? {}).reduce((s, n) => s + n, 0), saveKb = (JSON.stringify(S).length / 1024).toFixed(0), fixable = issues.filter((i) => i.fix).length;
    const cards = [{ label: "NPC ทั้งหมด", val: people.length, hint: `มีชีวิต ${alive.length}` }, { label: "ความสัมพันธ์", val: relIds.length, hint: `ยังไม่รู้จัก ${unmet.length}` }, { label: "ขนาดเซฟ", val: `${saveKb} KB`, hint: `${(S.log ?? []).length} log` }, { label: "กระเป๋า", val: bagCount, hint: `${Object.keys(S.techs ?? {}).length} วิชา` }];
    return `<h2>สถานะเซฟ</h2><div class="health-grid">${cards.map((c) => `<div class="health-card"><div class="label">${esc(c.label)}</div><div class="val">${esc(c.val)}</div><div class="hint">${esc(c.hint)}</div></div>`).join("")}</div>
      <h3>การตรวจสอบ (${issues.length} ปัญหา${fixable ? `, แก้ได้ ${fixable}` : ""})</h3>
      ${issues.length ? `<div class="card" style="padding:12px">${issues.map((iss) => `<div class="fix-row"><span><span class="mute">[${iss.lvl}]</span> ${esc(iss.text)}</span>${iss.fix ? `<button class="btn sm primary" data-act="auto-fix" data-fix="${iss.fix}">แก้</button>` : `<span class="mute" style="font-size:.72rem">แก้เอง</span>`}</div>`).join("")}${fixable ? `<div class="fix-bar"><button class="btn primary" data-act="auto-fix-all">🔧 แก้ไขทั้งหมดที่แก้ได้</button></div>` : ""}</div>` : `<p class="mute" style="padding:12px">✓ ไม่พบปัญหา</p>`}`;
  }

  function pCompare() {
    if (!COMPARE_S) return `<h2>เปรียบเทียบเซฟ</h2><div class="note">โหลดเซฟที่ 2 เพื่อเปรียบเทียบกับเซฟปัจจุบัน</div><div class="row" style="margin-top:12px"><label class="btn primary">โหลดเซฟที่ 2<input id="cmp-file" type="file" accept=".wox,.json" hidden></label></div>`;
    const diffs = [];
    (function walk(a, b, prefix) { if (a === b) return; const ta = typeof a, tb = typeof b; if (ta !== tb || a === null || b === null || ta !== "object") { diffs.push({ path: prefix, old: a, new: b }); return; } if (Array.isArray(a) !== Array.isArray(b)) { diffs.push({ path: prefix, old: a, new: b }); return; } if (Array.isArray(a)) { for (let i = 0; i < Math.max(a.length, b.length); i++) walk(a[i], b[i], `${prefix}[${i}]`); return; } const keys = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of keys) walk(a[k], b[k], prefix ? `${prefix}.${k}` : k); })(COMPARE_S, S, "");
    return `<h2>เปรียบเทียบ</h2><div class="cmp-header"><span class="file-chip">A: ${esc(COMPARE_FILE)}</span><span class="file-chip">B: ${esc(FILE)}</span><button class="btn sm ghost" data-act="cmp-clear">ปิด</button></div><div class="note">การเปลี่ยนแปลง ${diffs.length} รายการ</div>${diffs.length ? `<table class="cmp-diff-table"><thead><tr><th>path</th><th>A</th><th>B</th></tr></thead><tbody>${diffs.slice(0, 300).map((d) => `<tr><td class="path">${esc(d.path)}</td><td class="old">${esc(JSON.stringify(d.old))}</td><td class="new">${esc(JSON.stringify(d.new))}</td></tr>`).join("")}${diffs.length > 300 ? `<tr><td colspan="3" class="mute">+${diffs.length - 300} รายการ...</td></tr>` : ""}</tbody></table>` : `<p class="mute">ไม่มีความแตกต่าง</p>`}`;
  }

  function pSettings() {
    return `<h2>ตั้งค่า</h2>
      <h3>ข้อมูลส่วนตัว (Local Storage)</h3>
      <div class="note">บุ๊กมาร์ก ★, บันทึกย่อ NPC 📝, และข้อมูล look override จะถูกเก็บไว้ในเบราว์เซอร์ของคุณเท่านั้น (ไม่ติดไปกับไฟล์ .wox)</div>
      <div class="row" style="margin-top:12px">
        <button class="btn ghost" style="color:var(--red); border-color:var(--line);" data-act="clear-local-meta">ล้างข้อมูลบุ๊กมาร์ก & บันทึกทั้งหมด</button>
      </div>`;
  }

  const PANELS = { file:pFile, settings:pSettings, id:pId, origin:pOrigin, stats:pStats, life:pLife, place:pPlace, rel:pRel, gear:pGear, adv:pAdv, timeline:pTimeline, health:pHealth, compare:pCompare };

  function doAutoFix(key) {
    if (!S) return; pushUndo();
    if (key === "fix-root") { if (!S.root?.type) return; const need = ROOT_COUNT[S.root.type] ?? 0; const pool = S.root.type === "special" ? C.specialElements : C.basicElements; const keep = (S.root.elements ?? []).filter((e) => pool.includes(e)).slice(0, need); const fill = pool.filter((e) => !keep.includes(e)).slice(0, need - keep.length); S.root.elements = [...keep, ...fill]; }
    else if (key === "fix-married") { S.married = false; S.spouseId = null; S.spouse = null; }
    else if (key === "fix-spouse") { S.married = true; }
    else if (key === "fix-talents") { const ts = talentSlotsUsed(); if (ts.good > ts.goodCap) { const goodIds = S.talents.filter((id) => TALENT.get(id)?.good && !TALENT.get(id)?.crossing); S.talents = S.talents.filter((id) => !goodIds.slice(ts.goodCap).includes(id)); } }
    else if (key === "fix-equipped") { for (const slot of SLOTS) { const id = S.equip?.[slot]; if (!id) continue; if ((S.bag?.[id] ?? 0) < wearing(id)) S.bag[id] = wearing(id); } }
    else if (key === "fix-stale-rel") { const peopleIds = new Set((S.world?.people ?? []).map((p) => p.id)); for (const id of Object.keys(S.world?.rel ?? {})) if (!peopleIds.has(Number(id))) delete S.world.rel[id]; }
    else if (key === "fix-tech-slot") {
      for (const k of ["main", "movement", "defense"]) if (S.slots?.[k] && !S.techs?.[S.slots[k]]) S.slots[k] = null;
      for (const k of ["combat", "support"]) if (S.slots?.[k]) S.slots[k] = S.slots[k].filter((x) => S.techs?.[x]);
    }
    else if (key === "fix-hair") {
      const hs = S.gender === "female" ? (C.looks?.hairF ?? []) : (C.looks?.hairM ?? []);
      if (hs.length) S.look.hair = Math.max(0, Math.min(hs.length - 1, Number(S.look.hair) || 0));
    }
    toast("แก้ไขแล้ว"); renderPanel(); renderSide();
  }
  function doAutoFixAll() {
    if (!S) return; pushUndo();
    if (S.root?.type) { const need = ROOT_COUNT[S.root.type] ?? 0; if (S.root.elements?.length !== need) { const pool = S.root.type === "special" ? C.specialElements : C.basicElements; const keep = (S.root.elements ?? []).filter((e) => pool.includes(e)).slice(0, need); const fill = pool.filter((e) => !keep.includes(e)).slice(0, need - keep.length); S.root.elements = [...keep, ...fill]; } }
    const peopleIds = new Set((S.world?.people ?? []).map((p) => p.id));
    if (S.married && (S.spouseId == null || !peopleIds.has(S.spouseId))) { S.married = false; S.spouseId = null; S.spouse = null; }
    if (!S.married && S.spouseId != null) S.married = true;
    const ts = talentSlotsUsed(); if (ts.good > ts.goodCap) { const goodIds = S.talents.filter((id) => TALENT.get(id)?.good && !TALENT.get(id)?.crossing); S.talents = S.talents.filter((id) => !goodIds.slice(ts.goodCap).includes(id)); }
    for (const slot of SLOTS) { const id = S.equip?.[slot]; if (!id) continue; if ((S.bag?.[id] ?? 0) < wearing(id)) S.bag[id] = wearing(id); }
    for (const id of Object.keys(S.world?.rel ?? {})) if (!peopleIds.has(Number(id))) delete S.world.rel[id];
    if (S.look?.hair != null) {
      const hs = S.gender === "female" ? (C.looks?.hairF ?? []) : (C.looks?.hairM ?? []);
      if (hs.length) S.look.hair = Math.max(0, Math.min(hs.length - 1, Number(S.look.hair) || 0));
    }
    for (const k of ["main", "movement", "defense"])
      if (S.slots?.[k] && !S.techs?.[S.slots[k]]) S.slots[k] = null;
    for (const k of ["combat", "support"])
      if (S.slots?.[k]) S.slots[k] = S.slots[k].filter((x) => S.techs?.[x]);
    toast("แก้ไขทั้งหมดแล้ว"); renderPanel(); renderSide();
  }

  function checksFixable() {
    if (!S) return [];
    const out = [], add = (lvl, text, fix = null) => out.push({ lvl, text, fix });
    const r = S.root;
    if (r?.type && (r.elements?.length !== (ROOT_COUNT[r.type] ?? 0))) add("err", `ราก ${r.type} ต้องมี ${ROOT_COUNT[r.type]} ธาตุ`, "fix-root");
    if (r?.rev && !r.rev.shown) add("warn", `มีรากวิญญาณย้อนกลับซ่อน`);
    for (const [a, b] of talentClashes()) add("err", `พรสวรรค์ขัด: ${TALENT.get(a)?.th ?? a} + ${TALENT.get(b)?.th ?? b}`);
    const ts = talentSlotsUsed(); if (ts.good > ts.goodCap) add("warn", `พรสวรรค์ดี ${ts.good} เกิน ${ts.goodCap}`, "fix-talents");
    let equippedErr = false;
    for (const slot of SLOTS) { const id = S.equip?.[slot]; if (!id) continue; if ((S.bag?.[id] ?? 0) < wearing(id)) { if (!equippedErr) { equippedErr = true; add("err", `สวมไอเทมที่ไม่มีในถุง`, "fix-equipped"); } } }
    for (const id of Object.keys(S.techs ?? {})) if (!TECH.has(id)) add("warn", `วิชา ${id} ไม่อยู่ในแคตาล็อก`);
    if (S.alive && S.death) add("warn", "alive=true + death อยู่");
    if (!S.alive && !S.death) add("warn", "alive=false + death=null");
    if (S.married && !S.spouseId) add("warn", "married=true แต่ spouseId=null", "fix-married");
    if (!S.married && S.spouseId) add("warn", "spouseId แต married=false", "fix-spouse");
    const peopleIds = new Set((S.world?.people ?? []).map((p) => p.id)); const stale = Object.keys(S.world?.rel ?? {}).filter((id) => !peopleIds.has(Number(id))); if (stale.length) add("warn", `ความสัมพันธ์ ${stale.length} รายการชี้ไปยัง NPC ที่หายไป`, "fix-stale-rel");
    if (S.version !== SAVE_VER) add("warn", `เซฟ v${S.version ?? "?"} (ตัวแก้ตรวจ v${SAVE_VER})`);
    const slotIds = [S.slots?.main, S.slots?.movement, S.slots?.defense, ...(S.slots?.combat ?? []), ...(S.slots?.support ?? [])].filter(Boolean);
    const missingTech = slotIds.filter((id) => !S.techs?.[id]);
    if (missingTech.length) add("warn", `ช่องติดตั้งวิชา ${missingTech.length} ช่องชี้ไปยังวิชาที่ไม่ได้เรียน`, "fix-tech-slot");
    if (S.look?.hair != null) {
      const hs = S.gender === "female" ? (C.looks?.hairF ?? []) : (C.looks?.hairM ?? []);
      if (hs.length && Number(S.look.hair) >= hs.length) add("warn", `ทรงผม index ${S.look.hair} เกินช่วงของเพศ`, "fix-hair");
    }
    if (!out.length) add("ok", "ไม่พบปัญหา");
    return out;
  }
  // v13.4: checksFixable() คืน { lvl, text, fix } อยู่แล้ว — alias ตรงๆ กัน identity map เปล่าประโยชน์
  const checks = checksFixable;

  function showAddRelModal() {
    const rel = S.world?.rel ?? {}, people = S.world?.people ?? [], missing = people.filter((p) => !rel[p.id]);
    if (!missing.length) return toast("NPC ทุกคนอยู่ใน rel แล้ว", true);
    const host = document.createElement("div");
    host.innerHTML = `<div class="modal"><div class="modal-body"><h3>เพิ่ม NPC เข้า rel</h3><input type="text" id="add-rel-q" placeholder="ค้นหา" style="width:100%;margin-bottom:10px"><div id="add-rel-list" style="max-height:400px;overflow-y:auto;border:1px solid var(--line);border-radius:6px"></div><div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost" id="add-rel-cancel">ปิด</button></div></div></div>`;
    document.body.appendChild(host);
    const q = () => document.getElementById("add-rel-q").value.trim().toLowerCase(), listEl = document.getElementById("add-rel-list");
    const refresh = () => { const qv = q(); const f = qv ? missing.filter((p) => `${nameOf(p)} ${p.nm?.en ?? ""} ${p.id} ${roleTh(p.role)}`.toLowerCase().includes(qv)) : missing; listEl.innerHTML = f.slice(0, 80).map((p) => `<div class="rel-item" data-add-id="${p.id}"><div class="rel-name">${esc(nameOf(p))}</div><div class="rel-meta">${esc(roleTh(p.role))}${p.sect ? ` · ${esc(p.sect)}` : ""}</div></div>`).join("") || '<p class="mute" style="padding:10px">ไม่พบ</p>'; };
    document.getElementById("add-rel-q").oninput = refresh; document.getElementById("add-rel-cancel").onclick = () => host.remove();
    host.querySelector(".modal").onclick = (e) => { if (e.target.classList.contains("modal")) host.remove(); };
    listEl.onclick = (e) => { const item = e.target.closest("[data-add-id]"); if (!item) return; const pid = Number(item.dataset.addId); pushUndo(); addRelPerson(pid); SELECTED_REL = pid; NPC_TAB = 'info'; host.remove(); renderPanel(); renderSide(); };
    refresh(); setTimeout(() => document.getElementById("add-rel-q")?.focus(), 50);
  }

  const NAV = [
    { group: "ตัวละคร", items: [["id","ตัวตน"],["origin","กำเนิด"],["timeline","ประวัติ"]] },
    { group: "การบำเพ็ญ", items: [["stats","สเตตัส"],["life","ชีวิต"],["place","ขอบเขต"]] },
    { group: "สังคม", items: [["rel","ความสัมพันธ์"]] },
    { group: "ไอเทม & วิชา", items: [["gear","ของและวิชา"]] },
    { group: "เครื่องมือ", items: [["compare","เปรียบเทียบ"],["adv","ขั้นสูง"]] },
    { group: "ระบบ", items: [["file","ไฟล์"],["health","สถานะเซฟ"],["settings","ตั้งค่า"]] },
  ];
  function renderNav() { $("#nav").innerHTML = NAV.map((g) => `<div class="nav-group"><span class="nav-group-label">${esc(g.group)}</span>${g.items.map(([id, label]) => `<button class="nav-btn" data-tab="${id}" aria-selected="${id === TAB}"${!S && id !== "file" && id !== "settings" ? " disabled" : ""}>${esc(label)}</button>`).join("")}</div>`).join(""); }

  function renderSide() {
    if (!S) { $("#preview").innerHTML = `<p class="mute">ยังไม่ได้เปิดไฟล์</p>`; $("#warn").innerHTML = ""; return; }
    const isNpc = TAB === "rel" && SELECTED_REL !== null && relOf(SELECTED_REL);
    const p = isNpc ? npcOf(SELECTED_REL) : S;
    const name = isNpc ? nameOf(p) : (S.name?.th ?? "");
    const sub = isNpc ? `${p.g === 'f' ? 'หญิง' : 'ชาย'} · ${p.role ? roleTh(p.role) : "NPC"}` : `${S.gender === "male" ? "ชาย" : "หญิง"} · ${Math.floor((S.ageMonths ?? 0) / 12)} ปี · ${S.alive ? "มีชีวิต" : "สิ้นชีพ"}`;
    const stats = isNpc ? npcStatsOf(p) : S.stats, maxStat = statMaxFor(stats);
    const r = S.root, cls = CLASS.get(S.cls);
    const rootT = isNpc ? "—" : (r?.type ? (C.create?.root.find((x) => x.id === r.type)?.th ?? r.type) : "ไม่มีราก");
    const infoHtml = isNpc ? `<dt>บทบาท</dt><dd>${esc(roleTh(p.role))}</dd><dt>สำนัก</dt><dd>${esc(p.sect ?? "-")}</dd><dt>ความสัมพันธ์</dt><dd>${relOf(SELECTED_REL).c ?? 0}</dd>` : `<dt>ตระกูล</dt><dd>${esc(cls?.th ?? S.cls ?? "-")}</dd><dt>ราก</dt><dd>${esc(rootT)}</dd><dt>ที่อยู่</dt><dd>${esc(C.towns[S.home?.town]?.th ?? "-")}</dd><dt>เงิน</dt><dd>${S.money ?? 0}</dd><dt>ความสัมพันธ์</dt><dd>${Object.keys(S.world?.rel ?? {}).length} คน</dd>`;
    $("#preview").innerHTML = `<div class="pv-head"><div class="pv-face" id="pv-face"></div><div><p class="pv-name">${esc(name)}</p><p class="pv-sub">${esc(sub)}</p></div></div><div class="bars">${Object.keys(STAT_TH).map((k) => `<div class="bar"><span>${STAT_TH[k]}</span><i><b style="width:${Math.min(100, ((stats[k] ?? 50) / maxStat) * 100)}%"></b></i><em>${stats[k] ?? 50}</em></div>`).join("")}</div><dl class="pv-grid">${infoHtml}</dl>`;
    mountLook();
    const issues = checks();
    $("#warn").innerHTML = `<h2 style="font-size:1rem">ตรวจสอบ</h2><ul class="w">${issues.map((c) => `<li class="${c.lvl}">${esc(c.text)}${c.fix ? ` <button class="btn sm" data-act="auto-fix" data-fix="${c.fix}" style="padding:1px 6px;font-size:.7rem;margin-left:6px;">แก้</button>` : ""}</li>`).join("")}</ul>`;
  }

  function renderPanel() { $("#panel").innerHTML = PANELS[S ? TAB : "file"](); mountLook(); }
  function renderAll() { renderNav(); renderPanel(); renderSide(); $("#save").disabled = $("#savejson").disabled = $("#reset").disabled = !S; }

  const panel = $("#panel");
  const parse = (el) => { const t = el.dataset.t, v = el.value; if (t === "int") return Math.round(Number(v) || 0); if (t === "float") return Number(v) || 0; if (t === "bool") return v === "true"; return v; };
  let lastPushAt = 0;
  function pushUndoThrottled() { const now = Date.now(); if (now - lastPushAt < 400) return; pushUndo(); lastPushAt = now; }

  function rerenderPanelWithFocus(targetEl) {
    const id = targetEl.id;
    const selStart = targetEl.selectionStart;
    const selEnd = targetEl.selectionEnd;
    renderPanel();
    if (!id) return;
    const fresh = document.getElementById(id);
    if (!fresh) return;
    fresh.focus();
    if (selStart != null && selEnd != null && typeof fresh.setSelectionRange === "function") {
      try { fresh.setSelectionRange(selStart, selEnd); } catch {}
    }
  }

  panel.addEventListener("input", (e) => {
    const el = e.target; if (!S) return;
    if (el.dataset.act === "stat-num") {
      pushUndoThrottled();
      const v = Math.max(1, Math.round(Number(el.value) || 0));
      setStat(el.dataset.k, v);
      el.nextElementSibling.value = v;
      renderSide();
      return;
    }
    if (el.dataset.act === "npc-stat-num") {
      pushUndoThrottled();
      const pid = Number(el.dataset.npc), k = el.dataset.k, p = npcOf(pid);
      if (p) { p.stats ??= npcStatsOf(p); p.stats[k] = Math.max(1, Math.round(Number(el.value) || 0)); el.nextElementSibling.value = p.stats[k]; renderSide(); }
      return;
    }
    if (el.dataset.act === "npc-note") {
      const pid = Number(el.dataset.npcId);
      if (el.value.trim()) NOTES.set(pid, el.value); else NOTES.delete(pid);
      persistMeta();
      const row = document.querySelector(`.rel-item[data-id="${pid}"] .rel-name-row`);
      if (row) {
        const has = NOTES.has(pid), icon = row.querySelector(".note-ind");
        if (has && !icon) row.insertAdjacentHTML("beforeend", '<span class="note-ind" title="มีบันทึก">📝</span>');
        else if (!has && icon) icon.remove();
      }
      return;
    }
    if (el.dataset.act === "recipes") { pushUndoThrottled(); S.recipes = el.value.split(",").map((s) => s.trim()).filter(Boolean); return; }
    if (el.dataset.act === "rev-grade") { pushUndoThrottled(); if (S.root?.rev) { S.root.rev.grade = Math.max(1, Math.min(5, Math.round(Number(el.value) || 1))); renderSide(); } return; }
    if (el.id === "bag-q") { FILTER.bag = el.value; rerenderPanelWithFocus(el); return; }
    if (el.id === "tech-q") { FILTER.tech = el.value; rerenderPanelWithFocus(el); return; }
    if (el.id === "rel-q") { FILTER.relQ = el.value; rerenderPanelWithFocus(el); return; }
    if (el.id === "tl-q") { FILTER.tlQ = el.value; rerenderPanelWithFocus(el); return; }
    pushUndoThrottled();
    if (el.dataset.rel !== undefined) {
      const idNum = Number(el.dataset.rel), rk = el.dataset.rk, rt = el.dataset.rt, v = el.value;
      const val = rt === "int" ? Math.round(Number(v) || 0) : rt === "float" ? Number(v) || 0 : rt === "bool" ? v === "true" : rt === "int-or-null" ? (v === "" ? null : Math.round(Number(v))) : v;
      setRelField(idNum, rk, val); renderSide(); return;
    }
    if (el.dataset.npc !== undefined) {
      const idNum = Number(el.dataset.npc), rk = el.dataset.rk, rt = el.dataset.rt, p = npcOf(idNum), v = el.value;
      if (!p) return;
      if (rk && rk.startsWith("stats.")) { p.stats ??= npcStatsOf(p); p.stats[rk.split('.')[1]] = Math.round(Number(v) || 0); const b = document.getElementById(`npc-sv-${rk.split('.')[1]}`); if (b) b.textContent = v; const numIn = el.parentElement?.querySelector('[data-act="npc-stat-num"]'); if (numIn) numIn.value = v; renderSide(); return; }
      if (rt === "pair-year" || rt === "pair-month") {
        const base = rk.startsWith("b-") ? "b" : "d", yIn = document.querySelector(`input[data-npc="${idNum}"][data-rk="${base}-year"]`), mIn = document.querySelector(`input[data-npc="${idNum}"][data-rk="${base}-month"]`);
        if (!yIn || !mIn) return;
        const yV = yIn.value.trim(), mV = mIn.value.trim();
        if (base === "d" && yV === "" && mV === "") delete p.d; else p[base] = joinMonths(Number(yV) || 0, Number(mV) || 0);
        renderPanel();
        const fresh = document.querySelector(`input[data-npc="${idNum}"][data-rk="${rk}"]`);
        if (fresh) { fresh.focus(); try { const n = fresh.value.length; fresh.setSelectionRange(n, n); } catch {} }
        renderSide(); return;
      }
      let val;
      if (rt === "int") val = Math.round(Number(v) || 0); else if (rt === "float") val = Number(v) || 0; else if (rt === "bool") val = v === "true"; else if (rt === "int-or-null") val = v === "" ? null : Math.round(Number(v)); else val = v;
      setNpcField(p, rk, val); renderSide(); return;
    }
    if (el.dataset.p) { setPath(S, el.dataset.p, parse(el)); if (el.type === "range") el.closest("label").querySelector("b").textContent = Math.round(el.value); renderSide(); }
    else if (el.dataset.act === "stat") { setStat(el.dataset.k, Math.round(Number(el.value))); const sv = document.getElementById(`sv-${el.dataset.k}`); if (sv) sv.textContent = S.stats[el.dataset.k]; const numIn = el.parentElement?.querySelector('[data-act="stat-num"]'); if (numIn) numIn.value = S.stats[el.dataset.k]; renderSide(); }
  });

  panel.addEventListener("change", (e) => {
    const el = e.target, a = el.dataset.act; if (!S) return;
    if (a === "bulk-toggle") { const id = Number(el.dataset.id); if (el.checked) SELECTED_MULTI.add(id); else SELECTED_MULTI.delete(id); renderPanel(); return; }
    if (el.id === "bag-tier") { FILTER.bagTier = el.value; renderPanel(); return; }
    if (el.id === "bag-slot") { FILTER.bagSlot = el.value; renderPanel(); return; }
    if (el.id === "tech-kind") { FILTER.techKind = el.value; renderPanel(); return; }
    if (el.id === "rel-tag") { FILTER.relTag = el.value; renderPanel(); return; }
    if (el.id === "tl-kind") { FILTER.tlKind = el.value; renderPanel(); return; }
    if (a === "rel-tag") { pushUndo(); const idNum = Number(el.dataset.id), tag = el.dataset.tag, r = relOf(idNum); if (!r) return; r.tags ??= []; const p = npcOf(idNum); if (el.checked) { if (!r.tags.includes(tag)) r.tags.push(tag); if (tag === "spouse") { if (S.spouseId !== null && S.spouseId !== idNum) { const oldR = relOf(S.spouseId); if (oldR) { oldR.tags = (oldR.tags ?? []).filter((x) => x !== "spouse"); oldR.tags.push("consort"); } const oldP = npcOf(S.spouseId); if (oldP) oldP.wed = true; } S.married = true; S.spouseId = idNum; S.spouse = p ? nameOf(p) : null; if (p) p.wed = true; } if ((tag === "lover" || tag === "betrothed" || tag === "consort") && p) { p.wed = true; if (!r.lit) r.lit = true; } } else { r.tags = r.tags.filter((x) => x !== tag); if (tag === "spouse" && S.spouseId === idNum) { S.married = false; S.spouseId = null; S.spouse = null; if (p) p.wed = false; } } renderPanel(); renderSide(); return; }
    if (a === "rel-flag") { pushUndo(); const idNum = Number(el.dataset.id), flag = el.dataset.flag, r = relOf(idNum); if (!r) return; if (el.checked) r[flag] = true; else delete r[flag]; renderPanel(); renderSide(); return; }
    if (el.dataset.rel !== undefined || el.dataset.npc !== undefined) {
      if (el.dataset.npc !== undefined && a === "npc-equip") { pushUndo(); const p = npcOf(Number(el.dataset.npc)); if (p) { p.equip[el.dataset.slot] = el.value || null; renderPanel(); } }
      if (el.dataset.npc !== undefined && a === "npc-bagn") { pushUndo(); const p = npcOf(Number(el.dataset.npc)); if (p) { p.bag[el.dataset.id] = Math.max(0, Math.round(Number(el.value) || 0)); } }
      return;
    }
    if (el.dataset.p) { pushUndo(); setPath(S, el.dataset.p, parse(el)); renderSide(); return; }
    pushUndo();
    if (a === "age") {
    const oldAge = S.ageMonths ?? 0;
    const newAge = Math.max(0, Math.round(Number($("#age-y").value) * 12 + Number($("#age-m").value)));
    S.ageMonths = newAge;
    if (newAge < oldAge) {
    const unborn = (S.world?.people ?? []).filter((p) => (p.b ?? 0) > newAge && !p.dead);
    const tooOld = (S.world?.people ?? []).filter((p) => (p.d ?? Infinity) < newAge && p.dead);
    if (unborn.length > 5 || tooOld.length > 5)
      toast(`⚠️ อายุถอยหลัง: NPC ${unborn.length} คนยังไม่เกิด, ${tooOld.length} คนตายไปแล้วตอนนี้`, true);
    else if (unborn.length || tooOld.length)
      toast(`⚠️ NPC ${unborn.length + tooOld.length} คนมีวันเกิด/ตายไม่สอดคล้องกับอายุใหม่`, true);
    }
  }
    else if (a === "roottype") setRootType(el.value);
    else if (a === "elem") toggleElem(el.dataset.id, el.checked);
    else if (a === "talent") setTalent(el.dataset.id, el.checked);
    else if (a === "hidden") { S.hidden ??= []; S.flags ??= {}; const hid = el.dataset.id; if (el.checked) { if (!S.hidden.includes(hid)) S.hidden.push(hid); S.flags[`ht_${hid}`] = true; } else { S.hidden = S.hidden.filter((x) => x !== hid); delete S.flags[`ht_${hid}`]; } }
    else if (a === "flag") { S.flags ??= {}; if (el.checked) S.flags[el.dataset.k] = true; else delete S.flags[el.dataset.k]; }
    else if (a === "found") { S.found ??= {}; const fid = el.dataset.id; if (el.value) S.found[fid] = el.value; else delete S.found[fid]; if (S.world) { S.world.found ??= {}; if (el.value) S.world.found[fid] = el.value; else delete S.world.found[fid]; } }
    else if (a === "set-sect") { if (el.value) S.sect = el.value; else delete S.sect; }
    else if (a === "set-path") { if (el.value) S.path = el.value; else delete S.path; }
    else if (a === "hero-nat") { if (el.value) S.nat = el.value; else delete S.nat; }
    else if (a === "hero-mark") { if (el.value) S.mark = el.value; else delete S.mark; }
    else if (a === "hero-dm") { if (el.value) S.dm = Number(el.value); else delete S.dm; }
    else if (a === "pl-c") { PL.c = el.value; PL.t = ""; }
    else if (a === "pl-r") { PL.r = el.value; PL.t = ""; }
    else if (a === "pl-t") PL.t = el.value;
    else if (a === "set-degree") { if (el.value) S.degree = el.value; else delete S.degree; }
    else if (a === "set-office") { if (el.value) S.office = Number(el.value); else delete S.office; }
    else if (a === "set-ennobled") { if (el.value) S.ennobled = el.value; else { delete S.ennobled; delete S.noble; } }
    else if (a === "set-army") { if (el.value) S.army = el.value; else { delete S.army; delete S.armyRank; } }
    else if (a === "set-advisor") { if (el.value) S.advisor = el.value; else delete S.advisor; }
    else if (a === "set-merit") { if (el.value === "") delete S.merit; else S.merit = Math.round(Number(el.value) || 0); }
    else if (a === "equip") {
      const slot = el.dataset.slot, v = el.value;
      if (v === "__auto") { S.chosen[slot] = false; delete S.equip[slot]; }
      else if (v === "") { S.chosen[slot] = true; delete S.equip[slot]; }
      else { S.chosen[slot] = true; S.equip[slot] = v; S.bag[v] = Math.max(S.bag[v] ?? 0, wearing(v)); }
    }
    else if (a === "tslot") {
      const kind = el.dataset.kind, idx = Number(el.dataset.i), v = el.value;
      S.chosen[kind] = true;
      if (kind === "combat" || kind === "support") { const n = kind === "combat" ? combatSlots() : supportSlots(); const list = Array.from({ length: n }, (_, i) => S.slots[kind][i] ?? ""); list[idx] = v; S.slots[kind] = [...new Set(list.filter(Boolean))]; } else S.slots[kind] = v || null;
      if (v) S.techs[v] ??= 0;
    }
    else if (a === "bagn") S.bag[el.dataset.id] = Math.max(0, Math.round(Number(el.value) || 0));
    else if (a === "techn") S.techs[el.dataset.id] = Math.max(0, Number(el.value) || 0);
    else if (a === "alive") {
      const on = el.value === "true";
      if (on && !S.alive) { S.alive = true; S.death = null; S.health = Math.max(50, S.health ?? 100); (S.log ??= []).push({ age: Math.floor((S.ageMonths ?? 0) / 12), month: (S.ageMonths ?? 0) % 12, kind: "milestone", th: "ฟื้นคืนชีพ", en: "Revived" }); }
      else if (!on && S.alive) { S.alive = false; S.health = 0; S.death = { ageMonths: S.ageMonths, cause: { th: "ถูกแก้เซฟ", en: "save edit" } }; (S.log ??= []).push({ age: Math.floor((S.ageMonths ?? 0) / 12), month: (S.ageMonths ?? 0) % 12, kind: "death", th: "สิ้นชีพ", en: "Died" }); }
    }
    else if (a === "ascended") S.ascended = el.value === "true";
    else return;
    renderPanel(); renderSide();
  });

  panel.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || !S || b.tagName === "INPUT" || b.tagName === "SELECT") return;
    const a = b.dataset.act, id = b.dataset.id;
    if (a === "gear-sub-tab") { GEAR_TAB = b.dataset.sub; renderPanel(); return; }
    else if (a === "look-step") { pushUndo(); stepLook(b.dataset.k, Number(b.dataset.d)); }
    else if (a === "look-pose") POSE = b.dataset.pose || "stand";
    else if (a === "reset-panel") return resetPanel();
    else if (a === "select-rel") { SELECTED_REL = Number(id); NPC_TAB = 'info'; renderPanel(); renderSide(); return; }
    else if (a === "add-rel") return showAddRelModal();
    else if (a === "npc-sub-tab") { NPC_TAB = b.dataset.sub; renderPanel(); return; }
    else if (a === "npc-look-step") { stepNpcLook(Number(b.dataset.id), b.dataset.k, Number(b.dataset.d)); renderPanel(); renderSide(); return; }
    else if (a === "npc-look-reset") { LOOK_OVERRIDES.delete(Number(b.dataset.id)); persistMeta(); renderPanel(); renderSide(); return; }
    else if (a === "npc-stats-reset") { pushUndo(); const p = npcOf(Number(b.dataset.npcId)); if (p) { delete p.stats; renderPanel(); renderSide(); } }
    else if (a === "npc-gear-init") { pushUndo(); const p = npcOf(Number(b.dataset.npcId)); if (p) { p.bag ??= {}; p.equip ??= {}; p.techs ??= {}; renderPanel(); } }
    else if (a === "npc-talents-init") { pushUndo(); const p = npcOf(Number(b.dataset.npcId)); if (p) { p.talents ??= []; renderPanel(); } }
    else if (a === "npc-bagdel") { pushUndo(); const p = npcOf(Number(b.dataset.npcId)); if (p) { delete p.bag[b.dataset.id]; renderPanel(); } }
    else if (a === "npc-bagadd") { pushUndo(); const pid = Number(b.dataset.npcId); const p = npcOf(pid); if (p) { const v = $(`#npc-bag-sel-${pid}`).value; const n = Number($(`#npc-bag-n-${pid}`).value) || 1; if (v) p.bag[v] = (p.bag[v] || 0) + n; renderPanel(); } }
    else if (a === "npc-techdel") { pushUndo(); const p = npcOf(Number(b.dataset.npcId)); if (p) { delete npcSkillsObj(p)[b.dataset.id]; renderPanel(); } }
    else if (a === "npc-techadd") { pushUndo(); const pid = Number(b.dataset.npcId); const p = npcOf(pid); if (p) { const v = $(`#npc-tech-sel-${pid}`).value; if (v) npcSkillsObj(p)[v] = 1; renderPanel(); } }
    else if (a === "toggle-bookmark") { toggleBookmark(id); return; }
    else if (a === "auto-fix") { doAutoFix(b.dataset.fix); return; }
    else if (a === "auto-fix-all") { doAutoFixAll(); return; }
    else if (a === "cmp-clear") { COMPARE_S = null; COMPARE_FILE = ""; renderPanel(); return; }
    else if (a === "clear-local-meta") { if (await ask("ล้างข้อมูลบุ๊กมาร์ก, บันทึก NPC, และ Look override ทั้งหมด?")) { BOOKMARKS.clear(); NOTES.clear(); LOOK_OVERRIDES.clear(); persistMeta(); toast("ล้างข้อมูลส่วนตัวแล้ว"); renderPanel(); } return; }
    else if (a === "del-rel") { const idNum = Number(id), p = npcOf(idNum); if (!await ask(`ลบ ${nameOf(p) || `#${idNum}`} ออกจาก rel?`)) return; pushUndo(); delRel(idNum); renderPanel(); renderSide(); return; }
    else if (a === "add-rev") { pushUndo(); if (S.root) S.root.rev = { grade: 2, shown: false }; }
    else if (a === "del-rev") { pushUndo(); if (S.root) delete S.root.rev; }
    else if (a === "bulk-clear") { SELECTED_MULTI.clear(); renderPanel(); return; }
    else if (a === "bulk-tag-add") { const tag = await askText(`เพิ่ม tag ให้ ${SELECTED_MULTI.size} NPC\n(e.g. companion, family, friend):`); if (!tag) return; pushUndo(); let n = 0; SELECTED_MULTI.forEach((id) => { const r = relOf(id); if (r) { r.tags ??= []; if (!r.tags.includes(tag)) { r.tags.push(tag); n++; } } }); toast(`เพิ่ม tag "${tag}" ให้ ${n} NPC`); SELECTED_MULTI.clear(); renderPanel(); return; }
    else if (a === "bulk-tag-rm") { const tag = await askText(`ลบ tag ออกจาก ${SELECTED_MULTI.size} NPC:`); if (!tag) return; pushUndo(); let n = 0; SELECTED_MULTI.forEach((id) => { const r = relOf(id); if (r?.tags?.includes(tag)) { r.tags = r.tags.filter((x) => x !== tag); n++; } }); toast(`ลบ tag "${tag}" จาก ${n} NPC`); SELECTED_MULTI.clear(); renderPanel(); return; }
    else if (a === "bulk-set-c") { const v = await askText(`ตั้งค่าความสนิท (−100 ถึง 100) ให้ ${SELECTED_MULTI.size} NPC:`, "50"); if (v === null) return; const n = Math.max(-100, Math.min(100, Math.round(Number(v) || 0))); pushUndo(); SELECTED_MULTI.forEach((id) => { const r = relOf(id); if (r) r.c = n; }); toast(`ตั้งค่าความสนิท = ${n}`); SELECTED_MULTI.clear(); renderPanel(); renderSide(); return; }
    else if (a === "bulk-del") { if (!await ask(`ลบ ${SELECTED_MULTI.size} NPC ออกจาก rel ทั้งหมด?`)) return; pushUndo(); const n = SELECTED_MULTI.size; SELECTED_MULTI.forEach((id) => delRel(id)); SELECTED_MULTI.clear(); toast(`ลบ ${n} NPC`); renderPanel(); renderSide(); return; }
    else if (a === "bagdel") { pushUndo(); delete S.bag[id]; for (const s of SLOTS) if (S.equip[s] === id && wearing(id) > 0) S.equip[s] = null; }
    else if (a === "bagadd") { pushUndo(); initGear(); const v = $("#bag-sel").value, n = Math.max(1, Number($("#bag-n").value) || 1); if (v) S.bag[v] = (S.bag[v] ?? 0) + n; }
    else if (a === "bag-check-all") { document.querySelectorAll(".bag-check").forEach((cb) => cb.checked = true); return; }
    else if (a === "bag-check-none") { document.querySelectorAll(".bag-check").forEach((cb) => cb.checked = false); return; }
    else if (a === "bag-del-selected") { const selected = document.querySelectorAll(".bag-check:checked").length; if (!selected) return toast("ยังไม่ได้เลือกไอเทม", true); if (!await ask(`ยืนยันการลบ ${selected} ไอเทม?`)) return; pushUndo(); const removed = []; document.querySelectorAll(".bag-check:checked").forEach((cb) => { const iid = cb.dataset.id; delete S.bag[iid]; for (const s of SLOTS) if (S.equip[s] === iid) S.equip[s] = null; removed.push(iid); }); toast(`ลบ ${removed.length} ไอเทม`); }
    else if (a === "techadd") { pushUndo(); initGear(); const v = $("#tech-sel").value; if (v) S.techs[v] = Math.max(S.techs[v] ?? 0, Number($("#tech-lv").value)); }
    else if (a === "techdel") { pushUndo(); delete S.techs[id]; for (const k of ["main","movement","defense"]) if (S.slots[k] === id) S.slots[k] = null; for (const k of ["combat","support"]) S.slots[k] = S.slots[k].filter((x) => x !== id); }
    else if (a === "tech-check-all") { document.querySelectorAll(".tech-check").forEach((cb) => cb.checked = true); return; }
    else if (a === "tech-check-none") { document.querySelectorAll(".tech-check").forEach((cb) => cb.checked = false); return; }
    else if (a === "tech-del-selected") { const selected = document.querySelectorAll(".tech-check:checked").length; if (!selected) return toast("ยังไม่ได้เลือกวิชา", true); if (!await ask(`ยืนยันการลบ ${selected} วิชา?`)) return; pushUndo(); const removed = []; document.querySelectorAll(".tech-check:checked").forEach((cb) => { const tid = cb.dataset.id; delete S.techs[tid]; for (const k of ["main","movement","defense"]) if (S.slots[k] === tid) S.slots[k] = null; for (const k of ["combat","support"]) S.slots[k] = S.slots[k].filter((x) => x !== tid); removed.push(tid); }); toast(`ลบ ${removed.length} วิชา`); }
    else if (a === "pl-apply") { pushUndo(); const T = C.towns[PL.t]; if (!T) return toast("เลือกเมืองก่อน", true); S.region = PL.r; S.homeRegion = PL.r; S.home = { c: PL.c, reg: PL.r, town: PL.t }; S.placeAt = `town:${PL.t}`; if (PL.c === "central") delete S.continent; else S.continent = PL.c; for (const k of ["visit","stayTown","staySect","spot"]) delete S[k]; toast(`ตั้งพิกัดเป็น ${T.th}`); }
    else if (a === "adv-get") { const v = getPath(S, $("#adv-p").value.trim()); $("#adv-out").value = v === undefined ? "(ไม่มี)" : JSON.stringify(v, null, 2); return; }
    else if (a === "adv-set") { const p = $("#adv-p").value.trim(); if (!p) return; try { pushUndo(); setPath(S, p, JSON.parse($("#adv-v").value)); $("#adv-out").value = `${p} = ${$("#adv-v").value}`; } catch { return toast("ต้องเป็น JSON", true); } }
    else if (a === "adv-del") { pushUndo(); delPath(S, $("#adv-p").value.trim()); $("#adv-out").value = "ลบแล้ว"; }
    else if (a === "revive-ascended") { pushUndo(); if (S.log) { const i = S.log.map((x) => x?.kind).lastIndexOf("death"); if (i >= 0) S.log.splice(i, 1); } S.alive = true; S.ascended = false; S.death = null; S.health = 100; S.qi = 0; S.layer = 0; S.pending = null; for (const k of ["btReady","btWait","btTrial","btGo"]) delete S[k]; if (S.immortalStay == null) { S.immortalStay = S.ageMonths; S.immortalStayDue = true; } S.stayRevived = S.ageMonths; (S.log ??= []).push({ age: Math.floor((S.ageMonths ?? 0) / 12), month: (S.ageMonths ?? 0) % 12, kind: "milestone", th: C.reviveLine?.th ?? "ฟื้นกลับมาเป็นเซียน", en: C.reviveLine?.en ?? "Revived" }); toast("ฟื้นคืนชีพในสถานะเซียนแล้ว"); }
    else if (a === "load-backup") { const all = listBackups(), bk = all[Number(id)]; if (!bk?.snapshot) return toast("โหลดไม่ได้", true); try { S = JSON.parse(bk.snapshot); S.log ??= []; ORIG = clone(S); FILE = bk.name; WRAP = "gzip"; TAB = "id"; SELECTED_REL = null; NPC_TAB = 'info'; SELECTED_MULTI.clear(); PL = { c: S.home?.c ?? "central", r: S.home?.reg ?? "city", t: S.home?.town ?? "" }; initGear(); resetUndo(); loadMeta(); renderAll(); markSaved(); toast(`โหลดจากประวัติ: ${bk.name}`); } catch (err) { toast("ผิดพลาด: " + err.message, true); } return; }
    else return;
    renderPanel(); renderSide();
  });

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]"); if (!t || t.disabled) return;
    const oldTab = TAB; TAB = t.dataset.tab;
    if (TAB === "place" && S && !PL._init) PL = { c: S.home?.c ?? "central", r: S.home?.reg ?? "city", t: S.home?.town ?? "", _init: true };
    if (oldTab !== TAB) { if (TAB === 'rel') NPC_TAB = 'info'; renderNav(); renderPanel(); renderSide(); }
  });

  async function openFile(file) {
    try {
      const { save, wrapped } = await IO.readWox(await file.arrayBuffer());
      if (typeof save.ageMonths !== "number" || !save.stats || !save.name) throw new Error("ไม่ใช่เซฟชีวิต");
      if (!Array.isArray(save.log)) save.log = [];
      S = save; ORIG = clone(save); FILE = file.name; WRAP = wrapped; TAB = "id";
      S.talents ??= []; initGear(); SELECTED_REL = null; NPC_TAB = 'info'; SELECTED_MULTI.clear();
      PL = { c: S.home?.c ?? "central", r: S.home?.reg ?? "city", t: S.home?.town ?? "" };
      resetUndo(); loadMeta(); renderAll(); markSaved(); toast(`เปิด ${file.name}: ${S.name.th}`);
    } catch (err) { toast(`เปิดไม่ได้: ${err.message}`, true); }
  }
  function download(bytes, name, type = "application/octet-stream") {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes], { type })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function save(asJson = false) {
    const bad = checks().filter((c) => c.lvl === "err");
    if (bad.length && !await ask(`ยังมีข้อผิดพลาด ${bad.length} ข้อ — ดาวน์โหลดต่อ?`)) return;
    const diffs = diffAgainstOrig();
    if (diffs.length) showDiffModal(() => doSave(asJson)); else doSave(asJson);
  }
  async function doSave(asJson) {
    try {
    S.savedAt = Date.now(); const dropped = saveBackup(FILE || "save.wox", JSON.stringify(S).length, JSON.stringify(S));
    const bytes = await IO.writeWox(S, asJson ? "plain" : WRAP);
    const base = (S.name.en || S.name.th || "hero").replace(/[\\/:*?"<>|\s]+/g, "-");
    download(bytes, `way-of-xian-${base}.${asJson ? "json" : "wox"}`);
    markSaved();
    toast(`ส่งออกแล้ว (${(bytes.length / 1024).toFixed(0)} KB)` + (dropped ? ` · ตัดประวัติสำรองเก่า ${dropped} รายการ` : ""));
    } catch (err) { toast(`ส่งออกไม่สำเร็จ: ${err.message}`, true); }
  }

  $("#file").addEventListener("change", (e) => e.target.files[0] && openFile(e.target.files[0]));
  $("#save").addEventListener("click", () => save(false));
  $("#savejson").addEventListener("click", () => save(true));
  $("#reset").addEventListener("click", async () => { if (S && await ask("คืนค่าเดิมทั้งหมด?")) { pushUndo(); S = clone(ORIG); SELECTED_REL = null; SELECTED_MULTI.clear(); initGear(); renderAll(); toast("คืนค่าเดิม"); } });
  document.getElementById("search-btn")?.addEventListener("click", openGlobalSearch);
  document.getElementById("undo-btn")?.addEventListener("click", undo);
  document.getElementById("redo-btn")?.addEventListener("click", redo);
  document.addEventListener("change", async (e) => { if (e.target.id !== "cmp-file") return; const f = e.target.files?.[0]; if (!f) return; try { const { save: s2 } = await IO.readWox(await f.arrayBuffer()); COMPARE_S = s2; COMPARE_FILE = f.name; toast(`โหลดเปรียบเทียบ: ${f.name}`); renderPanel(); } catch (err) { toast("โหลดไม่ได้: " + err.message, true); } });
  document.addEventListener("dragover", (e) => { e.preventDefault(); $("#drop")?.classList.add("over"); });
  document.addEventListener("dragleave", () => $("#drop")?.classList.remove("over"));
  document.addEventListener("drop", (e) => { e.preventDefault(); $("#drop")?.classList.remove("over"); if (e.dataTransfer.files[0]) openFile(e.dataTransfer.files[0]); });

  renderAll();
  window.__wox = { get S() { return S; }, checks, diffAgainstOrig, nameOf, fmtAge, undo, redo, openGlobalSearch };
})();