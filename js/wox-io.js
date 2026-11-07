// wox-io.js — อ่าน/เขียนไฟล์ .wox ให้ตรงกับเกม
//
// รูปแบบไฟล์ (ตรวจกับไฟล์เซฟจริง way-of-xian--.wox แล้ว ถอดรหัสได้ JSON ครบ):
//     .wox  =  gzip( "WOX1" + checksum(8 hex) + "~" + JSON ที่สลับตัวอักษรด้วย turn() )
//     .json =  "WOX1" + checksum + "~" + ...   (ไม่บีบอัด: เกมบน iPhone/iPad)
//
// seal/unseal ให้ผลลัพธ์ไบต์เดียวกับ src/save-seal.js ของเกม (ทดสอบแล้ว)
// ห้ามแก้ logic ของ turn/hash โดยไม่ตรวจกับเกมก่อน
// (ไม่ใช่ ES module เพื่อให้เปิดจากไฟล์ตรงๆ ได้ ผลลัพธ์อยู่ที่ globalThis.WoxIO)
//
// v2 (2026-11-07): writeWox มี try/catch — ถ้า save มี circular reference จะได้ error ภาษาไทย
(() => {
  const MARK = "WOX1", SEP = "~", LO = 33, SPAN = 94;

  function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  const TABLES = [1, -1].map((dir) =>
    Array.from({ length: SPAN }, (_, k) =>
      Array.from({ length: SPAN }, (_, c) => LO + ((c + dir * ((k * 7 + 13) % SPAN) + SPAN * 2) % SPAN))
    )
  );
  function turn(text, dir) {
    const tab = TABLES[dir > 0 ? 0 : 1], n = text.length, codes = new Uint16Array(n);
    for (let i = 0, k = 0; i < n; i++, k = k === SPAN - 1 ? 0 : k + 1) {
      const c = text.charCodeAt(i);
      codes[i] = c >= LO && c < LO + SPAN ? tab[k][c - LO] : c;
    }
    let out = "";
    for (let at = 0; at < n; at += 8192) out += String.fromCharCode.apply(null, codes.subarray(at, at + 8192));
    return out;
  }
  function seal(text) {
    if (typeof text !== "string" || text.startsWith(MARK)) return text;
    return `${MARK}${hash(text)}${SEP}${turn(text, 1)}`;
  }
  function unseal(text) {
    if (typeof text !== "string" || !text.startsWith(MARK)) return text;
    const sum = text.slice(MARK.length, MARK.length + 8);
    const plain = turn(text.slice(MARK.length + 9), -1);
    return hash(plain) === sum ? plain : null;
  }

  // ---- gzip (CompressionStream: Chrome/Edge/Firefox/Safari 16.4+) ----
  async function pipe(bytes, stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }
  // เบราว์เซอร์เก่า (เช่น Safari < 16.4) ไม่มี API นี้ ให้ข้อความที่อ่านรู้เรื่องแทนการพังเงียบ
  function needStreams() {
    if (typeof CompressionStream === "undefined" || typeof DecompressionStream === "undefined" || typeof Blob.prototype.stream !== "function")
      throw new Error("เบราว์เซอร์นี้เก่าเกินไปสำหรับไฟล์ .wox กรุณาอัปเดตเบราว์เซอร์ (Safari 16.4 ขึ้นไป หรือ Chrome / Edge / Firefox รุ่นล่าสุด)");
  }
  const gzip = (bytes) => { needStreams(); return pipe(bytes, new CompressionStream("gzip")); };
  const gunzip = (bytes) => { needStreams(); return pipe(bytes, new DecompressionStream("gzip")); };
  const isGzip = (b) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;

  // bytes -> { save, wrapped }  ("gzip" | "plain"); throws Error with a Thai message
  async function readWox(buffer) {
    let bytes = new Uint8Array(buffer), wrapped = "plain";
    if (isGzip(bytes)) { bytes = await gunzip(bytes); wrapped = "gzip"; }
    let text = new TextDecoder("utf-8").decode(bytes).trim();
    if (text.startsWith(MARK)) {
      const plain = unseal(text);
      if (plain === null) throw new Error("checksum ไม่ตรง: ไฟล์ถูกแก้หรือเสียหาย");
      text = plain;
    }
    if (!text.startsWith("{")) throw new Error("ไม่ใช่ไฟล์เซฟของเกม (.wox)");
    let save;
    try { save = JSON.parse(text); } catch { throw new Error("ไฟล์เสียหาย: อ่านข้อมูลเซฟไม่ได้"); }
    return { save, wrapped };
  }

  // save object -> Uint8Array ready to download as .wox
  async function writeWox(save, wrapped = "gzip") {
    let sealed;
    try { sealed = seal(JSON.stringify(save)); }
    catch (err) { throw new Error("แปลงข้อมูลเป็น JSON ไม่ได้ (อาจมี reference วนกลับ): " + err.message); }
    const bytes = new TextEncoder().encode(sealed);
    return wrapped === "gzip" ? gzip(bytes) : bytes;
  }

  globalThis.WoxIO = { seal, unseal, hash, readWox, writeWox, gzip, gunzip, isGzip };
})();