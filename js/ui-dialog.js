// ui-dialog.js — กล่องยืนยัน/กรอกข้อความในธีมเดียวกับแอป (แทน confirm() / prompt() ของเบราว์เซอร์)
// ใช้: await Dialog.confirm("ข้อความ", { danger: true })  -> true | false
//      await Dialog.prompt("ข้อความ", "ค่าเริ่มต้น")        -> string | null
//
// v2 (2026-11-07): เปลี่ยน aria-label → aria-labelledby บน input ในโหมด prompt
//   เพื่อไม่ให้ screen reader อ่านข้อความซ้ำสองครั้ง (มี <p id="dlg-msg"> อยู่แล้ว)
(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

  function open({ message, title = "ยืนยัน", okText = "ตกลง", cancelText = "ยกเลิก", danger = false, input = false, defaultValue = "" }) {
    return new Promise((resolve) => {
      const prevFocus = document.activeElement;
      const ov = document.createElement("div");
      ov.className = "dlg-overlay";
      ov.innerHTML = `
        <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg">
          <h3 id="dlg-title">${esc(title)}</h3>
          <p id="dlg-msg" class="dlg-msg">${esc(message)}</p>
          ${input ? `<input type="text" class="dlg-input" id="dlg-input" value="${esc(defaultValue)}" autocomplete="off" aria-labelledby="dlg-msg">` : ""}
          <div class="dlg-actions">
            <button type="button" class="btn ghost" data-r="cancel">${esc(cancelText)}</button>
            <button type="button" class="btn ${danger ? "danger" : "primary"}" data-r="ok">${esc(okText)}</button>
          </div>
        </div>`;
      document.body.appendChild(ov);

      const field = ov.querySelector("#dlg-input");
      const finish = (ok) => {
        ov.remove();
        if (prevFocus && prevFocus.isConnected) prevFocus.focus();
        if (input) resolve(ok ? field.value : null);
        else resolve(ok);
      };

      // เหตุการณ์คีย์บอร์ดหยุดที่กล่องนี้ ไม่ให้ทะลุไปถึงทางลัดของแอป (เช่น Ctrl+Z ขณะพิมพ์)
      ov.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Escape") { e.preventDefault(); finish(false); }
        else if (e.key === "Enter" && (input || e.target.dataset.r === "ok" || e.target.dataset.r === "cancel")) {
          e.preventDefault();
          finish(e.target.dataset.r === "cancel" ? false : true);
        }
        else if (e.key === "Tab") {
          // วนโฟกัสอยู่ในกล่อง
          const items = [...ov.querySelectorAll(FOCUSABLE)];
          const first = items[0], last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });
      ov.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-r]");
        if (btn) finish(btn.dataset.r === "ok");
        else if (e.target === ov) finish(false);
      });

      // โฟกัสเริ่มต้น: ช่องกรอกถ้ามี, ไม่งั้นปุ่มยกเลิกสำหรับการลบ (กันกดพลาด), ไม่งั้นปุ่มตกลง
      (field ?? (danger ? ov.querySelector('[data-r="cancel"]') : ov.querySelector('[data-r="ok"]'))).focus();
      if (field) field.select();
    });
  }

  globalThis.Dialog = {
    confirm: (message, opts = {}) => open({ message, ...opts }),
    prompt: (message, defaultValue = "") => open({ message, input: true, defaultValue, okText: "ตกลง" }),
  };
})();