<script setup>
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import BookServices from "../services/BookServices";
import ReviewServices from "../services/ReviewServices";
import FavoriteServices from "../services/FavoriteServices";
import { useAuth } from "../composables/useAuth";
import BookCard from "../components/BookCard.vue";
import AddToListDialog from "../components/AddToListDialog.vue";

const route = useRoute();
const router = useRouter();
const { isLoggedIn, currentUser } = useAuth();

const book = ref(null);
const reviews = ref([]);
const myReview = ref(null);
const similarBooks = ref([]);
const isFavorite = ref(false);
const loading = ref(false);
const showListDialog = ref(false);
const showReviewForm = ref(false);
const showEditReview = ref(false);

const reviewForm = ref({
  rating: 5,
  title: "",
  body: "",
});

const snackbar = ref({
  show: false,
  text: "",
  color: "",
});

const averageRating = computed(() => {
  if (!book.value?.average_rating && book.value?.average_rating !== 0) return null;
  return parseFloat(book.value.average_rating).toFixed(1);
});

const ratingCount = computed(() => {
  return book.value?.rating_count || reviews.value.length || 0;
});

onMounted(async () => {
  await loadBook();
  await loadReviews();
  await loadSimilarBooks();
  if (isLoggedIn.value) {
    await checkFavoriteStatus();
    await loadMyReview();
  }
});

async function loadBook() {
  loading.value = true;
  try {
    const response = await BookServices.getBook(route.params.id);
    book.value = response.data;
  } catch (error) {
    console.error("Error loading book:", error);
    showSnackbar("Failed to load book details", "error");
    router.push({ name: "books" });
  } finally {
    loading.value = false;
  }
}

async function loadReviews() {
  try {
    const response = await ReviewServices.getBookReviews(route.params.id);
    reviews.value = response.data || [];
  } catch (error) {
    console.error("Error loading reviews:", error);
  }
}

async function loadMyReview() {
  try {
    const response = await ReviewServices.getMyReview(route.params.id);
    myReview.value = response.data || null;
    if (myReview.value) {
      reviewForm.value = {
        rating: myReview.value.rating || 5,
        title: myReview.value.title || "",
        body: myReview.value.body || "",
      };
    }
  } catch (error) {
    // User may not have reviewed yet
    myReview.value = null;
  }
}

async function loadSimilarBooks() {
  try {
    const response = await BookServices.getSimilarBooks(route.params.id);
    similarBooks.value = response.data || [];
  } catch (error) {
    console.warn("Could not load similar books:", error);
    similarBooks.value = [];
  }
}

async function checkFavoriteStatus() {
  try {
    const response = await FavoriteServices.isFavorite(route.params.id);
    isFavorite.value = response.data?.is_favorite || false;
  } catch (error) {
    console.warn("Could not check favorite status:", error);
  }
}

async function toggleFavorite() {
  if (!isLoggedIn.value) {
    router.push({ name: "login" });
    return;
  }

  try {
    if (isFavorite.value) {
      await FavoriteServices.removeFavorite(route.params.id);
      isFavorite.value = false;
    } else {
      await FavoriteServices.addFavorite(route.params.id);
      isFavorite.value = true;
    }
    showSnackbar(
      isFavorite.value ? "Added to favorites" : "Removed from favorites",
      "success"
    );
  } catch (error) {
    console.error("Error toggling favorite:", error);
    showSnackbar("Failed to update favorite", "error");
  }
}

async function submitReview() {
  if (!isLoggedIn.value) {
    router.push({ name: "login" });
    return;
  }

  try {
    const reviewData = {
      book_id: route.params.id,
      rating: reviewForm.value.rating,
      title: reviewForm.value.title || null,
      body: reviewForm.value.body,
    };

    if (myReview.value) {
      // Update existing review
      await ReviewServices.updateReview(myReview.value.id, reviewData);
      showSnackbar("Review updated successfully", "success");
    } else {
      // Create new review
      await ReviewServices.createReview(reviewData);
      showSnackbar("Review submitted successfully", "success");
    }

    showReviewForm.value = false;
    showEditReview.value = false;
    await loadReviews();
    await loadMyReview();
    await loadBook(); // Refresh book to update rating stats
  } catch (error) {
    console.error("Error submitting review:", error);
    showSnackbar(error.response?.data?.message || "Failed to submit review", "error");
  }
}

