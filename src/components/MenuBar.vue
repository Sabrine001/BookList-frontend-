<script setup>
import ocLogo from "/oc_logo.png";
import { ref, computed, onMounted, watch, onBeforeUnmount } from "vue";
import { useRouter, useRoute } from "vue-router";
import UserServices from "../services/UserServices";

const router = useRouter();
const route = useRoute();

const user = ref(null);
const title = ref("BookList");
const logoURL = ref("");

function updateUser() {
  try {
    const userData = localStorage.getItem("user");
    if (userData && userData !== "null" && userData !== "undefined") {
      const parsed = JSON.parse(userData);
      // Check if user object exists and has at least one identifying field
      if (parsed && typeof parsed === "object" && (parsed.token || parsed.id || parsed.email || parsed.firstName || parsed.first_name)) {
        // If role is not in parsed data, try to extract from JWT
        if (!parsed.role && parsed.token) {
          try {
            const tokenParts = parsed.token.split('.');
            if (tokenParts.length === 3) {
              const payloadPart = JSON.parse(atob(tokenParts[1]));
              const role = payloadPart.role || payloadPart.user?.role;
              if (role) {
                parsed.role = role;
              }
            }
          } catch (e) {
            // Silently fail - role might not be in JWT
          }
        }
        user.value = parsed;
      } else {
        user.value = null;
      }
    } else {
      user.value = null;
    }
  } catch (error) {
    console.error("Error parsing user data:", error);
    user.value = null;
  }
}

const isLoggedIn = computed(() => {
  return user.value !== null && user.value.token !== undefined;
});

const isAdmin = computed(() => {
  if (!user.value) return false;
  return user.value.role === "admin" || user.value.user?.role === "admin";
});

const isWriter = computed(() => {
  if (!user.value) return false;
  const role = user.value.role || user.value.user?.role;
  return role === "writer" || role === "admin";
});

function getUserInitials() {
  if (!user.value) return "U";
  const firstName = user.value.firstName || user.value.first_name || "";
  const lastName = user.value.lastName || user.value.last_name || "";
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  } else if (firstName) {
    return firstName.charAt(0).toUpperCase();
  } else if (user.value.email) {
    return user.value.email.charAt(0).toUpperCase();
  }
  return "U";
}

function getUserDisplayName() {
  if (!user.value) return "User";
  const firstName = user.value.firstName || user.value.first_name || "";
  const lastName = user.value.lastName || user.value.last_name || "";
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (firstName) {
    return firstName;
  } else if (user.value.email) {
    return user.value.email;
  }
  return "User";
}

function getUserEmail() {
  if (!user.value) return "";
  return user.value.email || "";
}

// Listen for storage events (when localStorage changes in other tabs/windows)
function handleStorageChange(e) {
  if (e.key === "user") {
    updateUser();
  }
}

let intervalId = null;

onMounted(() => {
  logoURL.value = ocLogo;
  updateUser();
  // Listen for storage events
  window.addEventListener("storage", handleStorageChange);
  // Also check periodically (in case storage event doesn't fire in same tab)
  intervalId = setInterval(updateUser, 1000);
});

onBeforeUnmount(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
  window.removeEventListener("storage", handleStorageChange);
});

// Watch for route changes to update user state (e.g., after login)
watch(() => route.path, () => {
  // Small delay to ensure localStorage is updated
  setTimeout(updateUser, 100);
}, { immediate: true });

function logout() {
  UserServices.logoutUser()
    .then((data) => {
      console.log(data);
    })
    .catch((error) => {
      console.log(error);
    });
  localStorage.removeItem("user");
  user.value = null;
  router.push({ name: "login" });
}
</script>

<template>
  <div>
    <v-app-bar color="primary" app dark>
      <router-link :to="{ name: isLoggedIn ? 'home' : 'books' }">
        <v-img
          class="mx-2"
          :src="logoURL"
          height="50"
          width="50"
          contain
        ></v-img>
      </router-link>
      <v-toolbar-title class="title">
        {{ title }}
      </v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn class="mx-2" :to="{ name: 'books' }"> Browse Books </v-btn>
      <v-btn v-if="!user" class="mx-2" :to="{ name: 'login' }">
        Login
      </v-btn>
      <template v-if="user">
        <v-btn class="mx-2" :to="{ name: 'favorites' }">
          <v-icon start>mdi-heart</v-icon>
          Favorites
        </v-btn>
        <v-btn class="mx-2" :to="{ name: 'lists' }">
          <v-icon start>mdi-bookmark</v-icon>
          My Lists
        </v-btn>
        <v-btn v-if="isWriter" class="mx-2" :to="{ name: 'authorDashboard' }">
          <v-icon start>mdi-account-edit</v-icon>
          Author Dashboard
        </v-btn>
        <v-btn v-if="isAdmin" class="mx-2" :to="{ name: 'adminDashboard' }">
          <v-icon start>mdi-shield-account</v-icon>
          Admin
        </v-btn>
        <v-menu min-width="200px" rounded>
          <template v-slot:activator="{ props }">
            <v-btn icon v-bind="props">
              <v-avatar class="mx-auto text-center" color="accent" size="large">
                <span class="white--text font-weight-bold">{{
                  getUserInitials()
                }}</span>
              </v-avatar>
            </v-btn>
          </template>
          <v-card>
            <v-card-text>
              <div class="mx-auto text-center">
                <v-avatar color="accent" size="64">
                  <span class="white--text text-h5">{{
                    getUserInitials()
                  }}</span>
                </v-avatar>
                <h3 class="mt-2">{{ getUserDisplayName() }}</h3>
                <p class="text-caption mt-1" v-if="getUserEmail()">
                  {{ getUserEmail() }}
                </p>
                <v-divider class="my-3"></v-divider>
                <v-btn rounded variant="text" :to="{ name: 'favorites' }" class="mb-2">
                  <v-icon start>mdi-heart</v-icon>
                  My Favorites
                </v-btn>
                <v-btn rounded variant="text" :to="{ name: 'lists' }" class="mb-2">
                  <v-icon start>mdi-bookmark</v-icon>
                  My Lists
                </v-btn>
                <v-btn v-if="isWriter" rounded variant="text" :to="{ name: 'authorDashboard' }" class="mb-2">
                  <v-icon start>mdi-account-edit</v-icon>
                  Author Dashboard
                </v-btn>
                <v-btn v-if="isAdmin" rounded variant="text" :to="{ name: 'adminDashboard' }" class="mb-2">
                  <v-icon start>mdi-shield-account</v-icon>
                  Admin Dashboard
                </v-btn>
                <v-divider class="my-2"></v-divider>
                <v-btn rounded variant="text" @click="logout()"> Logout </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-menu>
      </template>
    </v-app-bar>
  </div>
</template>
