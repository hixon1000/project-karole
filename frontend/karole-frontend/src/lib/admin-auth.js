export const ADMIN_TOKEN_KEY = "karole-admin-token";

export function getAdminToken() {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function adminFetch(url, options = {}) {
    const headers = new Headers(options.headers);
    const token = getAdminToken();
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    return fetch(url, { ...options, headers });
}