"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./header.module.css";

export default function Header() {
    const pathname = usePathname();

    return (
        <header className={styles.header}>
            <Link className={styles.brand} href="/add">
                Karole
            </Link>
            <nav className={styles.nav} aria-label="Main navigation">
                <Link className={pathname === "/add" ? styles.active : ""} href="/add">
                    Add song
                </Link>
                <Link className={pathname === "/playlist" ? styles.active : ""} href="/playlist">
                    Playlist
                </Link>
            </nav>
        </header>
    );
}