async function deleteReview() {
  if (!myReview.value) return;

  if (!confirm("Are you sure you want to delete your review?")) return;

  try {
    await ReviewServices.deleteReview(myReview.value.id);
    showSnackbar("Review deleted successfully", "success");
    myReview.value = null;
    reviewForm.value = { rating: 5, title: "", body: "" };
    await loadReviews();
    await loadBook();
  } catch (error) {
    console.error("Error deleting review:", error);
    showSnackbar("Failed to delete review", "error");
  }
}

async function markHelpful(reviewId) {
  if (!isLoggedIn.value) {
    router.push({ name: "login" });
    return;
  }

  try {
    await ReviewServices.markHelpful(reviewId);
    await loadReviews();
  } catch (error) {
    console.error("Error marking helpful:", error);
  }
}

async function markNotHelpful(reviewId) {
  if (!isLoggedIn.value) {
    router.push({ name: "login" });
    return;
  }

  try {
    await ReviewServices.markNotHelpful(reviewId);
    await loadReviews();
  } catch (error) {
    console.error("Error marking not helpful:", error);
  }
}

function canEditReview(review) {
  if (!isLoggedIn.value) return false;
  const userId = currentUser.value?.id || currentUser.value?.user?.id;
  const reviewUserId = review.user_id || review.user?.id;
  return userId === reviewUserId || isAdmin.value;
}

const isAdmin = computed(() => {
  return currentUser.value?.role === "admin" || currentUser.value?.user?.role === "admin";
});

function showSnackbar(text, color) {
  snackbar.value = { show: true, text, color };
}
</script>

