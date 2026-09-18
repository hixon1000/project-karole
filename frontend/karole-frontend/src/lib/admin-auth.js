export const ADMIN_TOKEN_KEY = "karole-admin-token";

export function getAdminToken() {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function adminFetch(url, options = {}) {
    const headers = new Headers(options.headers);
    const token = getAdminToken();
    // Debug logging: output token presence and Authorization header.
    console.log("adminFetch token:", token ? "[REDACTED]" : "<none>");
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
        console.log("adminFetch Authorization header set");
    } else {
        console.warn("adminFetch called without token – Authorization header not set");
    }

    // Log the final headers for debugging (may include other custom headers).
    console.log("adminFetch final headers:", [...headers.entries()]);

    return fetch(url, { ...options, headers });
}