import { FirebaseError, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyC1zI5EIxyMi5u40ksa11c8p0vX52sbY64",
    authDomain: "game-of-the-year-6113e.firebaseapp.com",
    projectId: "game-of-the-year-6113e",
    storageBucket: "game-of-the-year-6113e.firebasestorage.app",
    messagingSenderId: "1019693760011",
    appId: "1:1019693760011:web:d6cc7d33e7b2f20564510e",
    measurementId: "G-FPELFH109R",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export function firebaseErrorMessage(err: unknown): string {
    if (!(err instanceof FirebaseError)) return "Something went wrong. Please try again.";

    switch (err.code) {
        case "auth/invalid-credential":
            return "Incorrect email or password.";
        case "auth/email-already-in-use":
            return "An account with that email already exists.";
        case "auth/invalid-email":
            return "Enter a valid email address.";
        case "auth/weak-password":
            return "That password doesn't meet the requirements.";
        case "auth/too-many-requests":
            return "Too many attempts. Try again later.";
        case "auth/network-request-failed":
            return "Network error. Check your connection.";
        default:
            return "Something went wrong. Please try again.";
    }
}