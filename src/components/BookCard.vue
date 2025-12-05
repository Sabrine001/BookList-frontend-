<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import FavoriteServices from "../services/FavoriteServices";
import ListServices from "../services/ListServices";
import { useAuth } from "../composables/useAuth";
import AddToListDialog from "./AddToListDialog.vue";

const props = defineProps({
  book: {
    type: Object,
    required: true,
  },
  showActions: {
    type: Boolean,
    default: true,
  },
});

const router = useRouter();
const { isLoggedIn } = useAuth();
const isFavorite = ref(false);
const showListDialog = ref(false);
const loading = ref(false);

const emit = defineEmits(["favorite-changed", "book-updated"]);

const averageRating = computed(() => {
  if (!props.book.average_rating && props.book.average_rating !== 0) return null;
  return parseFloat(props.book.average_rating).toFixed(1);
});

const ratingCount = computed(() => {
  return props.book.rating_count || 0;
});

async function checkFavoriteStatus() {
  if (!isLoggedIn.value || !props.book.id) return;
  try {
    const response = await FavoriteServices.isFavorite(props.book.id);
    isFavorite.value = response.data?.is_favorite || false;
  } catch (error) {
    // If endpoint doesn't exist, silently fail
    console.warn("Could not check favorite status:", error);
  }
}

async function toggleFavorite() {
  if (!isLoggedIn.value) {
    router.push({ name: "login" });
    return;
  }

  loading.value = true;
  try {
    if (isFavorite.value) {
      await FavoriteServices.removeFavorite(props.book.id);
      isFavorite.value = false;
    } else {
      await FavoriteServices.addFavorite(props.book.id);
      isFavorite.value = true;
    }
    emit("favorite-changed", props.book.id, isFavorite.value);
  } catch (error) {
    console.error("Error toggling favorite:", error);
  } finally {
    loading.value = false;
  }
}

function openListDialog() {
  if (!isLoggedIn.value) {
    router.push({ name: "login" });
    return;
  }
  showListDialog.value = true;
}

function closeListDialog() {
  showListDialog.value = false;
}

function viewDetails() {
  router.push({ name: "bookDetail", params: { id: props.book.id } });
}

// Check favorite status on mount if logged in
if (isLoggedIn.value) {
  checkFavoriteStatus();
}
</script>

<template>
  <v-card class="book-card" elevation="2" :loading="loading">
    <v-img
      v-if="book.cover_url"
      :src="book.cover_url"
      height="300"
      cover
      @click="viewDetails"
      style="cursor: pointer"
    >
      <template v-slot:placeholder>
        <div class="d-flex align-center justify-center fill-height">
          <v-progress-circular indeterminate color="grey-lighten-5"></v-progress-circular>
        </div>
      </template>
    </v-img>
    <v-img
      v-else
      height="300"
      cover
      @click="viewDetails"
      style="cursor: pointer; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    >
      <div class="d-flex align-center justify-center fill-height">
        <v-icon size="64" color="white">mdi-book-open-variant</v-icon>
      </div>
    </v-img>

    <v-card-title @click="viewDetails" style="cursor: pointer">
      {{ book.title }}
    </v-card-title>

    <v-card-subtitle v-if="book.authors && book.authors.length > 0">
      <span v-for="(author, index) in book.authors" :key="author.id">
        {{ author.name }}{{ index < book.authors.length - 1 ? ", " : "" }}
      </span>
    </v-card-subtitle>

    <v-card-text>
      <div v-if="averageRating !== null" class="mb-2">
        <v-rating
          :model-value="parseFloat(averageRating)"
          readonly
          half-increments
          density="compact"
          size="small"
          color="amber"
        ></v-rating>
        <span class="text-caption ml-2">
          {{ averageRating }} ({{ ratingCount }} {{ ratingCount === 1 ? "rating" : "ratings" }})
        </span>
      </div>

      <div v-if="book.genres && book.genres.length > 0" class="mb-2">
        <v-chip
          v-for="genre in book.genres.slice(0, 3)"
          :key="genre.id || genre"
          size="small"
          class="mr-1 mb-1"
        >
          {{ genre.name || genre }}
        </v-chip>
      </div>

      <div v-if="book.isbn" class="text-caption text-grey">
        ISBN: {{ book.isbn }}
      </div>
    </v-card-text>

    <v-card-actions v-if="showActions">
      <v-btn color="primary" variant="text" @click="viewDetails">
        View Details
      </v-btn>
      <v-spacer></v-spacer>
      <v-btn
        v-if="isLoggedIn"
        icon
        :color="isFavorite ? 'red' : 'grey'"
        @click="toggleFavorite"
        :loading="loading"
      >
        <v-icon>{{ isFavorite ? "mdi-heart" : "mdi-heart-outline" }}</v-icon>
      </v-btn>
      <v-btn
        v-if="isLoggedIn"
        icon
        color="primary"
        @click="openListDialog"
      >
        <v-icon>mdi-bookmark-plus</v-icon>
      </v-btn>
    </v-card-actions>

    <AddToListDialog
      v-model="showListDialog"
      :book="book"
      @close="closeListDialog"
    />
  </v-card>
</template>

<style scoped>
.book-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.book-card .v-card-title {
  min-height: 3em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

