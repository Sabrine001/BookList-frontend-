<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import ListServices from "../services/ListServices";
import { useAuth } from "../composables/useAuth";
import BookCard from "../components/BookCard.vue";

const route = useRoute();
const router = useRouter();
const { isLoggedIn } = useAuth();

const list = ref(null);
const listItems = ref([]);
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
  await loadList();
  await loadListItems();
});

async function loadList() {
  loading.value = true;
  try {
    const response = await ListServices.getList(route.params.id);
    list.value = response.data;
  } catch (error) {
    console.error("Error loading list:", error);
    showSnackbar("Failed to load list", "error");
    router.push({ name: "lists" });
  } finally {
    loading.value = false;
  }
}

async function loadListItems() {
  try {
    const response = await ListServices.getListItems(route.params.id);
    const items = response.data || [];
    // Extract books from items
    listItems.value = items.map(item => ({
      ...item.book,
      listItemId: item.id,
      orderIndex: item.order_index,
    })).filter(book => book.id); // Filter out any items without books
  } catch (error) {
    console.error("Error loading list items:", error);
    listItems.value = [];
  }
}

async function removeBook(itemId) {
  if (!confirm("Remove this book from the list?")) return;

  try {
    await ListServices.removeBookFromList(route.params.id, itemId);
    showSnackbar("Book removed from list", "success");
    await loadListItems();
  } catch (error) {
    console.error("Error removing book:", error);
    showSnackbar("Failed to remove book", "error");
  }
}

function showSnackbar(text, color) {
  snackbar.value = { show: true, text, color };
}
</script>

<template>
  <v-container>
    <div v-if="loading" class="text-center py-12">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
    </div>

    <div v-else-if="list">
      <v-row class="mb-4">
        <v-col cols="12">
          <v-btn
            variant="text"
            @click="router.push({ name: 'lists' })"
            class="mb-4"
          >
            <v-icon start>mdi-arrow-left</v-icon>
            Back to Lists
          </v-btn>
          <h1 class="text-h4 font-weight-bold">{{ list.name }}</h1>
          <div class="mt-2">
            <v-chip size="small" class="mr-2">{{ list.visibility || "private" }}</v-chip>
            <span class="text-grey">{{ listItems.length }} {{ listItems.length === 1 ? "book" : "books" }}</span>
          </div>
          <p v-if="list.description" class="mt-2">{{ list.description }}</p>
        </v-col>
      </v-row>

      <!-- Empty State -->
      <div v-if="listItems.length === 0" class="text-center py-12">
        <v-icon size="64" color="grey-lighten-1">mdi-book-open-variant</v-icon>
        <p class="text-h6 mt-4 text-grey">This list is empty.</p>
        <v-btn
          color="primary"
          variant="flat"
          :to="{ name: 'books' }"
          class="mt-4"
        >
          Browse Books
        </v-btn>
      </div>

      <!-- Books Grid -->
      <v-row v-else>
        <v-col
          v-for="book in listItems"
          :key="book.id"
          cols="12"
          sm="6"
          md="4"
          lg="3"
        >
          <v-card>
            <BookCard :book="book" :show-actions="false" />
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn
                icon
                color="error"
                size="small"
                @click="removeBook(book.listItemId)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color">
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

