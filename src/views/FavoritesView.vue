<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import FavoriteServices from "../services/FavoriteServices";
import { useAuth } from "../composables/useAuth";
import BookCard from "../components/BookCard.vue";

const router = useRouter();
const { isLoggedIn } = useAuth();

const favorites = ref([]);
const loading = ref(false);
const snackbar = ref({
  show: false,
  text: "",
  color: "",
});

onMounted(async () => {
  if (!isLoggedIn.value) {
    router.push({ name: "login" });
    return;
  }
  await loadFavorites();
});

async function loadFavorites() {
  loading.value = true;
  try {
    const response = await FavoriteServices.getFavorites();
    
    // Handle different response formats
    if (response && response.data) {
      if (Array.isArray(response.data)) {
        favorites.value = response.data.map(fav => fav.book || fav);
      } else if (response.data.books) {
        favorites.value = response.data.books;
      } else if (response.data.items) {
        favorites.value = response.data.items.map(item => item.book || item);
      } else {
        favorites.value = [];
      }
    } else {
      favorites.value = [];
    }
  } catch (error) {
    console.error("Error loading favorites:", error);
    showSnackbar("Failed to load favorites", "error");
    favorites.value = [];
  } finally {
    loading.value = false;
  }
}

function onFavoriteChanged(bookId, isFavorite) {
  if (!isFavorite) {
    // Remove from local list
    favorites.value = favorites.value.filter(book => book.id !== bookId);
    showSnackbar("Removed from favorites", "success");
  }
  // Reload to ensure consistency
  loadFavorites();
}

function showSnackbar(text, color) {
  snackbar.value = { show: true, text, color };
}
</script>

<template>
  <v-container>
    <div id="body">
      <v-row align="center" class="mb-4">
        <v-col cols="12">
          <h1 class="text-h4 font-weight-bold">My Favorites</h1>
        </v-col>
      </v-row>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
        <p class="mt-4 text-grey">Loading favorites...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="favorites.length === 0" class="text-center py-12">
        <v-icon size="64" color="grey-lighten-1">mdi-heart-outline</v-icon>
        <p class="text-h6 mt-4 text-grey">You haven't favorited any books yet.</p>
        <v-btn
          color="primary"
          variant="flat"
          :to="{ name: 'books' }"
          class="mt-4"
        >
          Browse Books
        </v-btn>
      </div>

      <!-- Favorites Grid -->
      <v-row v-else>
        <v-col
          v-for="book in favorites"
          :key="book.id"
          cols="12"
          sm="6"
          md="4"
          lg="3"
        >
          <BookCard :book="book" @favorite-changed="onFavoriteChanged" />
        </v-col>
      </v-row>

      <v-snackbar v-model="snackbar.show" :color="snackbar.color">
        {{ snackbar.text }}
        <template v-slot:actions>
          <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
        </template>
      </v-snackbar>
    </div>
  </v-container>
</template>

