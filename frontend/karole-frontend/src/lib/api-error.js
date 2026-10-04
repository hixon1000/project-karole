// Builds the message shown to the user when a backend request fails.

export function getErrorMessage(result, response) {
    const detail = result?.detail;
    // FastAPI validation errors (status 422) send "detail" as a list of objects
    // instead of a string, which would otherwise be displayed as "[object Object]".
    if (Array.isArray(detail)) {
        return detail.map((validationError) => validationError.msg).join(" ");
    }
    return detail || `Request failed with status ${response.status}`;
}
