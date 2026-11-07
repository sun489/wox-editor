// catalog-extra.js — 2026-11-07
// ตารางที่ไม่อยู่ใน catalog.js (ซึ่งเป็นไฟล์ generated) — โหลดหลัง catalog.js
// และก่อน app.js. ทุกคีย์เป็น optional: consumer ต้องทนได้ถ้าไม่มีไฟล์นี้
(() => {
  const C = window.WOX_CATALOG;
  if (!C) return;

  // ---- Per-role mortal stat baseline (npc-preview.js ใช้ตอน NPC ยังไม่มี realm) ----
  C.npcStats ??= {};
  C.npcStats.mortalBase ??= {
    soldier: { body: 55, mind: 45, will: 55, charm: 45, luck: 50 },
    guard:   { body: 55, mind: 45, will: 55, charm: 45, luck: 50 },
    general: { body: 65, mind: 55, will: 60, charm: 55, luck: 50 },
    hunter:  { body: 55, mind: 50, will: 50, charm: 45, luck: 55 },
    scholar: { body: 45, mind: 60, will: 50, charm: 50, luck: 50 },
    official:{ body: 45, mind: 60, will: 55, charm: 55, luck: 55 },
    noble:   { body: 45, mind: 55, will: 50, charm: 55, luck: 50 },
    royal:   { body: 45, mind: 55, will: 50, charm: 60, luck: 55 },
    emperor: { body: 50, mind: 60, will: 60, charm: 65, luck: 60 },
    bandit:  { body: 55, mind: 45, will: 55, charm: 40, luck: 45 },
    banditChief: { body: 60, mind: 55, will: 60, charm: 50, luck: 50 },
    farmer:  { body: 55, mind: 45, will: 55, charm: 50, luck: 50 },
    merchant:{ body: 45, mind: 55, will: 50, charm: 55, luck: 55 },
    artisan: { body: 50, mind: 55, will: 50, charm: 50, luck: 50 },
    craftsman:{ body: 55, mind: 50, will: 55, charm: 45, luck: 50 },
    doctor:  { body: 45, mind: 60, will: 55, charm: 55, luck: 50 },
    herbalist:{ body: 45, mind: 55, will: 50, charm: 55, luck: 55 },
    innkeeper:{ body: 50, mind: 50, will: 50, charm: 60, luck: 55 },
    courtesan:{ body: 45, mind: 50, will: 45, charm: 75, luck: 55 },
    thug:    { body: 55, mind: 40, will: 50, charm: 40, luck: 45 },
    traveler:{ body: 50, mind: 50, will: 55, charm: 50, luck: 55 },
    rogue:   { body: 55, mind: 55, will: 55, charm: 50, luck: 55 },
    hermit:  { body: 50, mind: 65, will: 70, charm: 45, luck: 55 },
    hiddenMaster:{ body: 55, mind: 70, will: 75, charm: 50, luck: 60 },
    evilMaster:  { body: 60, mind: 60, will: 70, charm: 45, luck: 50 },
    evilDisciple:{ body: 55, mind: 50, will: 55, charm: 45, luck: 50 },
    sect:    { body: 55, mind: 55, will: 55, charm: 50, luck: 50 },
    family:  { body: 50, mind: 50, will: 50, charm: 50, luck: 50 },
    demonSovereign:{ body: 80, mind: 80, will: 80, charm: 75, luck: 70 },
    demonPrince:  { body: 70, mind: 70, will: 70, charm: 70, luck: 65 },
    demonFolk:    { body: 55, mind: 55, will: 55, charm: 50, luck: 50 },
  };
})();