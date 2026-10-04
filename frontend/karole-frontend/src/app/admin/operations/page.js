"use client";

import { useEffect, useState } from "react";
import { BACKEND_URI } from "../../../lib/config";
import { adminFetch, logOut } from "../../../lib/admin-auth";
import AdminHeader from "../../../components/admin-header";
import styles from "./page.module.css";

export default function AdminOperations() {
    const [operations, setOperations] = useState([]);
    const [status, setStatus] = useState("loading");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    async function loadOperations() {
        try {
            const response = await adminFetch(`${BACKEND_URI}/operation/`, { cache: "no-store" });
            if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
            setOperations(await response.json());
            setStatus("ready");
        } catch (requestError) {
            setError(requestError.message);
            setStatus("error");
        }
    }

    useEffect(() => {
        Promise.resolve().then(loadOperations);
    }, []);

    async function runOperation(url, operationId, confirmation) {
        if (confirmation && !window.confirm(confirmation)) return;
        setError("");
        setMessage("");
        try {
            const response = await adminFetch(`${BACKEND_URI}${url}`, {
                method: url.includes("delete") ? "DELETE" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ po_id: operationId }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(result?.detail || `Request failed with status ${response.status}`);
            }
            await loadOperations();
            setMessage(url.includes("handle") ? "Operation matched." : "Operation ignored.");
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    async function flushOperations() {
        if (!window.confirm("WARNING: this permanently ignores every pending operation.")) return;
        setError("");
        try {
            const response = await adminFetch(`${BACKEND_URI}/operation/flush`, { method: "DELETE" });
            if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
            await loadOperations();
            setMessage("All pending operations ignored.");
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    async function matchAll() {
        if (!window.confirm("Match every pending operation?")) return;
        setError("");
        setMessage("");
        try {
            const response = await adminFetch(`${BACKEND_URI}/operation/handle_all`, {
                method: "POST",
            });
            const result = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(result?.detail || `Request failed with status ${response.status}`);
            }
            await loadOperations();
            setMessage(`Matched ${result.length} pending operation${result.length === 1 ? "" : "s"}.`);
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    return (
        <main className={styles.page}>
            <AdminHeader />
            <section className={styles.panel}>
                <div className={styles.heading}>
                    <div>
                        <p className={styles.eyebrow}>Admin / Operations</p>
                        <h1>Pending operations</h1>
                    </div>
                    <div className={styles.headingActions}>
                        <button className={styles.matchAll} onClick={matchAll}>Match all</button>
                        <button className={styles.flushButton} onClick={flushOperations}>Ignore all</button>
                        <button className={styles.signOut} onClick={logOut}>Sign out</button>
                    </div>
                </div>

                {error && <p className={styles.error} role="alert">{error}</p>}
                {message && <p className={styles.success} role="status">{message}</p>}
                {status === "loading" && <p className={styles.message}>Loading pending operations...</p>}
                {status === "ready" && operations.length === 0 && (
                    <p className={styles.message}>No pending operations.</p>
                )}
                {status === "ready" && operations.length > 0 && (
                    <div className={styles.tableWrap}>
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Primary name</th>
                                    <th>Alternative name</th>
                                    <th>Similarity</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {operations
                                    .slice()
                                    .sort((first, second) => second.score - first.score)
                                    .map((operation) => (
                                        <tr key={operation.po_id}>
                                            <td>{operation.po_id}</td>
                                            <td className={styles.name}>{operation.name}</td>
                                            <td>{operation.name_alt}</td>
                                            <td>{operation.score.toFixed(1)}%</td>
                                            <td className={styles.actions}>
                                                <button onClick={() => runOperation(
                                                    "/operation/handle",
                                                    operation.po_id,
                                                    `Match "${operation.name_alt}" as an alternate of "${operation.name}"?`
                                                )}>Match</button>
                                                <button className={styles.delete} onClick={() => runOperation(
                                                    "/operation/delete",
                                                    operation.po_id,
                                                    `Ignore this pending operation for "${operation.name_alt}"?`
                                                )}>Ignore</button>
                                            </td>
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