<template>
  <v-container v-if="book">
    <div v-if="loading" class="text-center py-12">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
    </div>

    <div v-else>
      <!-- Hero Section -->
      <v-row class="mb-6">
        <v-col cols="12" md="4">
          <v-img
            v-if="book.cover_url"
            :src="book.cover_url"
            height="500"
            cover
            class="rounded-lg"
          >
            <template v-slot:placeholder>
              <div class="d-flex align-center justify-center fill-height">
                <v-progress-circular indeterminate color="grey-lighten-5"></v-progress-circular>
              </div>
            </template>
          </v-img>
          <div
            v-else
            class="d-flex align-center justify-center"
            style="height: 500px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px;"
          >
            <v-icon size="128" color="white">mdi-book-open-variant</v-icon>
          </div>
        </v-col>
        <v-col cols="12" md="8">
          <h1 class="text-h3 font-weight-bold mb-2">{{ book.title }}</h1>
          <h2 v-if="book.subtitle" class="text-h5 text-grey mb-4">{{ book.subtitle }}</h2>
          
          <div v-if="book.authors && book.authors.length > 0" class="mb-4">
            <strong>Authors:</strong>
            <span v-for="(author, index) in book.authors" :key="author.id" class="ml-2">
              {{ author.name }}{{ index < book.authors.length - 1 ? "," : "" }}
            </span>
          </div>

          <div class="mb-4">
            <v-rating
              v-if="averageRating !== null"
              :model-value="parseFloat(averageRating)"
              readonly
              half-increments
              size="large"
              color="amber"
              density="comfortable"
            ></v-rating>
            <span v-if="averageRating !== null" class="ml-2 text-h6">
              {{ averageRating }} ({{ ratingCount }} {{ ratingCount === 1 ? "rating" : "ratings" }})
            </span>
          </div>

          <div class="mb-4">
            <v-chip
              v-for="genre in book.genres || []"
              :key="genre.id || genre"
              class="mr-2 mb-2"
            >
              {{ genre.name || genre }}
            </v-chip>
          </div>

          <div class="mb-4 text-body-1">
            <div v-if="book.isbn"><strong>ISBN:</strong> {{ book.isbn }}</div>
            <div v-if="book.pub_date"><strong>Published:</strong> {{ book.pub_date }}</div>
            <div v-if="book.publisher"><strong>Publisher:</strong> {{ book.publisher }}</div>
            <div v-if="book.series"><strong>Series:</strong> {{ book.series }}</div>
            <div v-if="book.edition"><strong>Edition:</strong> {{ book.edition }}</div>
          </div>

          <!-- Tags -->
          <div v-if="book.tags && (Array.isArray(book.tags) ? book.tags.length > 0 : book.tags)" class="mb-4">
            <strong class="mr-2">Tags:</strong>
            <v-chip
              v-for="(tag, index) in (Array.isArray(book.tags) ? book.tags : [book.tags])"
              :key="index"
              size="small"
              class="mr-1 mb-1"
              variant="outlined"
            >
              {{ tag }}
            </v-chip>
          </div>

          <!-- Action Buttons -->
          <div class="mb-4">
            <v-btn
              color="primary"
              variant="flat"
              class="mr-2 mb-2"
              @click="toggleFavorite"
            >
              <v-icon start>{{ isFavorite ? "mdi-heart" : "mdi-heart-outline" }}</v-icon>
              {{ isFavorite ? "Remove from Favorites" : "Add to Favorites" }}
            </v-btn>
            <v-btn
              v-if="isLoggedIn"
              color="secondary"
              variant="flat"
              class="mr-2 mb-2"
              @click="showListDialog = true"
            >
              <v-icon start>mdi-bookmark-plus</v-icon>
              Add to List
            </v-btn>
          </div>

          <!-- Retailer Links -->
          <div v-if="book.retailer_links && (Array.isArray(book.retailer_links) ? book.retailer_links.length > 0 : book.retailer_links)" class="mb-4">
            <h3 class="text-h6 mb-2">Buy This Book</h3>
            <v-btn
              v-for="(link, index) in (Array.isArray(book.retailer_links) ? book.retailer_links : [book.retailer_links])"
              :key="index"
              :href="typeof link === 'string' ? link : link.url"
              target="_blank"
              variant="outlined"
              class="mr-2 mb-2"
            >
              {{ typeof link === 'object' && link.retailer ? link.retailer : "Buy" }}
            </v-btn>
          </div>
          <!-- Fallback to buy_links if retailer_links doesn't exist -->
          <div v-else-if="book.buy_links && book.buy_links.length > 0" class="mb-4">
            <h3 class="text-h6 mb-2">Buy This Book</h3>
            <v-btn
              v-for="link in book.buy_links"
              :key="link.retailer || link.url"
              :href="link.url"
              target="_blank"
              variant="outlined"
              class="mr-2 mb-2"
            >
              {{ link.retailer || "Buy" }}
            </v-btn>
          </div>
        </v-col>
      </v-row>

      <!-- Synopsis -->
      <v-row v-if="book.synopsis" class="mb-6">
        <v-col cols="12">
          <v-card>
            <v-card-title>Synopsis</v-card-title>
            <v-card-text class="text-body-1">
              {{ book.synopsis }}
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Reviews Section -->
      <v-row class="mb-6">
        <v-col cols="12">
          <v-card>
            <v-card-title class="d-flex justify-space-between align-center">
              <span>Reviews ({{ reviews.length }})</span>
              <v-btn
                v-if="isLoggedIn && !myReview && !showReviewForm"
                color="primary"
                variant="flat"
                @click="showReviewForm = true"
              >
                Write a Review
              </v-btn>
            </v-card-title>

            <!-- Review Form -->
            <v-card-text v-if="showReviewForm || showEditReview">
              <v-rating
                v-model="reviewForm.rating"
                color="amber"
                size="large"
                class="mb-4"
              ></v-rating>
              <v-text-field
                v-model="reviewForm.title"
                label="Review Title (optional)"
                class="mb-4"
              ></v-text-field>
              <v-textarea
                v-model="reviewForm.body"
                label="Your Review"
                rows="4"
                class="mb-4"
              ></v-textarea>
              <div>
                <v-btn color="primary" @click="submitReview">Submit</v-btn>
                <v-btn variant="text" @click="showReviewForm = false; showEditReview = false" class="ml-2">
                  Cancel
                </v-btn>
              </div>
            </v-card-text>

            <!-- My Review -->
            <v-card-text v-if="myReview && !showEditReview">
              <v-card variant="outlined" class="mb-4">
                <v-card-title class="d-flex justify-space-between">
                  <span>Your Review</span>
                  <div>
                    <v-btn icon size="small" @click="showEditReview = true">
                      <v-icon>mdi-pencil</v-icon>
                    </v-btn>
                    <v-btn icon size="small" @click="deleteReview">
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </div>
                </v-card-title>
                <v-card-text>
                  <v-rating
                    :model-value="myReview.rating"
                    readonly
                    color="amber"
                    size="small"
                    class="mb-2"
                  ></v-rating>
                  <div v-if="myReview.title" class="text-h6 mb-2">{{ myReview.title }}</div>
                  <div>{{ myReview.body }}</div>
                </v-card-text>
              </v-card>
            </v-card-text>

            <!-- Reviews List -->
            <v-card-text>
              <div v-if="reviews.length === 0" class="text-center py-4 text-grey">
                No reviews yet. Be the first to review!
              </div>
              <div v-for="review in reviews" :key="review.id" class="mb-4 pb-4 border-b">
                <div class="d-flex justify-space-between align-start mb-2">
                  <div>
                    <v-rating
                      :model-value="review.rating"
                      readonly
                      color="amber"
                      size="small"
                      density="compact"
                    ></v-rating>
                    <div v-if="review.title" class="text-h6 mt-1">{{ review.title }}</div>
                  </div>
                  <div v-if="canEditReview(review)" class="d-flex">
                    <v-btn
                      icon
                      size="small"
                      @click="() => { myReview = review; showEditReview = true; }"
                    >
                      <v-icon>mdi-pencil</v-icon>
                    </v-btn>
                    <v-btn
                      icon
                      size="small"
                      @click="() => { myReview = review; deleteReview(); }"
                    >
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </div>
                </div>
                <div class="text-body-2 mb-2">{{ review.body }}</div>
                <div class="text-caption text-grey mb-2">
                  By {{ review.user?.first_name || review.user?.email || "Anonymous" }}
                  <span v-if="review.created_at"> • {{ new Date(review.created_at).toLocaleDateString() }}</span>
                </div>
                <div class="d-flex align-center">
                  <v-btn
                    size="small"
                    variant="text"
                    @click="markHelpful(review.id)"
                  >
                    <v-icon start size="small">mdi-thumb-up</v-icon>
                    Helpful ({{ review.helpful_count || 0 }})
                  </v-btn>
                  <v-btn
                    size="small"
                    variant="text"
                    @click="markNotHelpful(review.id)"
                    class="ml-2"
                  >
                    <v-icon start size="small">mdi-thumb-down</v-icon>
                    Not Helpful ({{ review.not_helpful_count || 0 }})
                  </v-btn>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Similar Books -->
      <v-row v-if="similarBooks.length > 0" class="mb-6">
        <v-col cols="12">
          <h2 class="text-h5 mb-4">More Like This</h2>
          <v-row>
            <v-col
              v-for="similarBook in similarBooks"
              :key="similarBook.id"
              cols="12"
              sm="6"
              md="4"
              lg="3"
            >
              <BookCard :book="similarBook" />
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </div>

    <AddToListDialog
      v-model="showListDialog"
      :book="book"
      @close="showListDialog = false"
    />

    <v-snackbar v-model="snackbar.show" :color="snackbar.color">
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}
</style>

