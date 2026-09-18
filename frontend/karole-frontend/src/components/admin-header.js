"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_TOKEN_KEY } from "../lib/admin-auth";
import styles from "./admin-header.module.css";

export default function AdminHeader() {
    const router = useRouter();
    const pathname = usePathname();

    function logOut() {
        window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        router.replace("/admin/login");
    }

    return (
        <header className={styles.header}>
            <Link className={styles.brand} href="/admin/playlist">
                Karole Admin
            </Link>
            <nav className={styles.nav} aria-label="Admin navigation">
                <Link className={pathname === "/admin/playlist" ? styles.active : ""} href="/admin/playlist">
                    Playlist
                </Link>
                <Link className={pathname === "/admin/names" ? styles.active : ""} href="/admin/names">
                    Names
                </Link>
                <Link className={pathname === "/admin/operations" ? styles.active : ""} href="/admin/operations">
                    Operations
                </Link>
                <button className={styles.logout} type="button" onClick={logOut}>
                    Log out
                </button>
            </nav>
        </header>
    );
}