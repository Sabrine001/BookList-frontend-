<script setup>
import { onMounted, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import UserServices from "../services/UserServices.js";
import apiClient from "../services/services.js";
import { useAuth } from "../composables/useAuth.js";

const router = useRouter();
const route = useRoute();
const { setUser } = useAuth();
const isCreateAccount = ref(false);
const snackbar = ref({
  value: false,
  color: "",
  text: "",
});
const user = ref({
  firstName: "",
  email: "",
  password: "",
});

onMounted(async () => {
  // Check if already logged in
  const userData = localStorage.getItem("user");
  if (userData && userData !== "null" && userData !== "undefined") {
    try {
      const parsed = JSON.parse(userData);
      if (parsed && parsed.token) {
        // Extract role for redirect
        let role = parsed.role || parsed.user?.role;
        if (!role && parsed.token) {
          try {
            const tokenParts = parsed.token.split('.');
            if (tokenParts.length === 3) {
              const payloadPart = JSON.parse(atob(tokenParts[1]));
              role = payloadPart.role || payloadPart.user?.role;
            }
          } catch (e) {
            // Could not decode role
          }
        }
        
        // Already logged in, redirect based on role or query param
        const redirect = route.query.redirect;
        if (redirect && redirect !== "login" && redirect !== "/login") {
          // If redirect is a path, use it directly; otherwise treat as route name
          if (redirect.startsWith("/")) {
            router.push(redirect);
          } else {
            router.push({ name: redirect });
          }
        } else {
          // Role-based redirect
          if (role === "admin") {
            router.push({ name: "adminDashboard" });
          } else if (role === "writer") {
            router.push({ name: "authorDashboard" });
          } else {
            router.push({ name: "home" });
          }
        }
        return;
      }
    } catch (error) {
      // Invalid user data, continue to login
    }
  }
});

function navigateToBooks() {
  router.push({ name: "books" });
}

async function createAccount() {
  // Validate required fields
  if (!user.value.firstName || !user.value.email || !user.value.password) {
    snackbar.value.value = true;
    snackbar.value.color = "error";
    snackbar.value.text = "Please fill in all required fields";
    return;
  }

  console.log("Attempting to register user:", { email: user.value.email, firstName: user.value.firstName });
  
  await UserServices.addUser(user.value)
    .then((response) => {
      // Axios wraps the response in response.data
      const payload = response?.data ?? response;
      console.log("Register response:", payload);
      
      // If registration returns a token, store it
      // Extract role similar to login
      if (payload && payload.token) {
        let role = payload?.role || payload?.user?.role;
        if (!role && payload.token) {
          try {
            const tokenParts = payload.token.split('.');
            if (tokenParts.length === 3) {
              const payloadPart = JSON.parse(atob(tokenParts[1]));
              role = payloadPart.role || payloadPart.user?.role;
            }
          } catch (e) {
            console.warn("Could not decode role from JWT:", e);
          }
        }
        if (role && !payload.role) {
          payload.role = role;
        }
        setUser(payload);
        apiClient.defaults.headers.common["Authorization"] = "Bearer " + payload.token;
      }
      
      // Clear form
      user.value.firstName = "";
      user.value.email = "";
      user.value.password = "";
      isCreateAccount.value = false;
      
      snackbar.value.value = true;
      snackbar.value.color = "green";
      snackbar.value.text = "Account created successfully!";
      
      // Optionally auto-login and redirect, or just close dialog
      // For now, close the dialog and let user login
    })
    .catch((error) => {
      console.error("Create account error:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response,
        request: error.request,
        config: error.config,
      });
      
      let msg = "Failed to create account. Please try again.";
      if (error.response?.data?.message) {
        msg = error.response.data.message;
      } else if (error.message) {
        msg = error.message;
      } else if (error.code === "ECONNABORTED" || error.message === "Network Error") {
        msg = "Cannot connect to server. Please check if the backend is running on http://localhost:3201";
      }
      
      snackbar.value.value = true;
      snackbar.value.color = "error";
      snackbar.value.text = msg;
    });
}

