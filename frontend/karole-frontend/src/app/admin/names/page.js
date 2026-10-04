"use client";

import { useEffect, useState } from "react";
import { BACKEND_URI } from "../../../lib/config";
import { adminFetch, logOut } from "../../../lib/admin-auth";
import { getErrorMessage } from "../../../lib/api-error";
import AdminHeader from "../../../components/admin-header";
import styles from "./page.module.css";

export default function AdminNames() {
    const [names, setNames] = useState([]);
    const [newName, setNewName] = useState("");
    const [status, setStatus] = useState("loading");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [draggedName, setDraggedName] = useState("");
    const [draggedIsPrimary, setDraggedIsPrimary] = useState(false);

    async function loadNames() {
        try {
            const response = await adminFetch(`${BACKEND_URI}/names/`, { cache: "no-store" });
            if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
            setNames(await response.json());
            setStatus("ready");
        } catch (requestError) {
            setError(requestError.message);
            setStatus("error");
        }
    }

    useEffect(() => {
        Promise.resolve().then(loadNames);
    }, []);

    async function request(url, options = {}) {
        setError("");
        setMessage("");
        try {
            const response = await adminFetch(`${BACKEND_URI}${url}`, options);
            const result = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(getErrorMessage(result, response));
            }
            await loadNames();
            return result;
        } catch (requestError) {
            setError(requestError.message);
            return null;
        }
    }

    async function addName(event) {
        event.preventDefault();
        const name = newName.trim();
        if (!name) return;

        const result = await request("/names/add?create_pending_operation=false", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        if (result) {
            setNewName("");
            setMessage(result.found ? "That name already exists." : "Name added.");
        }
    }

    async function flushNames() {
        if (!window.confirm("WARNING: this permanently deletes every managed name.")) return;
        await request("/names/flush", { method: "DELETE" });
    }

    function startDrag(name, isPrimary) {
        setDraggedName(name);
        setDraggedIsPrimary(isPrimary);
    }

    function endDrag() {
        setDraggedName("");
        setDraggedIsPrimary(false);
    }

    async function convertToAlternative(targetName) {
        if (!draggedName || !draggedIsPrimary || draggedName === targetName) return;
        await request("/names/to_alt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: targetName, name_alt: draggedName }),
        });
        endDrag();
    }

    async function dropAction(action) {
        if (!draggedName) return;
        if (action === "to-name" && !draggedIsPrimary) {
            await request("/names/to_name", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: draggedName }),
            });
        }
        if (action === "blacklist") {
            await request("/names/blacklist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: draggedName }),
            });
        }
        if (action === "unblacklist") {
            await request("/names/unblacklist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: draggedName }),
            });
        }
        if (action === "delete") {
            await request("/names/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: draggedName }),
            });
        }
        endDrag();
    }

    function allowDrop(event) {
        event.preventDefault();
    }

    return (
        <main className={styles.page}>
            <AdminHeader />
            <section className={styles.panel}>
                <div className={styles.heading}>
                    <div>
                        <p className={styles.eyebrow}>Admin / Names</p>
                        <h1>Manage names</h1>
                    </div>
                    <button className={styles.signOut} onClick={logOut}>Sign out</button>
                </div>

                <form className={styles.addForm} onSubmit={addName}>
                    <label htmlFor="new-name">Add a name</label>
                    <input
                        id="new-name"
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                        placeholder="Enter a name"
                        maxLength={30}
                        required
                    />
                    <button type="submit">Add name</button>
                </form>

                {error && <p className={styles.error} role="alert">{error}</p>}
                {message && <p className={styles.success} role="status">{message}</p>}
                {status === "loading" && <p className={styles.message}>Loading names...</p>}
                {status === "ready" && names.length === 0 && <p className={styles.message}>No managed names.</p>}
                {status === "ready" && names.length > 0 && (
                    <div className={styles.tableWrap}>
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Name</th>
                                    <th>Alternate names</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {names
                                    .slice()
                                    .sort((first, second) => first.name.localeCompare(second.name))
                                    .map((entry) => (
                                        <tr
                                            key={entry.name_id}
                                            onDragOver={allowDrop}
                                            onDrop={() => convertToAlternative(entry.name)}
                                        >
                                            <td>{entry.name_id}</td>
                                            <td className={styles.name}>
                                                <span
                                                    className={styles.draggableName}
                                                    draggable
                                                    onDragStart={() => startDrag(entry.name, true)}
                                                    onDragEnd={endDrag}
                                                >
                                                    {entry.name}
                                                </span>
                                            </td>
                                            <td className={styles.alternates}>
                                                {entry.name_alt.length > 0 ? entry.name_alt.map((alternate) => (
                                                    <span
                                                        className={styles.draggableName}
                                                        draggable
                                                        key={alternate}
                                                        onDragStart={() => startDrag(alternate, false)}
                                                        onDragEnd={endDrag}
                                                    >
                                                        {alternate}
                                                    </span>
                                                )) : "-"}
                                            </td>
                                            <td>
                                                <span className={entry.blacklist ? styles.blacklisted : styles.active}>
                                                    {entry.blacklist ? "Blacklisted" : "Active"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className={styles.dropZones}>
                    <div className={styles.dropZone} onDragOver={allowDrop} onDrop={() => dropAction("to-name")}>
                        <strong>Alternative to name</strong>
                        <span>Drop an alternate name here to promote it.</span>
                    </div>
                    <div className={styles.dropZone} onDragOver={allowDrop} onDrop={() => dropAction("blacklist")}>
                        <strong>Blacklist</strong>
                        <span>Drop a primary name here.</span>
                    </div>
                    <div className={styles.dropZone} onDragOver={allowDrop} onDrop={() => dropAction("unblacklist")}>
                        <strong>Unblacklist</strong>
                        <span>Drop a blacklisted name here.</span>
                    </div>
                    <div className={`${styles.dropZone} ${styles.deleteZone}`} onDragOver={allowDrop} onDrop={() => dropAction("delete")}>
                        <strong>Delete</strong>
                        <span>Drop any name here to remove it.</span>
                    </div>
                </div>

                <div className={styles.dangerZone}>
                    <p>Destructive actions</p>
                    <button className={styles.flushButton} onClick={flushNames}>Flush names database</button>
                </div>
            </section>
        </main>
    );
}