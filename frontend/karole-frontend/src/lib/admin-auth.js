// Requests made as the admin. The login lives in an HttpOnly cookie set by the backend, so
// page scripts never see it; the browser attaches it when credentials are included.
import { BACKEND_URI } from "./config";

const LOGIN_PAGE = "/admin/login";

export async function adminFetch(url, options = {}) {
    const response = await fetch(url, { ...options, credentials: "include" });
    if (response.status === 401) {
        // Not logged in, or the login has expired.
        window.location.replace(LOGIN_PAGE);
    }
    return response;
}

export async function logOut() {
    // Only the backend can remove an HttpOnly cookie.
    await fetch(`${BACKEND_URI}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.replace(LOGIN_PAGE);
}