async function login() {
  // Validate email and password are provided
  if (!user.value.email || !user.value.password) {
    snackbar.value.value = true;
    snackbar.value.color = "error";
    snackbar.value.text = "Please enter both email and password";
    return;
  }

  console.log("Attempting to login user:", { email: user.value.email });
  
  await UserServices.loginUser(user.value)
    .then((response) => {
      // Axios wraps the response in response.data
      const payload = response?.data ?? response;
      console.log("Login response:", payload);
      
      // Extract role from response - handle different response structures
      // Backend might return: { token, role, user: {...} } or { token, user: { role, ... } }
      let role = payload?.role || payload?.user?.role;
      
      // If role is not in payload, try to decode from JWT (basic decode without verification)
      if (!role && payload?.token) {
        try {
          const tokenParts = payload.token.split('.');
          if (tokenParts.length === 3) {
            const payloadPart = JSON.parse(atob(tokenParts[1]));
            role = payloadPart.role || payloadPart.user?.role;
          }
        } catch (e) {
          console.warn("Could not decode role from JWT:", e);
        }
      }
      
      // Ensure role is stored in the payload for consistent access
      if (role && !payload.role) {
        payload.role = role;
      }
      
      // Store user data
      setUser(payload);
      
      // Set default Authorization header for subsequent requests
      if (payload && payload.token) {
        apiClient.defaults.headers.common["Authorization"] = "Bearer " + payload.token;
      }
      
      // Clear password field
      user.value.password = "";
      
      snackbar.value.value = true;
      snackbar.value.color = "green";
      snackbar.value.text = "Login successful!";
      
      // Role-based redirect
      const redirect = route.query.redirect;
      if (redirect && redirect !== "login" && redirect !== "/login") {
        // If redirect is a path, use it directly; otherwise treat as route name
        if (redirect.startsWith("/")) {
          router.push(redirect);
        } else {
          router.push({ name: redirect });
        }
      } else {
        // Redirect based on role
        if (role === "admin") {
          router.push({ name: "adminDashboard" });
        } else if (role === "writer") {
          router.push({ name: "authorDashboard" });
        } else {
          // Default to home for readers
          router.push({ name: "home" });
        }
      }
    })
    .catch((error) => {
      console.error("Login error:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response,
        request: error.request,
        config: error.config,
      });
      
      let msg = "Login failed. Please try again.";
      if (error.response?.data?.message) {
        msg = error.response.data.message;
      } else if (error.message) {
        msg = error.message;
      } else if (error.code === "ECONNABORTED" || error.message === "Network Error") {
        msg = "Cannot connect to server. Please check if the backend is running on http://localhost:3201";
      }
      
      snackbar.value.value = true;
      snackbar.value.color = "error";
      snackbar.value.text = msg;
    });
}

function openCreateAccount() {
  isCreateAccount.value = true;
}

function closeCreateAccount() {
  isCreateAccount.value = false;
}

function closeSnackBar() {
  snackbar.value.value = false;
}
</script>

<template>
  <v-container>
    <div id="body">
      <v-card class="rounded-lg elevation-5">
        <v-card-title class="headline mb-2">Login </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="user.email"
            label="Email"
            required
          ></v-text-field>

          <v-text-field
            v-model="user.password"
            label="Password"
            type="password"
            required
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="flat" color="secondary" @click="openCreateAccount()"
            >Create Account</v-btn
          >
          <v-spacer></v-spacer>

          <v-btn variant="flat" color="primary" @click="login()">Login</v-btn>
        </v-card-actions>
      </v-card>

      <v-card class="rounded-lg elevation-5 my-8">
        <v-card-title class="text-center headline">
          <v-btn
            class="ml-2"
            variant="flat"
            color="secondary"
            @click="navigateToBooks()"
          >
            View Books
          </v-btn>
        </v-card-title>
      </v-card>

      <v-dialog persistent v-model="isCreateAccount" width="800">
        <v-card class="rounded-lg elevation-5">
          <v-card-title class="headline mb-2">Create Account </v-card-title>
          <v-card-text>
            <v-text-field
              v-model="user.firstName"
              label="First Name"
              required
            ></v-text-field>

            <v-text-field
              v-model="user.email"
              label="Email"
              required
            ></v-text-field>

            <v-text-field
              v-model="user.password"
              label="Password"
              type="password"
              required
            ></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              variant="flat"
              color="secondary"
              @click="closeCreateAccount()"
              >Close</v-btn
            >
            <v-btn variant="flat" color="primary" @click="createAccount()"
              >Create Account</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-snackbar v-model="snackbar.value" rounded="pill" :color="snackbar.color">
        {{ snackbar.text }}

        <template v-slot:actions>
          <v-btn
            variant="text"
            @click="closeSnackBar()"
          >
            Close
          </v-btn>
        </template>
      </v-snackbar>
    </div>
  </v-container>
</template>
