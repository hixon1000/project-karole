"use client";

import { useEffect, useRef, useState } from "react";
import { BACKEND_URI } from "../../../lib/config";
import { adminFetch } from "../../../lib/admin-auth";
import styles from "./page.module.css";

export default function AdminView() {
    const videoRef = useRef(null);
    const [playback, setPlayback] = useState({ playing: false, song: null });
    const [error, setError] = useState("");
    const songId = playback.song?.p_id;
    // The browser sends the login cookie with the video request by itself.
    const source = songId != null ? `${BACKEND_URI}/playlist/playback-stream` : "";

    useEffect(() => {
        let isActive = true;

        async function pollPlayback() {
            try {
                const response = await adminFetch(`${BACKEND_URI}/playlist/current-play`, { cache: "no-store" });
                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }
                const nextPlayback = await response.json();
                if (isActive) {
                    setPlayback(nextPlayback);
                    setError("");
                }
            } catch (requestError) {
                if (isActive) setError(requestError.message);
            }
        }

        pollPlayback();
        const timer = window.setInterval(pollPlayback, 500);
        return () => {
            isActive = false;
            window.clearInterval(timer);
        };
    }, []);

    // songId is a dependency because every song gets a fresh <video> element
    // (see the key below), and that new element has to be started too.
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !source) return;
        if (playback.playing) {
            video.play().catch(() => setError("Playback was blocked. Press play to start the video."));
        } else {
            video.pause();
        }
    }, [playback.playing, source, songId]);

    async function control(path) {
        try {
            const response = await adminFetch(`${BACKEND_URI}/playlist/${path}`, { method: "POST" });
            const nextPlayback = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(nextPlayback?.detail || `Request failed with status ${response.status}`);
            }
            if (path === "play_pause") {
                setPlayback((current) => ({ ...current, playing: nextPlayback }));
            } else {
                setPlayback(nextPlayback);
            }
            setError("");
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    const song = playback.song;

    return (
        <main className={styles.page}>
            <section className={styles.playerArea} aria-label="Playback view">
                {song && source && (
                    <video
                        key={song.p_id}
                        ref={videoRef}
                        className={styles.player}
                        src={source}
                        title={song.url_title}
                        playsInline
                        preload="auto"
                        controls
                        onEnded={() => control("skip")}
                    />
                )}
                {song && <p className={styles.songTitle}>{song.url_title}</p>}
                {error && <p className={styles.error} role="alert">{error}</p>}
            </section>
            <footer className={`${styles.controls} ${playback.playing && song ? styles.playing : ""}`}>
                <button type="button" onClick={() => control("back")} aria-label="Previous song">Back</button>
                <button type="button" onClick={() => control("play_pause")} aria-label={playback.playing ? "Pause" : "Play"}>
                    {playback.playing ? "Pause" : "Play"}
                </button>
                <button type="button" onClick={() => control("skip")} aria-label="Next song">Skip</button>
            </footer>
        </main>
    );
}
