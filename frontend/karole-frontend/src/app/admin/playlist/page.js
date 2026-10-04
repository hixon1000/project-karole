"use client";

import { useEffect, useState } from "react";
import { BACKEND_URI } from "../../../lib/config";
import { adminFetch, logOut } from "../../../lib/admin-auth";
import AdminHeader from "../../../components/admin-header";
import styles from "./page.module.css";

// Shows a length in seconds as minutes:seconds, for example 3725 becomes "62:05".
function formatDuration(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function AdminPlaylist() {
    const [songs, setSongs] = useState([]);
    const [status, setStatus] = useState("loading");
    const [error, setError] = useState("");
    const [playback, setPlayback] = useState({ playing: false, song: null });
    const [openMenu, setOpenMenu] = useState(null);
    const [draggedId, setDraggedId] = useState(null);
    const [targetPositions, setTargetPositions] = useState({});

    useEffect(() => {
        let isActive = true;

        async function loadPlaylist() {
            try {
                // The playlist route is public but this one needs a login, so it is also what
                // notices a missing or expired one; adminFetch then goes to the login page.
                const playbackResponse = await adminFetch(`${BACKEND_URI}/playlist/current-play`, { cache: "no-store" });
                const response = await adminFetch(`${BACKEND_URI}/playlist/`, { cache: "no-store" });
                if (!playbackResponse.ok || !response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }
                const nextPlayback = await playbackResponse.json();
                const playlist = await response.json();
                if (isActive) {
                    setPlayback(nextPlayback);
                    setSongs(playlist.sort((first, second) => first.order_num - second.order_num));
                    setStatus("ready");
                    setError("");
                }
            } catch (requestError) {
                if (isActive) {
                    setError(requestError.message);
                    setStatus("error");
                }
            }
        }

        loadPlaylist();
        const refreshTimer = window.setInterval(loadPlaylist, 5000);
        return () => {
            isActive = false;
            window.clearInterval(refreshTimer);
        };
    }, []);

    async function refreshPlaylist() {
        const response = await adminFetch(`${BACKEND_URI}/playlist/`, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        setSongs((await response.json()).sort((first, second) => first.order_num - second.order_num));
        // Deleting or re-queueing songs can change what is playing.
        await refreshPlayback();
    }

    async function refreshPlayback() {
        const response = await adminFetch(`${BACKEND_URI}/playlist/current-play`, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        setPlayback(await response.json());
    }

    // Back, play/pause and skip: the same backend routes the player page uses.
    async function control(path) {
        setError("");
        try {
            const response = await adminFetch(`${BACKEND_URI}/playlist/${path}`, { method: "POST" });
            const result = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(result?.detail || `Request failed with status ${response.status}`);
            }
            await refreshPlayback();
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    async function updatePlaylist(url, options) {
        setError("");
        try {
            const response = await adminFetch(`${BACKEND_URI}${url}`, options);
            const result = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(result?.detail || `Request failed with status ${response.status}`);
            }
            await refreshPlaylist();
            setOpenMenu(null);
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    async function jumpSong(song) {
        setError("");
        try {
            const response = await adminFetch(`${BACKEND_URI}/playlist/jump`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order_num: song.order_num }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(result?.detail || `Request failed with status ${response.status}`);
            }
            setPlayback(result);
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    function moveSong(songId, targetIndex) {
        if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= songs.length) return;
        const song = songs.find((entry) => entry.p_id === songId);
        if (!song || song.order_num === targetIndex) return;
        updatePlaylist("/playlist/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ p_id: songId, order_num: targetIndex }),
        });
    }

    function swapSong(songId, targetPosition) {
        const targetIndex = Number(targetPosition) - 1;
        const song = songs.find((entry) => entry.p_id === songId);
        if (!song || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= songs.length) return;
        updatePlaylist("/playlist/swap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ original: song.order_num, swap: targetIndex }),
        });
    }

    function deleteSong(song) {
        if (!window.confirm(`Delete "${song.url_title}" from the playlist?`)) return;
        updatePlaylist(`/playlist/delete?playlist_id=${song.p_id}`, { method: "DELETE" });
    }

    function flushPlaylist() {
        if (!window.confirm("WARNING: this permanently deletes every song in the playlist.")) return;
        updatePlaylist("/playlist/flush", { method: "DELETE" });
    }

    function updateTarget(songId, value) {
        setTargetPositions((current) => ({ ...current, [songId]: value }));
    }

    let nowPlayingText = "Nothing is playing";
    if (playback.song) {
        nowPlayingText = `${playback.playing ? "Playing" : "Paused"}: ${playback.song.url_title}`;
    }

    return (
        <main className={styles.page}>
            <AdminHeader />
            <section className={styles.panel}>
                <div className={styles.heading}>
                    <div>
                        <p className={styles.eyebrow}>Admin / Playlist</p>
                        <h1>Manage playlist</h1>
                    </div>
                    <button className={styles.signOut} onClick={logOut}>Sign out</button>
                </div>

                <div className={styles.controls}>
                    <p className={styles.nowPlaying}>{nowPlayingText}</p>
                    <div className={styles.controlButtons}>
                        <button type="button" onClick={() => control("back")} aria-label="Previous song">Back</button>
                        <button type="button" onClick={() => control("play_pause")}>
                            {playback.playing ? "Pause" : "Play"}
                        </button>
                        <button type="button" onClick={() => control("skip")} aria-label="Next song">Skip</button>
                    </div>
                </div>

                {error && <p className={styles.error} role="alert">{error}</p>}
                {songs.filter((song) => song.is_too_long).map((song) => (
                    <div className={styles.notice} role="alert" key={song.p_id}>
                        <p>
                            &quot;{song.url_title}&quot; added by {song.name} is {formatDuration(song.duration)} long,
                            which is over the limit.
                        </p>
                        <div className={styles.noticeActions}>
                            <button onClick={() => updatePlaylist(`/playlist/delete?playlist_id=${song.p_id}`, { method: "DELETE" })}>
                                Skip song
                            </button>
                            <button onClick={() => updatePlaylist(`/playlist/keep?playlist_id=${song.p_id}`, { method: "POST" })}>
                                Keep
                            </button>
                        </div>
                    </div>
                ))}
                {status === "loading" && <p className={styles.message}>Loading playlist...</p>}
                {status === "ready" && songs.length === 0 && <p className={styles.message}>No songs in the playlist.</p>}
                {status === "ready" && songs.length > 0 && (
                    <div className={styles.tableWrap}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Name</th>
                                    <th>Channel</th>
                                    <th>Song</th>
                                    <th>Author</th>
                                    <th aria-label="Actions" />
                                </tr>
                            </thead>
                            <tbody>
                                {songs.map((song, index) => (
                                    <tr
                                        className={draggedId === song.p_id ? styles.dragging : ""}
                                        key={song.p_id}
                                        draggable
                                        onClick={(event) => {
                                            if (draggedId !== null || event.target.closest("button, input, a")) return;
                                            jumpSong(song);
                                        }}
                                        onDragStart={() => setDraggedId(song.p_id)}
                                        onDragEnd={() => setDraggedId(null)}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={() => {
                                            moveSong(draggedId, index);
                                            setDraggedId(null);
                                        }}
                                    >
                                        <td className={styles.order}>{index + 1}</td>
                                        <td>{song.name}</td>
                                        <td>
                                            <div className={styles.channel}>
                                                {/* Fallback: transparent 1x1 SVG if icon URL missing */}
                                                <img
                                                    className={styles.channelIcon}
                                                    src={song.url_channel_icon || "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjwvc3ZnPg=="}
                                                    alt=""
                                                    onError={(e) => {
                                                        // If the provided URL fails to load, replace with transparent placeholder.
                                                        e.currentTarget.src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjwvc3ZnPg==";
                                                    }}
                                                />
                                                <span className={styles.channelName}>{song.url_creator}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <a className={styles.songLink} href={song.url} target="_blank" rel="noreferrer">
                                                {song.url_title}
                                            </a>
                                        </td>
                                        <td>{song.author}</td>
                                        <td className={styles.actionCell}>
                                <button
                                    className={styles.menuButton}
                                    aria-label={`Actions for ${song.url_title}`}
                                    aria-expanded={openMenu === song.p_id}
                                    onClick={() => setOpenMenu(openMenu === song.p_id ? null : song.p_id)}
                                >
                                    ...
                                </button>
                                {openMenu === song.p_id && (
                                    <div className={styles.menu}>
                                        <button onClick={() => moveSong(song.p_id, index - 1)} disabled={index === 0}>Move up</button>
                                        <button onClick={() => moveSong(song.p_id, index + 1)} disabled={index === songs.length - 1}>Move down</button>
                                        <label>
                                            Move to
                                            <input
                                                type="number"
                                                min="1"
                                                max={songs.length}
                                                value={targetPositions[song.p_id] || ""}
                                                onChange={(event) => updateTarget(song.p_id, event.target.value)}
                                            />
                                            <button onClick={() => moveSong(song.p_id, Number(targetPositions[song.p_id]) - 1)}>Move</button>
                                        </label>
                                        <label>
                                            Swap with
                                            <input
                                                type="number"
                                                min="1"
                                                max={songs.length}
                                                value={targetPositions[`swap-${song.p_id}`] || ""}
                                                onChange={(event) => updateTarget(`swap-${song.p_id}`, event.target.value)}
                                            />
                                            <button onClick={() => swapSong(song.p_id, targetPositions[`swap-${song.p_id}`])}>Swap</button>
                                        </label>
                                        <button className={styles.delete} onClick={() => deleteSong(song)}>Delete</button>
                                    </div>
                                )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className={styles.dangerZone}>
                    <p>Destructive actions</p>
                    <button className={styles.flushButton} onClick={flushPlaylist}>
                        Flush playlist database
                    </button>
                </div>
            </section>
        </main>
    );
}