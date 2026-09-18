"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BACKEND_URI } from "../../../lib/config";
import { adminFetch, ADMIN_TOKEN_KEY } from "../../../lib/admin-auth";
import styles from "./page.module.css";

export default function AdminView() {
    const router = useRouter();
    const videoRef = useRef(null);
    const [playback, setPlayback] = useState({ playing: false, song: null });
    const [error, setError] = useState("");
    const songId = playback.song?.p_id;
    const token = typeof window !== "undefined" ? window.sessionStorage.getItem(ADMIN_TOKEN_KEY) || "" : "";
    const source = songId != null && token
        ? `${BACKEND_URI}/playlist/playback-stream?token=${encodeURIComponent(token)}`
        : "";

    useEffect(() => {
        if (!sessionStorage.getItem(ADMIN_TOKEN_KEY)) {
            router.replace("/admin/login");
            return undefined;
        }

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
    }, [router]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !source) return;
        if (playback.playing) {
            video.play().catch(() => setError("Playback was blocked. Press play to start the video."));
        } else {
            video.pause();
        }
    }, [playback.playing, source]);

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

    // Autoplay video automatically when a new song is loaded.
    // This effect watches for changes to the `song` object. When a song
    // becomes available (e.g., after skip/back/jump), we attempt to play
    // the video and ensure the playback state reflects that it is playing.
    useEffect(() => {
        if (song && videoRef.current) {
            // Attempt to start playback; handle possible autoplay block.
            videoRef.current.play().catch(() => setError("Playback was blocked. Press play to start the video."));
            // Update state to mark as playing if not already.
            setPlayback((prev) => ({ ...prev, playing: true }));
        }
    }, [song]);

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
