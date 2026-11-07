import { signInWithEmailAndPassword } from "firebase/auth";
import { requireElement } from "../lib/dom";
import { auth, firebaseErrorMessage } from "../lib/firebase";
import { createSession } from "../lib/session";

const form = requireElement<HTMLFormElement>("#form");
const emailField = requireElement<HTMLInputElement>("#email");
const passwordField = requireElement<HTMLInputElement>("#password");
const submitButton = requireElement<HTMLButtonElement>("#submit");
const error = requireElement("#error");

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
        const credential = await signInWithEmailAndPassword(auth, email, password);
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
