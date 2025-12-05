import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("./views/HomeView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/login",
      name: "login",
      component: () => import("./views/Login.vue"),
    },
    {
      path: "/books",
      name: "books",
      component: () => import("./views/BooksView.vue"),
    },
    {
      path: "/books/:id",
      name: "bookDetail",
      props: true,
      component: () => import("./views/BookDetailView.vue"),
    },
    {
      path: "/favorites",
      name: "favorites",
      component: () => import("./views/FavoritesView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/lists",
      name: "lists",
      component: () => import("./views/MyListsView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/lists/:id",
      name: "listDetail",
      props: true,
      component: () => import("./views/ListDetailView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/author",
      name: "authorDashboard",
      component: () => import("./views/AuthorDashboard.vue"),
      meta: { requiresAuth: true, requiresWriter: true },
    },
    {
      path: "/admin",
      name: "adminDashboard",
      component: () => import("./views/AdminDashboard.vue"),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
  ],
});

// Route guards
router.beforeEach((to, from, next) => {
  const userData = localStorage.getItem("user");
  let user = null;

  try {
    if (userData && userData !== "null" && userData !== "undefined") {
      user = JSON.parse(userData);
    }
  } catch (error) {
    console.error("Error parsing user data:", error);
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth && !user) {
    next({ name: "login", query: { redirect: to.fullPath } });
    return;
  }

  // Extract role - handle different user data structures
  let role = null;
  if (user) {
    role = user.role || user.user?.role;
    
    // If role not found, try to decode from JWT token
    if (!role && user.token) {
      try {
        const tokenParts = user.token.split('.');
        if (tokenParts.length === 3) {
          const payloadPart = JSON.parse(atob(tokenParts[1]));
          role = payloadPart.role || payloadPart.user?.role;
        }
      } catch (e) {
        console.warn("Could not decode role from JWT in route guard:", e);
      }
    }
  }

  // Check if route requires writer role
  if (to.meta.requiresWriter) {
    if (role !== "writer" && role !== "admin") {
      // Redirect to appropriate dashboard based on role
      if (role === "admin") {
        next({ name: "adminDashboard" });
      } else {
        next({ name: "books" });
      }
      return;
    }
  }

  // Check if route requires admin role
  if (to.meta.requiresAdmin) {
    if (role !== "admin") {
      // Redirect to appropriate dashboard based on role
      if (role === "writer") {
        next({ name: "authorDashboard" });
      } else {
        next({ name: "books" });
      }
      return;
    }
  }

  next();
});

export default router;
