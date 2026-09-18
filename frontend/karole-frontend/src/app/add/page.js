"use client";

import { useState, useSyncExternalStore } from "react";
import { BACKEND_URI } from "../../lib/config";
import Header from "../../components/header";
import styles from "./page.module.css";

const NAME_STORAGE_KEY = "karole-user-name";

function subscribeToAuthor(callback) {
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
}

function getSavedName() {
    return window.localStorage.getItem(NAME_STORAGE_KEY) || "";
}

function getServerAuthor() {
    return "";
}

export default function AddSong() {
    const [form, setForm] = useState({ url: "", name: "", author: "" });
    const [submittedName, setSubmittedName] = useState("");
    const [status, setStatus] = useState("idle");
    const [message, setMessage] = useState("");
    const savedName = useSyncExternalStore(subscribeToAuthor, getSavedName, getServerAuthor);
    const name = savedName || submittedName || form.name;
    const hasSavedName = Boolean(savedName || submittedName);

    function updateField(event) {
        const { name, value } = event.target;
        setForm((currentForm) => ({ ...currentForm, [name]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (!name.trim()) {
            setStatus("error");
            setMessage("Please enter your name before adding a song.");
            return;
        }

        setStatus("loading");
        setMessage("");

        try {
            const response = await fetch(`${BACKEND_URI}/playlist/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, name: name.trim() }),
            });
            const result = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(result?.detail || `Request failed with status ${response.status}`);
            }

            window.localStorage.setItem(NAME_STORAGE_KEY, name.trim());
            setForm({ ...form, name: name.trim() });
            setSubmittedName(name.trim());
            setStatus("success");
            setMessage(`Added "${result.url_title || "song"}" to the playlist.`);
        } catch (requestError) {
            setStatus("error");
            setMessage(requestError.message);
        }
    }

    return (
        <main className={styles.page}>
            <Header />
            <section className={styles.panel}>
                <div className={styles.heading}>
                    <p className={styles.eyebrow}>Add to playlist</p>
                    <h1>Add a song</h1>
                    <p className={styles.intro}>Add a YouTube track to the listening queue.</p>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.field}>
                        <span>YouTube URL</span>
                        <input
                            name="url"
                            type="url"
                            value={form.url}
                            onChange={updateField}
                            placeholder="https://youtube.com/watch?v=..."
                            maxLength={100}
                            required
                        />
                    </label>

                    <label className={styles.field}>
                        <span>Your name</span>
                        <input
                            name="name"
                            type="text"
                            value={name}
                            onChange={updateField}
                            placeholder="Your name"
                            maxLength={30}
                            readOnly={hasSavedName}
                            required
                        />
                    </label>

                    <label className={styles.field}>
                        <span>Author name</span>
                        <input
                            name="author"
                            type="text"
                            value={form.author}
                            onChange={updateField}
                            placeholder="Song author"
                            maxLength={30}
                            required
                        />
                    </label>

                    <button className={styles.submit} type="submit" disabled={status === "loading"}>
                        {status === "loading" ? "Adding song..." : "Add to playlist"}
                    </button>

                    {message && (
                        <p className={status === "error" ? styles.error : styles.success} role="status">
                            {message}
                        </p>
                    )}
                </form>
            </section>
        </main>
    );
}