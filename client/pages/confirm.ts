import { requireElement } from "../lib/dom";

const dialog = requireElement<HTMLDialogElement>("#confirm-dialog");
const text = requireElement("#confirm-text");
const okButton = requireElement<HTMLButtonElement>("#confirm-ok");
const cancelButton = requireElement<HTMLButtonElement>("#confirm-cancel");

type ConfirmDetail = {
    question: string | null;
    issueRequest: (skipConfirmation?: boolean) => void;
};

let pending: (() => void) | null = null;

document.body.addEventListener("htmx:confirm", (e) => {
    const detail = (e as CustomEvent<ConfirmDetail>).detail;
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

dialog.addEventListener("close", () => { pending = null; });

dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
});
