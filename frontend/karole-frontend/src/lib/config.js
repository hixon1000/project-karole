// The backend is reached on the same host name as this page, on port 8000. The browser only
// sends the admin login cookie between matching hosts, so opening the site as "localhost"
// must not talk to a backend at "127.0.0.1" or the other way round.
const hostname = typeof window === "undefined" ? "127.0.0.1" : window.location.hostname;

export const BACKEND_URI = `http://${hostname}:8000`;
