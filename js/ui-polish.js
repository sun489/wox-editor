// ui-polish.js — ชั้นปรับ UX เสริม (ไม่แตะ logic ใน app.js / wox-io.js)
(() => {
  const root = document.documentElement;

  // 1) วัดความสูง header จริง เพื่อให้ sidebar และแผงขวาไม่ซ้อนทับเมื่อ header ขึ้นบรรทัดใหม่
  const header = document.querySelector(".top");
  if (header) {
    const syncTop = () => root.style.setProperty("--top-h", `${Math.ceil(header.getBoundingClientRect().height) + 16}px`);
    syncTop();
    if ("ResizeObserver" in window) new ResizeObserver(syncTop).observe(header);
    else window.addEventListener("resize", syncTop);
  }

  // 2) เมนูด้านซ้าย: app.js ใช้ aria-selected บน <button> (ไม่ถูกต้องตาม ARIA)
  //    ซิงก์เป็น aria-current="page" ให้ screen reader รู้ว่าหมวดไหนถูกเลือก
  const nav = document.getElementById("nav");
  if (nav) {
    const syncNav = () => nav.querySelectorAll(".nav-btn").forEach((b) => {
      if (b.getAttribute("aria-selected") === "true") b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    new MutationObserver(syncNav).observe(nav, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected"] });
    syncNav();
  }

  // 3) กรอบลากวางคลิกแล้วเปิดตัวเลือกไฟล์ได้
  document.addEventListener("click", (e) => {
    if (e.target.closest("#drop")) document.getElementById("file")?.click();
  });

  // 4) เลือกไฟล์ชื่อเดิมซ้ำได้ (ปกติ change จะไม่ยิงถ้าเลือกไฟล์เดิม)
  const fileInput = document.getElementById("file");
  fileInput?.addEventListener("click", (e) => { e.target.value = ""; });

})();
