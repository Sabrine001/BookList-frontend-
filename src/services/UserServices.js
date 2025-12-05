import apiClient from "./services";

export default {
  getUser() {
    return apiClient.get("users");
  },
  addUser(user) {
    // Backend expects: first_name, email, password (snake_case)
    // Accept either a ref (with .value) or a plain object
    const u = user?.value ?? user;
    // Transform camelCase to snake_case for backend
    const userData = {
      first_name: u.firstName || u.first_name,
      email: u.email,
      password: u.password,
    };
    return apiClient.post("users/register", userData);
  },
  loginUser(user) {
    // Backend expects: email, password
    // Accept either a ref (with .value) or a plain object
    const u = user?.value ?? user;
    // Only send email and password for login
    const loginData = {
      email: u.email,
      password: u.password,
    };
    return apiClient.post("users/login", loginData);
  },
  logoutUser() {
    return apiClient.post("logout");
  },
};
