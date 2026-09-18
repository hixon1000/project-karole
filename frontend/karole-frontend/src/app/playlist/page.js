"use client";

import { useEffect, useState } from "react";
import { BACKEND_URI } from "../../lib/config";
import Header from "../../components/header";
import styles from "./page.module.css";

export default function Playlist() {
    const [songs, setSongs] = useState([]);
    const [status, setStatus] = useState("loading");
    const [error, setError] = useState("");

    useEffect(() => {
        let isActive = true;

        async function loadPlaylist() {
            try {
                const response = await fetch(`${BACKEND_URI}/playlist/`, {
                    cache: "no-store",
                });
                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }
                const playlist = await response.json();
                if (isActive) {
                    setSongs(playlist);
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

    return (
        <main className={styles.page}>
            <Header />
            <section className={styles.panel}>

                {status === "loading" && <p className={styles.message}>Loading playlist...</p>}
                {status === "error" && <p className={styles.error}>{error}</p>}
                {status === "ready" && songs.length === 0 && (
                    <p className={styles.message}>No songs in the playlist.</p>
                )}
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
                                </tr>
                            </thead>
                            <tbody>
                                {songs
                                    .slice()
                                    .sort((first, second) => first.order_num - second.order_num)
                                    .map((song, index) => (
                                        <tr key={song.p_id}>
                                            <td className={styles.order}>{index + 1}</td>
                                            <td>{song.name}</td>
                                            <td className={styles.channel}>
                                                {song.url_channel_icon && (
                                                    <img
                                                        className={styles.channelIcon}
                                                        src={song.url_channel_icon}
                                                        alt=""
                                                    />
                                                )}
                                                <span className={styles.channelName}>{song.url_creator}</span>
                                            </td>
                                            <td>
                                                <a
                                                    className={styles.songLink}
                                                    href={song.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {song.url_title}
                                                </a>
                                            </td>
                                            <td>{song.author}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}