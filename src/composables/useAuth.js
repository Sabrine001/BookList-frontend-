import { ref, computed } from "vue";

const currentUser = ref(null);

export function useAuth() {
  function loadUser() {
    try {
      const userData = localStorage.getItem("user");
      if (userData && userData !== "null" && userData !== "undefined") {
        const parsed = JSON.parse(userData);
        if (parsed && typeof parsed === "object" && (parsed.token || parsed.id || parsed.email)) {
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
              console.warn("Could not decode role from JWT in loadUser:", e);
            }
          }
          currentUser.value = parsed;
          return true;
        }
      }
      currentUser.value = null;
      return false;
    } catch (error) {
      console.error("Error loading user:", error);
      currentUser.value = null;
      return false;
    }
  }

  function setUser(userData) {
    if (userData) {
      localStorage.setItem("user", JSON.stringify(userData));
      currentUser.value = userData;
    } else {
      localStorage.removeItem("user");
      currentUser.value = null;
    }
  }

  const isLoggedIn = computed(() => {
    return currentUser.value !== null && currentUser.value.token !== undefined;
  });

  const getUserRole = computed(() => {
    if (!currentUser.value) return null;
    let role = currentUser.value.role || currentUser.value.user?.role;
    
    // If role not found, try to decode from JWT
    if (!role && currentUser.value.token) {
      try {
        const tokenParts = currentUser.value.token.split('.');
        if (tokenParts.length === 3) {
          const payloadPart = JSON.parse(atob(tokenParts[1]));
          role = payloadPart.role || payloadPart.user?.role;
        }
      } catch (e) {
        // Silently fail - role might not be in JWT
      }
    }
    
    return role;
  });

  const isAdmin = computed(() => {
    return getUserRole.value === "admin";
  });

  const isWriter = computed(() => {
    const role = getUserRole.value;
    return role === "writer" || role === "admin";
  });

  // Initialize on first use
  if (currentUser.value === null) {
    loadUser();
  }

  return {
    currentUser,
    isLoggedIn,
    isAdmin,
    isWriter,
    loadUser,
    setUser,
  };
}

