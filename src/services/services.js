import axios from "axios";

// Determine API base URL based on environment. In Vite, use import.meta.env.MODE.
// Fallback to APP_ENV from scripts for compatibility.
const isDev =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.MODE === "development") ||
  process.env?.APP_ENV === "development" ||
  process.env?.NODE_ENV === "development";

// Base URL with trailing slash - endpoints should NOT start with /
// In development, use relative path to leverage Vite proxy (avoids CORS)
// In production, use absolute path or relative path depending on deployment
const baseurl = isDev ? "/booklistapi/" : "/booklistapi/";

const apiClient = axios.create({
  baseURL: baseurl,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    // Note: CORS response headers are set by the server; these request headers are intentionally minimal.
  },
  // Add request interceptor for better error logging
  timeout: 10000, // 10 second timeout
  transformRequest: (data, headers) => {
    let token = null;
    if (localStorage.getItem("user") !== null) {
      try {
        token = JSON.parse(localStorage.getItem("user")).token;
      } catch (e) {
        // Ignore parse errors
      }
    }
    let authHeader = "";
    if (token !== null && token !== "") {
      authHeader = "Bearer " + token;
      headers["Authorization"] = authHeader;
    }
    // Only stringify if data exists and is not already a string
    if (data === undefined || data === null) {
      return data;
    }
    if (typeof data === "string") {
      return data;
    }
    return JSON.stringify(data);
  },
  transformResponse: function (data) {
    // Some endpoints may return an empty body (e.g. 204 No Content) or non-JSON (404 HTML).
    // Guard against parsing errors and return a safe value instead of throwing.
    if (data === undefined || data === null || (typeof data === "string" && data.trim() === "")) {
      return {};
    }

    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      if (parsed && !parsed.success && parsed.code == "expired-session") {
        localStorage.removeItem("user");
      }
      return parsed;
    } catch (e) {
      // If parsing fails, return the raw data so callers can handle it. Also log for debugging.
      console.warn("services.transformResponse: failed to parse response as JSON", e, data);
      return data;
    }
  },
});

// Add request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log("API Request:", {
      method: config.method?.toUpperCase(),
      url: config.baseURL + config.url,
      data: config.data,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    console.error("API Request Error:", error);
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log("API Response:", {
      status: response.status,
      url: response.config.url,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error("API Response Error:", {
      message: error.message,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      fullURL: error.config?.baseURL + error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code,
    });
    
    // Handle network errors
    if (error.code === "ECONNABORTED" || error.message === "Network Error") {
      console.error("Network error - backend may not be running or CORS issue");
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
