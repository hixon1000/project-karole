"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BACKEND_URI } from "../../../lib/config";
import { ADMIN_TOKEN_KEY } from "../../../lib/admin-auth";
import styles from "./page.module.css";

export default function AdminLogin() {
    const router = useRouter();
    const [credentials, setCredentials] = useState({ username: "", password: "" });
    const [error, setError] = useState("");

    function updateField(event) {
        const { name, value } = event.target;
        setCredentials((current) => ({ ...current, [name]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (!credentials.username.trim() || !credentials.password) {
            setError("Enter a username and password to continue.");
            return;
        }

        setError("");
        try {
            const response = await fetch(`${BACKEND_URI}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams(credentials),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok) throw new Error(result?.detail || "Unable to sign in");
            sessionStorage.setItem(ADMIN_TOKEN_KEY, result.access_token);
            router.replace("/admin/playlist");
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    return (
        <main className={styles.page}>
            <section className={styles.panel}>
                <p className={styles.eyebrow}>Admin</p>
                <h1>Sign in</h1>
                <p className={styles.intro}>Admin authentication will connect to the API later.</p>
                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.field}>
                        <span>Username</span>
                        <input name="username" value={credentials.username} onChange={updateField} required />
                    </label>
                    <label className={styles.field}>
                        <span>Password</span>
                        <input
                            name="password"
                            type="password"
                            value={credentials.password}
                            onChange={updateField}
                            required
                        />
                    </label>
                    <button className={styles.submit} type="submit">Continue</button>
                    {error && <p className={styles.error} role="alert">{error}</p>}
                </form>
            </section>
        </main>
    );
}