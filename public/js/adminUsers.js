// client/lib/dom.ts
function requireElement(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

// client/pages/adminUsers.ts
var dialog = requireElement("#confirm-dialog");
var text = requireElement("#confirm-text");
var okButton = requireElement("#confirm-ok");
var cancelButton = requireElement("#confirm-cancel");
var pending = null;
document.body.addEventListener("htmx:confirm", (e) => {
  const detail = e.detail;
  if (!detail.question) return;
  e.preventDefault();
  text.textContent = detail.question;
  pending = () => detail.issueRequest(true);
  dialog.showModal();
});
okButton.addEventListener("click", () => {
  const run = pending;
  pending = null;
  dialog.close();
  run?.();
});
cancelButton.addEventListener("click", () => {
  pending = null;
  dialog.close();
});
dialog.addEventListener("close", () => {
  pending = null;
});
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});
