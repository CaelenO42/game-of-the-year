import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { requireElement } from "../lib/dom";
import { auth, firebaseErrorMessage } from "../lib/firebase";
import { createSession } from "../lib/session";
import { checkPassword } from "../lib/password";

const form = requireElement<HTMLFormElement>("#form");
const emailField = requireElement<HTMLInputElement>("#email");
const passwordField = requireElement<HTMLInputElement>("#password");
const passwordHint = requireElement("#password-hint");
const confirmPasswordField = requireElement<HTMLInputElement>("#confirm-password");
const submitButton = requireElement<HTMLButtonElement>("#submit");
const error = requireElement("#error");

passwordField.addEventListener("input", () => {
    verifyPassword().catch(console.error);
    verifyMatch();
});
confirmPasswordField.addEventListener("input", verifyMatch);

let latestCheck = 0;

async function verifyPassword(): Promise<boolean> {
    const id = ++latestCheck;
    const { requirements, recommendations } = await checkPassword(passwordField.value);
    if (id !== latestCheck) return requirements.length === 0;

    passwordField.setCustomValidity(requirements[0]?.label ?? "");

    // Show every problem at once: required fixes first, then optional tips.
    const items = [
        ...requirements.map((rule) => ({ rule, className: "error" })),
        ...recommendations.map((rule) => ({ rule, className: "suggestion" })),
    ].map(({ rule, className }) => {
        const li = document.createElement("li");
        li.textContent = rule.label;
        li.classList.add(className, rule.met ? "pass" : "fail");
        return li;
    });

    passwordHint.replaceChildren(...items);
    return requirements.length === 0;
}

function verifyMatch(): boolean {
    const matches = passwordField.value === confirmPasswordField.value;
    confirmPasswordField.setCustomValidity(matches ? "" : "Passwords must match.");
    return matches;
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.textContent = "";

    const email = emailField.value.trim();
    const password = passwordField.value;
    if (!email || !password) {
        error.textContent = "Enter your email and password.";
        return;
    }

    submitButton.disabled = true;

    try {
        if (!await verifyPassword()) return;
        if (!verifyMatch()) {
            error.textContent = "Passwords must match.";
            return;
        }

        const credential = await createUserWithEmailAndPassword(auth, email, password);
        sendEmailVerification(credential.user).catch(console.error);
        const session = await createSession(credential.user);

        if (!session.ok) {
            error.textContent = session.error;
            return;
        }
        window.location.href = session.redirect;
    } catch (err) {
        console.error(err);
        error.textContent = firebaseErrorMessage(err);
    } finally {
        submitButton.disabled = false;
    }
});
