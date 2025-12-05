<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AuthorServices from "../services/AuthorServices";
import BookServices from "../services/BookServices";
import ReviewServices from "../services/ReviewServices";
import { useAuth } from "../composables/useAuth";

const router = useRouter();
const { isLoggedIn, isWriter, currentUser } = useAuth();

const authorProfile = ref(null);
const myBooks = ref([]);
const reviews = ref([]);
const loading = ref(false);
const showEditProfile = ref(false);
const showEditBook = ref(false);
const editingBook = ref(null);

const profileForm = ref({
  bio: "",
  website: "",
  social_links: {},
});

const bookForm = ref({
  title: "",
  isbn: "",
  pub_date: "",
  cover_url: "",
  synopsis: "",
  publisher: "",
  subtitle: "",
  series: "",
  edition: "",
  genres: [],
  tags: [],
  retailer_links: [],
});

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

  if (!isWriter.value) {
    showSnackbar("Access denied. Writer role required.", "error");
    router.push({ name: "books" });
    return;
  }

  await loadAuthorProfile();
  await loadMyBooks();
  await loadReviews();
});

async function loadAuthorProfile() {
  loading.value = true;
  try {
    const response = await AuthorServices.getMyAuthorProfile();
    authorProfile.value = response.data;
    if (authorProfile.value) {
      profileForm.value = {
        bio: authorProfile.value.bio || "",
        website: authorProfile.value.website || "",
        social_links: authorProfile.value.social_links || {},
      };
    }
  } catch (error) {
    console.error("Error loading author profile:", error);
    showSnackbar("Failed to load author profile", "error");
  } finally {
    loading.value = false;
  }
}

async function loadMyBooks() {
  try {
    if (!authorProfile.value?.id) return;
    const response = await AuthorServices.getAuthorBooks(authorProfile.value.id);
    myBooks.value = response.data || [];
  } catch (error) {
    console.error("Error loading books:", error);
    myBooks.value = [];
  }
}

async function loadReviews() {
  try {
    if (!authorProfile.value?.id) return;
    const response = await AuthorServices.getAuthorBookReviews(authorProfile.value.id);
    reviews.value = response.data || [];
  } catch (error) {
    console.error("Error loading reviews:", error);
    reviews.value = [];
  }
}

async function updateProfile() {
  try {
    await AuthorServices.updateAuthorProfile(authorProfile.value.id, profileForm.value);
    showSnackbar("Profile updated successfully", "success");
    showEditProfile.value = false;
    await loadAuthorProfile();
  } catch (error) {
    console.error("Error updating profile:", error);
    showSnackbar(error.response?.data?.message || "Failed to update profile", "error");
  }
}

function openEditBook(book) {
  editingBook.value = book ? { ...book } : null;
  if (book) {
    // Convert genres array to comma-separated string for display
    let genresDisplay = book.genres || [];
    if (Array.isArray(genresDisplay)) {
      genresDisplay = genresDisplay.map(g => g.name || g).join(', ');
    } else if (typeof genresDisplay === 'string') {
      // Already a string
    } else {
      genresDisplay = '';
    }

    // Convert tags array to comma-separated string for display
    let tagsDisplay = book.tags || [];
    if (Array.isArray(tagsDisplay)) {
      tagsDisplay = tagsDisplay.map(t => t.name || t).join(', ');
    } else if (typeof tagsDisplay === 'string') {
      // Already a string
    } else {
      tagsDisplay = '';
    }

    // Convert retailer_links to JSON string for display
    let retailerLinksDisplay = book.retailer_links || [];
    if (Array.isArray(retailerLinksDisplay) && retailerLinksDisplay.length > 0) {
      retailerLinksDisplay = JSON.stringify(retailerLinksDisplay, null, 2);
    } else if (typeof retailerLinksDisplay === 'string') {
      // Already a string
    } else {
      retailerLinksDisplay = '';
    }

    bookForm.value = {
      title: book.title || "",
      isbn: book.isbn || "",
      pub_date: book.pub_date || "",
      cover_url: book.cover_url || "",
      synopsis: book.synopsis || "",
      publisher: book.publisher || "",
      subtitle: book.subtitle || "",
      series: book.series || "",
      edition: book.edition || "",
      genres: genresDisplay,
      tags: tagsDisplay,
      retailer_links: retailerLinksDisplay,
    };
  } else {
    bookForm.value = {
      title: "",
      isbn: "",
      pub_date: "",
      cover_url: "",
      synopsis: "",
      publisher: "",
      subtitle: "",
      series: "",
      edition: "",
      genres: "",
      tags: "",
      retailer_links: "",
    };
  }
  showEditBook.value = true;
}

