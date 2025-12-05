<script setup>
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import BookServices from "../services/BookServices";
import { useAuth } from "../composables/useAuth";
import BookCard from "../components/BookCard.vue";

const route = useRoute();
const router = useRouter();
const { isLoggedIn } = useAuth();

const books = ref([]);
const loading = ref(false);
const searchQuery = ref("");
const currentPage = ref(1);
const totalPages = ref(1);
const totalItems = ref(0);
const itemsPerPage = ref(12);
const snackbar = ref({
  show: false,
  text: "",
  color: "",
});

onMounted(async () => {
  // Check for query params
  if (route.query.q) {
    searchQuery.value = route.query.q;
  }
  if (route.query.page) {
    currentPage.value = parseInt(route.query.page) || 1;
  }
  await loadBooks();
});

// Watch for route query changes
watch(() => route.query, async (newQuery) => {
  if (newQuery.q !== undefined) {
    searchQuery.value = newQuery.q || "";
  }
  if (newQuery.page) {
    currentPage.value = parseInt(newQuery.page) || 1;
  }
  await loadBooks();
}, { deep: true });

async function loadBooks() {
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      limit: itemsPerPage.value,
    };

    if (searchQuery.value.trim()) {
      params.q = searchQuery.value.trim();
    }

    const response = await BookServices.getBooks(params);
    
    if (response && response.data) {
      // Handle different response formats
      if (Array.isArray(response.data)) {
        books.value = response.data;
        totalItems.value = response.data.length;
        totalPages.value = 1;
      } else if (response.data.books || response.data.items) {
        books.value = response.data.books || response.data.items || [];
        totalItems.value = response.data.total || response.data.count || books.value.length;
        totalPages.value = response.data.total_pages || response.data.pages || Math.ceil(totalItems.value / itemsPerPage.value);
      } else {
        books.value = [];
        totalItems.value = 0;
        totalPages.value = 1;
      }
    } else {
      books.value = [];
      totalItems.value = 0;
      totalPages.value = 1;
    }
  } catch (error) {
    console.error("Error fetching books:", error);
    books.value = [];
    showSnackbar(error.response?.data?.message || "Failed to load books", "error");
  } finally {
    loading.value = false;
  }
}

function search() {
  currentPage.value = 1;
  updateRoute();
}

function updateRoute() {
  const query = {};
  if (searchQuery.value.trim()) {
    query.q = searchQuery.value.trim();
  }
  if (currentPage.value > 1) {
    query.page = currentPage.value;
  }
  router.push({ name: "books", query });
}

function onPageChange(page) {
  currentPage.value = page;
  updateRoute();
  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
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
          <h1 class="text-h4 font-weight-bold mb-4">Browse Books</h1>
        </v-col>
      </v-row>

      <!-- Search Bar -->
      <v-row class="mb-4">
        <v-col cols="12" md="8">
          <v-text-field
            v-model="searchQuery"
            label="Search books by title, author, or ISBN"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            clearable
            @keyup.enter="search"
            @click:clear="search"
          ></v-text-field>
        </v-col>
        <v-col cols="12" md="4" class="d-flex align-center">
          <v-btn
            color="primary"
            variant="flat"
            size="large"
            @click="search"
            :loading="loading"
          >
            Search
          </v-btn>
        </v-col>
      </v-row>

      <!-- Loading State -->
      <div v-if="loading && books.length === 0" class="text-center py-12">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
        <p class="mt-4 text-grey">Loading books...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="!loading && books.length === 0" class="text-center py-12">
        <v-icon size="64" color="grey-lighten-1">mdi-book-open-variant</v-icon>
        <p class="text-h6 mt-4 text-grey">
          {{ searchQuery ? "No books found matching your search." : "No books available." }}
        </p>
        <v-btn
          v-if="searchQuery"
          color="primary"
          variant="text"
          @click="searchQuery = ''; search()"
          class="mt-2"
        >
          Clear Search
        </v-btn>
      </div>

      <!-- Books Grid -->
      <v-row v-else>
        <v-col
          v-for="book in books"
          :key="book.id"
          cols="12"
          sm="6"
          md="4"
          lg="3"
        >
          <BookCard :book="book" />
        </v-col>
      </v-row>

      <!-- Pagination -->
      <v-row v-if="!loading && books.length > 0 && totalPages > 1" class="mt-4">
        <v-col cols="12" class="d-flex justify-center">
          <v-pagination
            v-model="currentPage"
            :length="totalPages"
            :total-visible="7"
            @update:model-value="onPageChange"
          ></v-pagination>
        </v-col>
      </v-row>

      <!-- Results Count -->
      <v-row v-if="!loading && books.length > 0">
        <v-col cols="12" class="text-center text-grey">
          Showing {{ books.length }} of {{ totalItems }} {{ totalItems === 1 ? "book" : "books" }}
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

