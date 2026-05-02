// src/config.js

// Retrieve the base URL dynamically based on the current window's location to allow easy local network access
const getBaseApiUrl = () => {
    // If the hostname is localhost or 127.0.0.1, it works locally.
    // Otherwise, it correctly uses the network ip (like 192.168.1.x)
    return `http://${window.location.hostname}:8080/api`;
};

export const CONFIG = {
    API_BASE_URL: getBaseApiUrl(),
    SESSION_TIMEOUT_MINUTES: 15, // Example config variable
};