async function saveBook() {
  try {
    // Process genres - convert string to array if needed
    let genres = bookForm.value.genres;
    if (typeof genres === 'string' && genres.trim()) {
      genres = genres.split(',').map(g => g.trim()).filter(g => g);
    } else if (!Array.isArray(genres)) {
      genres = [];
    }

    // Process tags - convert string to array if needed
    let tags = bookForm.value.tags;
    if (typeof tags === 'string' && tags.trim()) {
      tags = tags.split(',').map(t => t.trim()).filter(t => t);
    } else if (!Array.isArray(tags)) {
      tags = [];
    }

    // Process retailer_links - convert string to array/object if needed
    let retailer_links = bookForm.value.retailer_links;
    if (typeof retailer_links === 'string' && retailer_links.trim()) {
      try {
        // Try to parse as JSON first
        retailer_links = JSON.parse(retailer_links);
      } catch (e) {
        // If not JSON, treat as one URL per line
        const lines = retailer_links.split('\n').filter(l => l.trim());
        retailer_links = lines.map(url => ({ url: url.trim() }));
      }
    } else if (!Array.isArray(retailer_links)) {
      retailer_links = [];
    }

    const bookData = {
      ...bookForm.value,
      genres,
      tags,
      retailer_links,
    };

    if (editingBook.value) {
      await BookServices.updateBook(editingBook.value.id, bookData);
      showSnackbar("Book updated successfully", "success");
    } else {
      await BookServices.addBook(bookData);
      showSnackbar("Book added successfully", "success");
    }
    showEditBook.value = false;
    editingBook.value = null;
    await loadMyBooks();
  } catch (error) {
    console.error("Error saving book:", error);
    showSnackbar(error.response?.data?.message || "Failed to save book", "error");
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

    <div v-else>
      <h1 class="text-h4 font-weight-bold mb-6">Author Dashboard</h1>

      <!-- Author Profile -->
      <v-card class="mb-6">
        <v-card-title class="d-flex justify-space-between align-center">
          <span>Author Profile</span>
          <v-btn color="primary" variant="text" @click="showEditProfile = true">
            <v-icon start>mdi-pencil</v-icon>
            Edit
          </v-btn>
        </v-card-title>
        <v-card-text v-if="authorProfile">
          <div class="mb-2">
            <strong>Name:</strong> {{ authorProfile.name || currentUser?.first_name || "N/A" }}
          </div>
          <div class="mb-2">
            <strong>Status:</strong>
            <v-chip size="small" :color="authorProfile.status === 'approved' ? 'success' : 'warning'" class="ml-2">
              {{ authorProfile.status || "pending" }}
            </v-chip>
          </div>
          <div v-if="authorProfile.bio" class="mb-2">
            <strong>Bio:</strong>
            <p>{{ authorProfile.bio }}</p>
          </div>
          <div v-if="authorProfile.website" class="mb-2">
            <strong>Website:</strong>
            <a :href="authorProfile.website" target="_blank">{{ authorProfile.website }}</a>
          </div>
        </v-card-text>
      </v-card>

      <!-- My Books -->
      <v-card class="mb-6">
        <v-card-title class="d-flex justify-space-between align-center">
          <span>My Books ({{ myBooks.length }})</span>
          <v-btn color="primary" variant="flat" @click="openEditBook(null)">
            <v-icon start>mdi-plus</v-icon>
            Add Book
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-table v-if="myBooks.length > 0">
            <thead>
              <tr>
                <th>Title</th>
                <th>ISBN</th>
                <th>Published</th>
                <th>Rating</th>
                <th>Reviews</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="book in myBooks" :key="book.id">
                <td>{{ book.title }}</td>
                <td>{{ book.isbn || "N/A" }}</td>
                <td>{{ book.pub_date || "N/A" }}</td>
                <td>
                  <v-rating
                    v-if="book.average_rating"
                    :model-value="parseFloat(book.average_rating)"
                    readonly
                    size="small"
                    density="compact"
                    color="amber"
                  ></v-rating>
                  <span v-else>No ratings</span>
                </td>
                <td>{{ book.rating_count || 0 }}</td>
                <td>
                  <v-btn
                    icon
                    size="small"
                    @click="openEditBook(book)"
                  >
                    <v-icon>mdi-pencil</v-icon>
                  </v-btn>
                  <v-btn
                    icon
                    size="small"
                    color="primary"
                    :to="{ name: 'bookDetail', params: { id: book.id } }"
                  >
                    <v-icon>mdi-eye</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <div v-else class="text-center py-4 text-grey">
            No books yet. Add your first book!
          </div>
        </v-card-text>
      </v-card>

      <!-- Reviews on My Books -->
      <v-card>
        <v-card-title>Reviews on My Books ({{ reviews.length }})</v-card-title>
        <v-card-text>
          <div v-if="reviews.length === 0" class="text-center py-4 text-grey">
            No reviews yet.
          </div>
          <div v-for="review in reviews" :key="review.id" class="mb-4 pb-4 border-b">
            <div class="d-flex justify-space-between mb-2">
              <div>
                <v-rating
                  :model-value="review.rating"
                  readonly
                  size="small"
                  color="amber"
                ></v-rating>
                <strong class="ml-2">{{ review.book?.title }}</strong>
              </div>
            </div>
            <div v-if="review.title" class="text-h6 mb-1">{{ review.title }}</div>
            <div class="text-body-2 mb-2">{{ review.body }}</div>
            <div class="text-caption text-grey">
              By {{ review.user?.first_name || review.user?.email || "Anonymous" }}
              <span v-if="review.created_at"> • {{ new Date(review.created_at).toLocaleDateString() }}</span>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- Edit Profile Dialog -->
      <v-dialog v-model="showEditProfile" max-width="600">
        <v-card>
          <v-card-title>Edit Author Profile</v-card-title>
          <v-card-text>
            <v-textarea
              v-model="profileForm.bio"
              label="Bio"
              rows="4"
              class="mb-4"
            ></v-textarea>
            <v-text-field
              v-model="profileForm.website"
              label="Website URL"
              class="mb-4"
            ></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="showEditProfile = false">Cancel</v-btn>
            <v-btn color="primary" variant="flat" @click="updateProfile">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Edit Book Dialog -->
      <v-dialog v-model="showEditBook" max-width="900" scrollable>
        <v-card>
          <v-card-title>{{ editingBook ? "Edit Book" : "Add New Book" }}</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="bookForm.title"
                  label="Title"
                  required
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="bookForm.subtitle"
                  label="Subtitle"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="bookForm.isbn"
                  label="ISBN"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="bookForm.pub_date"
                  label="Publication Date"
                  type="date"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="bookForm.publisher"
                  label="Publisher"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="bookForm.series"
                  label="Series"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="bookForm.edition"
                  label="Edition"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="bookForm.cover_url"
                  label="Cover URL"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="bookForm.synopsis"
                  label="Synopsis"
                  rows="4"
                ></v-textarea>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="bookForm.genres"
                  label="Genres (comma-separated)"
                  hint="Enter genres separated by commas, e.g., Fiction, Mystery, Romance"
                  persistent-hint
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="bookForm.tags"
                  label="Tags (comma-separated)"
                  hint="Enter tags separated by commas, e.g., bestseller, award-winning, new-release"
                  persistent-hint
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="bookForm.retailer_links"
                  label="Retailer Links (JSON format or one per line)"
                  hint='Format: [{"retailer": "Amazon", "url": "https://..."}, {"retailer": "Barnes & Noble", "url": "https://..."}] or one URL per line'
                  rows="4"
                  persistent-hint
                ></v-textarea>
              </v-col>
            </v-row>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="showEditBook = false">Cancel</v-btn>
            <v-btn color="primary" variant="flat" @click="saveBook">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-snackbar v-model="snackbar.show" :color="snackbar.color">
        {{ snackbar.text }}
        <template v-slot:actions>
          <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
        </template>
      </v-snackbar>
    </div>
  </v-container>
</template>

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}
</style>

