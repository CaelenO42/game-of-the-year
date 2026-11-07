import { validatePassword } from "firebase/auth";
import { auth } from "./firebase";

const MIN_LENGTH = 8; // fallback
const RECOMMENDED_LENGTH = 12;

const MAX_PASSWORD_VISIBLE_CAP = 128;

export type Rule = { label: string, met: boolean };

export type PasswordCheck = {
    requirements: Rule[],   // block submit if any are unmet
    recommendations: Rule[] // nice to have
};

export async function checkPassword(password: string): Promise<PasswordCheck> {
    const status = await validatePassword(auth, password);
    const options = status.passwordPolicy.customStrengthOptions;

    const requirements: Rule[] = [];
    const recommendations: Rule[] = [];

    // Hard rules, from the Firebase policy
    const minLength = options.minPasswordLength ?? MIN_LENGTH;
    requirements.push({
        label: `At least ${minLength} characters`,
        met: status.meetsMinPasswordLength !== false && password.length >= minLength
    })
    if (options.maxPasswordLength && options.maxPasswordLength <= MAX_PASSWORD_VISIBLE_CAP) {
        requirements.push({
            label: `At most ${options.maxPasswordLength} characters.`,
            met: status.meetsMaxPasswordLength !== false
        });
    }

    const classes = [
        { label: "A lowercase letter", enforced: options.containsLowercaseLetter, met: status.containsLowercaseLetter, regex: /[a-z]/ },
        { label: "An uppercase letter", enforced: options.containsUppercaseLetter, met: status.containsUppercaseLetter, regex: /[A-Z]/ },
        { label: "A number (0-9)", enforced: options.containsNumericCharacter, met: status.containsNumericCharacter, regex: /\d/ },
        { label: "A symbol", enforced: options.containsNonAlphanumericCharacter, met: status.containsNonAlphanumericCharacter, regex: /[^a-zA-Z0-9]/ },
    ];
    for (const c of classes) {
        if (c.enforced) requirements.push({ label: c.label, met: c.met !== false });
        else recommendations.push({ label: c.label, met: c.regex.test(password) });
    }

    recommendations.push({
        label: `${RECOMMENDED_LENGTH}+ characters`,
        met: password.length >= RECOMMENDED_LENGTH
    });

    return { requirements, recommendations };
}
