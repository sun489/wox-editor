// export-catalog-v3.js — 2026-11-07
// Adds: beasts (from beasts-m.js), trips (hardcoded), outfit tables (from looks.js),
// reversedRoot/seenRoot, traitCost. Fixes: hair regex that dropped structural fields.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const src = path.resolve(process.argv[2] ?? "./src");
const load = (f) => import(pathToFileURL(path.join(src, f)).href);
const meta = { made: new Date().toISOString(), src, notes: [] };
const pick = (o, ks) => Object.fromEntries(ks.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

const D  = await load("data.js");
const T  = await load("towns.js");
const C  = await load("continents.js");
const CR = await load("create.js");
const GR = await load("growth.js");
const MA = await load("martial.js");
const SN = await load("stat-norm.js");
const AR = await load("ascend-revive.js");
const LU = await load("looks.js");
const CT = await load("create-traits.js");

// The secret realms that open on the calendar (from trip-events.js, too big
// to ship; the 119 entries that app.js reads). Kept in sync by hand.
const TRIPS_TH = {
  swordImmortalTomb: { th: "สุสานเซียนกระบี่" }, sunkenScripture: { th: "หอคัมภีร์ใต้บาดาล" },
  ancientForge: { th: "เตาหลอมเทพโบราณ" }, beastSovereignThrone: { th: "บัลลังก์ราชันสัตว์อสูร" },
  dungeon3: { th: "พระราชวังสวรรค์ที่ร่วงหล่น" }, dungeon5: { th: "ซากเทพบรรพกาล" },
  dungeon1: { th: "ถ้ำศิลาเรือง" }, dungeon2: { th: "ซากสำนักเก้าเตาจมพิภพ" },
  dungeon4: { th: "หุบเหวเซียนร่วง" },
  eeHeavenLadder: { th: "การสอบเข้าสำนักบนบันไดฟ้าพันขั้น" },
  eeRootForest: { th: "การสอบเข้าสำนักด้วยศิลาวัดรากและคืนในป่าอสูร" },
  eeHeartMirror: { th: "การสอบเข้าสำนักในโถงกระจกส่องใจ" },
  eeHerbArray: { th: "การสอบเข้าสำนักด้วยสมุนไพรและค่ายกล" },
  eeWoodenMen: { th: "การสอบเข้าสำนักที่ระเบียงหุ่นไม้สิบแปดตัว" },
  eeWaterMountain: { th: "การสอบเข้าสำนักด้วยการหาบน้ำขึ้นเขาสามพันขั้น" },
  eeYardBouts: { th: "การสอบเข้าสำนักด้วยการประมือกับศิษย์พี่บนลานฝึก" },
  eeConductGate: { th: "การสอบเข้าสำนักบนเส้นทางสามสิบวัน" },
  exIThreeSessions: { th: "การสอบขุนนางสามสนามในเรือนสอบหลวง" },
  exITurmoil: { th: "การสอบขุนนางในปีแห่งความอื้อฉาว" },
  exSPagoda: { th: "การสอบเลื่อนขั้นในหอทดสอบสามชั้น" },
  exSHerbArray: { th: "การสอบเลื่อนขั้นสามด่าน: โอสถ ค่ายกล และการล่าอสูร" },
  exSBloodTrial: { th: "การคัดเลื่อนขั้นสามด่าน: สระโลหิต ลานคัดกระดูก และธงวิญญาณ" },
  exSHeartLadder: { th: "การสอบเลื่อนขั้นแห่งมารในใจและบันไดประลอง" },
  exSFormsLadder: { th: "การสอบเลื่อนขั้น: รำเพลงมวยต่อหน้าผู้อาวุโสและบันไดประลอง" },
  exSMountainCross: { th: "การสอบเลื่อนขั้น: แบกหินข้ามสามสันเขา" },
  exSEscortGuard: { th: "การสอบเลื่อนขั้น: คุ้มกันหีบผนึกตราสำนัก" },
  grandTournament: { th: "การประลองใหญ่ใต้หล้า" }, grandTournamentWatch: { th: "ชมการประลองใหญ่ใต้หล้า" },
  beastTideDefense: { th: "ศึกต้านคลื่นสัตว์อสูร" }, sectWarCampaign: { th: "ศึกบุกภูเขาสำนักศัตรู" },
  caravanEscort: { th: "การคุ้มกันกองคาราวานเกลือ" }, officialPost: { th: "เส้นทางไปรับตำแหน่งที่อำเภอไกล" },
  weddingProcession: { th: "ขบวนเยือนบ้านเกิดของคู่ครอง" },
  insightWander: { th: "การท่องขุนเขาสายน้ำแสวงหาการรู้แจ้ง" }, pilgrimage: { th: "การจาริกแสวงบุญสู่เขาเมฆขาว" },
  herbHunt: { th: "การล่าสมุนไพรในป่าลึก" }, tradeRun: { th: "การค้าข้ามหัวเมือง" },
  swordTour: { th: "การท่องแผ่นดินบนกระบี่เหิน" }, homecoming: { th: "การกลับบ้านเกิดหลังจากจากไปหลายปี" },
  wanderingHero: { th: "เส้นทางของจอมยุทธ์พเนจร" },
  l6aJubilee: { th: "เมืองหลวงท่าหยก" }, l6aCapital: { th: "ราชธานีโคมเก้าดวง" },
  l6bThreePines: { th: "ซากศาลาสามสน" }, l6cLampRoad: { th: "ถนนโคมของจักรพรรดิฉางหมิง" },
  l6cWallVillage: { th: "หมู่บ้านกำแพงเทพ" }, l6cShowroom: { th: "ร้านค้าแปลงเงียบ" },
  l6eRegistry: { th: "หอทะเบียนเหนือทะเลเมฆ" }, l6eHollow: { th: "นครกระดูกของโต๊ะกินเถ้า" },
  l7aFuneralCapital: { th: "นครเก้าประตู" }, l7aPassTower: { th: "หอตะเกียงด่านลมตะไคร่" },
  l7cSixBowls: { th: "เรือนเถ้าที่ตีนยอดเขาไหม้เกรียม" }, l7cCloudTerrace: { th: "ระเบียงทะเลเมฆของเก้าสายฟ้า" },
  l7dFirstHearth: { th: "หมู่บ้านที่ท่านเกิด" }, l7dGuide: { th: "ทัวร์หกมหัศจรรย์" },
  l7eStair: { th: "บันไดแก้วสีม่วงเหนือเมฆ" }, l7eSummit: { th: "ขั้นใสเหนือน้ำสีดำและดาว" },
  mdungeon1: { th: "ค่ายโจรลมดำ" }, mdungeon2: { th: "สุสานกระบี่ไร้นาม" },
  n3bRiverMarket: { th: "แพตลาดลอยน้ำล่องตามน้ำหลาก" }, n3eDrained: { th: "ก้นทะเลสาบที่แห้ง" },
  n5eSundial: { th: "ลานนาฬิกาแดดกลางทุ่งข้าวสาลี" }, n6eOrchard: { th: "สวนผลไม้ที่ให้ยืมปี" },
  frozenThrone: { th: "บัลลังก์น้ำแข็งนิรันดร์" }, boneCityRealm: { th: "นครกระดูก" },
  dragonGraveyardRealm: { th: "สุสานมังกร" }, q33eValley: { th: "หุบเขาที่ฤดูเดินถอยหลัง" },
  immortalSectRuins: { th: "ซากสำนักเซียนลอยฟ้า" }, primordialBeastLand: { th: "แผ่นดินสัตว์อสูรบรรพกาล" },
  heavenTomb: { th: "สุสานเซียนสวรรค์ผู้ร่วงหล่น" }, netherAbyss: { th: "ห้วงเหวยมโลก" },
  ancientBattlefield: { th: "สมรภูมิโบราณแห่งสองสำนักล่มสลาย" },
  fireSpiritVolcano: { th: "ภูเขาไฟวิญญาณอัคคี" }, frostLotusLake: { th: "ทะเลสาบบัวน้ำแข็ง" },
  illusionMaze: { th: "เขาวงกตพันมายา" }, drownedPalace: { th: "วังมังกรใต้สมุทร" },
  beastNest: { th: "รังเหยี่ยววิญญาณ" }, swordShard: { th: "ลานฝึกกระบี่ร้าง" },
  fallenAbode: { th: "ถ้ำพำนักของฤๅษีนิรนาม" }, mirrorPond: { th: "บ่อน้ำนิ่งในหุบเขา" },
  lavaVein: { th: "สายปราณไฟใต้เนินเขา" }, frostCrack: { th: "รอยแยกน้ำแข็งกับบัวหิมะ" },
  ghostShrine: { th: "ศาลเจ้าร้างในหุบหมอก" }, alchemistGarden: { th: "สวนยาร้างของหมอยาเฒ่า" },
  roadFoot: { th: "ถนนดินใต้ฝ่าเท้า" }, roadSky: { th: "ทางฟ้าและทางเดินของผู้บำเพ็ญ" },
  l1cStoneMarket: { th: "ตลาดลานหินสามแพร่ง" }, l1cTeaWagons: { th: "ทางเกวียนชาข้ามสันเขา" },
  l1cNinthBend: { th: "หมู่บ้านลับหลังโค้งที่เก้า" }, l1dMotherVillage: { th: "หมู่บ้านที่มีเรือนของแม่" },
  l2cValleyRoad: { th: "ถนนชาข้ามหุบ" }, l2cUnderRiver: { th: "ท้องน้ำใต้เนินหินปูน" },
  l2cEmptyHall: { th: "เนินร้างของสำนักลมเงียบ" }, l2dSisterTown: { th: "เมืองที่น้องกำลังจะออกเรือน" },
  l2dBrotherLand: { th: "หมู่บ้านที่พี่น้องไม่เคยออกไป" }, l3cScribeDig: { th: "หลุมขุดริมแม่น้ำ" },
  l3cSeasonGate: { th: "หุบข้าวฟ่างทอง" }, l3cSandRoad: { th: "ทางคาราวานข้ามทะเลทรายเกลือ" },
  l3cDriftIsle: { th: "เกาะว่าวเหนือตลาดยอดเข็ม" }, l3dOldKitchen: { th: "หมู่บ้านที่มีเรือนมุงจากของมารดา" },
  l4cRisenIsle: { th: "เกาะพีชกลางทะเลสาบ" }, l4cEastShip: { th: "เรือสำเภาและเกาะตะวันออก" },
  l4cSpineStair: { th: "ทางแพะบนสันเขากระดูก" }, l4dRiverHouse: { th: "เมืองเล็กริมคลอง" },
  l4dOldTown: { th: "เมืองเล็กริมน้ำที่มีเรือนต้นพลับ" }, l4eHall: { th: "หอปีเสมอแห่งหุบหมิงเหยียน" },
  l4eRoots: { th: "รากต้นการบูรเฒ่า" }, seaLife: { th: "ชีวิตบนสำเภากลางทะเล" },
  khanCamp: { th: "กระโจมของข่าน" }, dragonPalace: { th: "วังใต้สมุทร" },
  homeValley: { th: "หุบเขาต้นท้อ" }, sevenLocks: { th: "ซากสำนักเจ็ดกุญแจ" },
  blackWoodCliff: { th: "ผาไม้ดำ" }, demonLands: { th: "แดนมาร" }, demonVisit: { th: "แดนมาร" },
  voyageEastIsles: { th: "ล่องสำเภาสู่หมู่เกาะบูรพาสมุทร" },
  voyageWestDesert: { th: "ล่องสำเภาสู่ทวีปทรายประจิม" },
  voyageNorthFrost: { th: "ล่องสำเภาสู่ทวีปหิมะอุดร" },
  voyageSouthJungle: { th: "ล่องสำเภาสู่ทวีปพงไพรทักษิณ" },
  voyageHome: { th: "ล่องสำเภากลับมัชฌิมทวีป" },
};

const catalog = {
  meta,
  // data.js
  elements: D.ELEMENTS, basicElements: D.BASIC_ELEMENTS, specialElements: D.SPECIAL_ELEMENTS,
  rootTypes: D.ROOT_TYPES,
  reversedRoot: D.REVERSED_ROOT,   // NEW: r.root.rev support
  seenRoot: D.SEEN_ROOT,           // NEW: what a reversed root wears
  regions: D.REGIONS,
  structures: D.STRUCTURES.map((x) => pick(x, ["id", "th", "en"])),
  classes: D.CLASSES.map((x) => pick(x, ["id", "region", "wealth", "rootChance", "discovery", "th", "en"])),
  sinews: D.SINEWS.map((x) => pick(x, ["id", "th", "en", "speed", "life", "weight"])),
  realms: D.REALMS, legacyLifespan: D.LEGACY_LIFESPAN,
  stageNames: D.STAGE_NAMES, stageLabels: D.STAGE_LABELS,
  activities: D.ACTIVITIES, focuses: D.FOCUSES, focusPower: D.FOCUS_POWER, focusInSect: D.FOCUS_IN_SECT,
  grabObjects: D.GRAB_OBJECTS, homes: D.HOMES, places: D.PLACES, seasons: D.SEASONS,
  hiddenTraits: D.HIDDEN_TRAITS, hiddenOdds: D.HIDDEN_ODDS,
  talentCountWeights: D.TALENT_COUNT_WEIGHTS, talentClash: D.TALENT_CLASH, talents: D.TALENTS,
  surnames: D.SURNAMES, givenNames: D.GIVEN_NAMES,
  // create.js
  create: { bg: CR.CREATE_BG, root: CR.CREATE_ROOT, sinew: CR.CREATE_SINEW, fate: CR.CREATE_FATE, mouths: CR.MOUTHS },
  createPoints: CR.CREATE_POINTS, rootCount: CR.ROOT_COUNT, mouthNames: CR.MOUTH_NAMES,
  // growth.js
  cumYears: GR.CUM_YEARS, npcYears: GR.NPC_YEARS,
  rootTalent: GR.ROOT_TALENT, realmYears: GR.REALM_YEARS, rankYears: GR.RANK_YEARS,
  // martial.js / stat-norm.js / ascend-revive.js
  martialRanks: MA.MARTIAL_RANKS, martialCap: MA.MARTIAL_CAP, topRank: MA.TOP_RANK,
  statNorm: SN.STAT_NORM, immortalIdx: AR.IMMORTAL, reviveLine: AR.REVIVE_LINE,
  // continents & towns
  continents: Object.fromEntries(Object.entries(C.CONTINENTS).map(([id, c]) => [id, { th: c.th, en: c.en }])),
  towns: Object.fromEntries(Object.entries(T.TOWNS).map(([id, t]) => [id, pick(t, ["th", "en", "continent", "serves", "size"])])),
  ports: T.PORTS,
  // looks.js (full structural data — was stripped before by a regex bug)
  looks: {
    hairM: LU.HAIR_M, hairF: LU.HAIR_F,
    hairColors: LU.HAIR_COLORS, skins: LU.SKINS,
    eyeShapes: LU.EYE_SHAPES, eyeColors: LU.EYE_COLORS,
  },
  sectOutfits: LU.SECT_OUTFITS, roleOutfits: LU.ROLE_OUTFITS, classOutfits: LU.CLASS_OUTFITS,
  npcOrn: LU.NPC_ORN, demonSkins: LU.DEMON_SKINS,
  // create-traits.js (character-creation trait costs; also useful for checksFixable)
  traitCost: CT.TRAIT_COST,
  // beasts (from beasts-m.js — 4 mechanism puppets; other dungeon beasts not in catalog)
  beasts: {
    bronzeMan:  { th: "มนุษย์ทองแดง", en: "Bronze man" },
    bronzeGold: { th: "มนุษย์ทองแดงชุบทอง", en: "Gilded bronze man" },
    woodPuppet: { th: "หุ่นไม้กลไก", en: "Mechanism puppet" },
    swordSaint: { th: "หุ่นกระบี่ของปรมาจารย์", en: "The Sword Saint's puppet" },
  },
  // secret realms (from trip-events.js, extracted — too big to import)
  trips: TRIPS_TH,
  items: [], techniques: [], tiers: [],
};

// ---- items/techs (scan items.js + imports) — unchanged from v2 ----
const byId = { items: new Map(), techs: new Map() };
const addItem = (x, from) => { if (!x?.id || !x.th) return; byId.items.set(x.id, { id: x.id, slot: x.slot ?? x.kind ?? null, tier: x.tier ?? 0, th: x.th, en: x.en ?? "", dao: x.dao, sect: x.sect, martial: x.martial || undefined, from }); };
const addTech = (x, from) => { if (!x?.id || !x.th) return; byId.techs.set(x.id, { id: x.id, kind: x.kind, tier: x.tier ?? 0, element: x.element ?? null, th: x.th, en: x.en ?? "", dao: x.dao, sect: x.sect, martial: x.martial || undefined, demonic: x.demonic || undefined, from }); };
catalog.tiers = [{ th: "สามัญ", en: "Common" }, { th: "ขั้นมนุษย์", en: "Human grade" }, { th: "ขั้นปฐพี", en: "Earth grade" }, { th: "ขั้นฟ้า", en: "Sky grade" }, { th: "ขั้นสวรรค์", en: "Heaven grade" }, { th: "ขั้นเซียน", en: "Immortal grade" }];
catalog.slots = ["weapon", "armor", "accessory1", "accessory2", "treasure"];

try {
  const text = fs.readFileSync(path.join(src, "items.js"), "utf8");
  for (const m of text.matchAll(/^\s+it\("([^"]+)",\s*"([^"]+)",\s*(\d+),\s*"([^"]*)",\s*"([^"]*)"/gm)) addItem({ id: m[1], slot: m[2], tier: +m[3], th: m[4], en: m[5] }, "items");
  for (const m of text.matchAll(/^\s+tq\("([^"]+)",\s*"([^"]+)",\s*(\d+),\s*(null|"[^"]*"),\s*"([^"]*)",\s*"([^"]*)"/gm)) addTech({ id: m[1], kind: m[2], tier: +m[3], element: m[4] === "null" ? null : m[4].slice(1, -1), th: m[5], en: m[6] }, "items");
  meta.notes.push(`items.js: ${byId.items.size} items, ${byId.techs.size} techniques`);
} catch (e) { meta.notes.push("items.js scan failed: " + e.message); }

const opt = async (f, fn) => { try { const M = await load(f); meta.notes.push(`${f}: ${fn(M)}`); } catch { meta.notes.push(`${f}: SKIPPED`); } };
const tL = (list, from) => { list.forEach((x) => addTech(x, from)); return list.length + " techs"; };
const iL = (list, from) => { list.forEach((x) => addItem(x, from)); return list.length + " items"; };
await opt("arsenal.js", (M) => tL(M.ARSENAL_TECHNIQUES, "arsenal") + ", " + iL(M.ARSENAL_ITEMS, "arsenal"));
await opt("wuxia.js", (M) => tL(M.WUXIA_TECHNIQUES, "wuxia") + ", " + iL(M.WUXIA_ITEMS, "wuxia"));
await opt("local-arts.js", (M) => tL(M.LOCAL_TECHNIQUES, "local"));
await opt("demonic-arts.js", (M) => tL(M.DEMONIC_TECHNIQUES, "demonic"));
await opt("arts-wandering.js", (M) => tL(M.WANDERING_TECHNIQUES, "wandering"));
await opt("sect-ladder.js", (M) => tL(M.LADDER_TECHNIQUES, "ladder") + ", " + iL(M.LADDER_ITEMS, "ladder"));
await opt("craft-data.js", (M) => tL(M.CRAFT_TECHNIQUES, "craft") + ", " + iL(M.CRAFT_ITEMS, "craft"));
await opt("keepsakes.js", (M) => iL(M.KEEPSAKES, "keepsake"));

catalog.items = [...byId.items.values()];
catalog.techniques = [...byId.techs.values()];
catalog.itemSlots = ["weapon","armor","accessory","treasure","pill","supply","material","tool","talisman","keepsake"];

meta.notes.push(`looks.js: hair M ${LU.HAIR_M.length} / F ${LU.HAIR_F.length} (full structure), ${Object.keys(LU.SECT_OUTFITS).length} sects, ${Object.keys(LU.ROLE_OUTFITS).length} roles`);
meta.notes.push(`beasts: 4 puppets from beasts-m.js (full dungeon beasts not included)`);
meta.notes.push(`trips: ${Object.keys(TRIPS_TH).length} entries (hardcoded from trip-events.js)`);
meta.notes.push(`create-traits.js: traitCost ${Object.keys(CT.TRAIT_COST).join("/")}`);

fs.writeFileSync("catalog.js", "// Generated by export-catalog-v3.js — do not edit\nwindow.WOX_CATALOG = " + JSON.stringify(catalog) + ";\n");
console.log(meta.notes.join("\n"));
console.log(`→ catalog.js: ${Object.keys(catalog.towns).length} towns, ${catalog.talents.length} talents, ${catalog.items.length} items, ${catalog.techniques.length} techniques, ${catalog.realms.length} realms, ${Object.keys(catalog.beasts).length} beasts, ${Object.keys(catalog.trips).length} trips`);
