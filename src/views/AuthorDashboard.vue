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
const showCreateProfile = ref(false);
const showEditBook = ref(false);
const editingBook = ref(null);
const profileNotFound = ref(false);

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
  // loadMyBooks() and loadReviews() are called from loadAuthorProfile() if profile exists
});

async function loadAuthorProfile() {
  loading.value = true;
  try {
    const response = await AuthorServices.getMyAuthorProfile();
    authorProfile.value = response.data;
    profileNotFound.value = false;
    if (authorProfile.value) {
      profileForm.value = {
        bio: authorProfile.value.bio || "",
        website: authorProfile.value.website || "",
        social_links: authorProfile.value.social_links || {},
      };
      // Load books and reviews after profile is loaded
      await Promise.all([loadMyBooks(), loadReviews()]);
    } else {
      // Profile exists but is null/undefined
      profileNotFound.value = true;
      authorProfile.value = null;
    }
  } catch (error) {
    console.error("Error loading author profile:", error);
    console.error("Full error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      fullURL: error.config?.baseURL + error.config?.url,
      code: error.code,
    });
    
    // If 404 or "not found" message, user doesn't have an author profile yet
    const isNotFound = error.response?.status === 404 || 
                      error.message?.toLowerCase().includes("not found") ||
                      error.response?.data?.message?.toLowerCase().includes("not found");
    
    if (isNotFound) {
      // This is normal - user just needs to create a profile
      profileNotFound.value = true;
      authorProfile.value = null;
      
      // Initialize profile form with user's name
      const userName = currentUser.value?.firstName || 
                       currentUser.value?.first_name || 
                       currentUser.value?.name || 
                       currentUser.value?.user?.first_name || 
                       "";
      profileForm.value = {
        name: userName,
        bio: "",
        website: "",
        social_links: {},
      };
      
      // Don't show error for 404 - it's expected if no profile exists
      console.log("No author profile found - user can create one");
    } else {
      // Real error (network, server error, etc.)
      const errorMsg = error.response?.data?.message || error.message || "Failed to load author profile";
      showSnackbar(
        errorMsg + ". If you have an author profile, please contact support.",
        "error"
      );
      authorProfile.value = null;
      profileNotFound.value = true;
    }
  } finally {
    loading.value = false;
  }
}

async function loadMyBooks() {
  try {
    // If author profile exists, load books by author ID
    if (authorProfile.value?.id) {
      console.log("Loading books for author ID:", authorProfile.value.id);
      
      try {
        // First try the /authors/me/books endpoint (if it exists)
        const myBooksResponse = await AuthorServices.getMyBooks();
        myBooks.value = Array.isArray(myBooksResponse.data) 
          ? myBooksResponse.data 
          : myBooksResponse.data?.books || myBooksResponse.data?.data || [];
        console.log(`✅ Loaded ${myBooks.value.length} books via authors/me/books`);
      } catch (error) {
        // If /authors/me/books doesn't exist, try /authors/:id/books
        if (error.response?.status === 404) {
          try {
            console.log("Trying authors/:id/books endpoint...");
            const response = await AuthorServices.getAuthorBooks(authorProfile.value.id);
            myBooks.value = Array.isArray(response.data) 
              ? response.data 
              : response.data?.books || response.data?.data || [];
            console.log(`✅ Loaded ${myBooks.value.length} books via authors/${authorProfile.value.id}/books`);
          } catch (error2) {
            // If that also fails, try fetching all books and filtering by author
            if (error2.response?.status === 404) {
              console.warn("Authors/:id/books endpoint not found, trying fallback method...");
              
              try {
                // Fetch all books and filter by author_id
                const allBooksResponse = await BookServices.getBooks({});
                const allBooks = Array.isArray(allBooksResponse.data)
                  ? allBooksResponse.data
                  : allBooksResponse.data?.books || allBooksResponse.data?.items || [];
                
                console.log(`Fetched ${allBooks.length} total books, filtering by author...`);
                
                // Filter books by author_id
                myBooks.value = allBooks.filter(book => {
                  // Check if book has this author in its authors array
                  if (book.authors && Array.isArray(book.authors)) {
                    const hasAuthor = book.authors.some(author => 
                      author.id === authorProfile.value.id || 
                      author.user_id === authorProfile.value.user_id ||
                      String(author.id) === String(authorProfile.value.id)
                    );
                    if (hasAuthor) {
                      console.log(`Found book "${book.title}" by author match`);
                    }
                    return hasAuthor;
                  }
                  // Or check if book has author_id field
                  const matches = book.author_id === authorProfile.value.id || 
                                 book.author_id === authorProfile.value.user_id ||
                                 String(book.author_id) === String(authorProfile.value.id);
                  if (matches) {
                    console.log(`Found book "${book.title}" by author_id match`);
                  }
                  return matches;
                });
                
                console.log(`✅ Loaded ${myBooks.value.length} books via fallback method`);
              } catch (fallbackError) {
                console.error("Fallback method also failed:", fallbackError);
                throw error2; // Throw original error
              }
            } else {
              throw error2;
            }
          }
        } else {
          throw error;
        }
      }
    } else {
      // If no author profile, can't load books
      console.log("No author profile found, cannot load books");
      myBooks.value = [];
    }
  } catch (error) {
    console.error("Error loading books:", error);
    console.error("Full error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
    });
    // If 404, author might not have books yet - don't show error
    if (error.response?.status !== 404) {
      showSnackbar(error.response?.data?.message || "Failed to load your books", "error");
    }
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

async function createProfile() {
  try {
    const userName = currentUser.value?.firstName || 
                     currentUser.value?.first_name || 
                     currentUser.value?.name || 
                     currentUser.value?.user?.first_name || 
                     "";
    
    if (!userName) {
      showSnackbar("Unable to get user name. Please try logging in again.", "error");
      return;
    }

    const response = await AuthorServices.requestAuthorProfile({
      name: userName,
      bio: profileForm.value.bio || null,
      website: profileForm.value.website || null,
    });
    
    console.log("Author profile created:", response.data);
    authorProfile.value = response.data;
    profileNotFound.value = false;
    
    // Show appropriate message based on status
    if (response.data?.status === 'approved') {
      showSnackbar("Author profile created and approved! You can now add books.", "success");
    } else {
      showSnackbar("Author profile created successfully! Waiting for admin approval before you can add books.", "success");
    }
    
    showCreateProfile.value = false;
    // Reload profile to get the newly created one
    await loadAuthorProfile();
    // Also reload books in case profile was just approved
    await loadMyBooks();
  } catch (error) {
    console.error("Error creating profile:", error);
    const errorMsg = error.response?.data?.message || "Failed to create author profile";
    
    // If user already has a profile, try to reload it
    if (errorMsg.toLowerCase().includes('already have') || errorMsg.toLowerCase().includes('already exists')) {
      showSnackbar("You already have an author profile. Loading it now...", "info");
      await loadAuthorProfile();
    } else {
      showSnackbar(errorMsg, "error");
    }
  }
}

async function updateProfile() {
  try {
    // Check if authorProfile exists and has an id
    if (!authorProfile.value || !authorProfile.value.id) {
      showSnackbar("Author profile not found. Please create one first.", "error");
      showEditProfile.value = false;
      
      // Try to reload profile in case it exists but wasn't loaded
      await loadAuthorProfile();
      
      // Check again after reload
      if (!authorProfile.value || !authorProfile.value.id) {
        return;
      }
    }
    
    const authorId = authorProfile.value.id;
    
    // Prepare update data - only send fields that can be updated
    const updateData = {
      bio: profileForm.value.bio || null,
      website: profileForm.value.website || null,
    };
    
    // Only include social_links if it's an object
    if (profileForm.value.social_links && typeof profileForm.value.social_links === 'object') {
      updateData.social_links = profileForm.value.social_links;
    }
    
    await AuthorServices.updateAuthorProfile(authorId, updateData);
    showSnackbar("Profile updated successfully", "success");
    showEditProfile.value = false;
    await loadAuthorProfile();
  } catch (error) {
    console.error("Error updating profile:", error);
    console.error("Author profile state:", authorProfile.value);
    const errorMsg = error.response?.data?.message || error.message || "Failed to update profile";
    showSnackbar(errorMsg, "error");
    
    // If it's a 403 or 404, reload the profile in case it changed
    if (error.response?.status === 403 || error.response?.status === 404) {
      await loadAuthorProfile();
    }
  }
}

async function deleteBook(bookId) {
  if (!confirm("Are you sure you want to delete this book? This action cannot be undone.")) {
    return;
  }

  try {
    await BookServices.deleteBook(bookId);
    showSnackbar("Book deleted successfully", "success");
    await loadMyBooks();
  } catch (error) {
    console.error("Error deleting book:", error);
    const errorMsg = error.response?.data?.message || "Failed to delete book";
    showSnackbar(errorMsg, "error");
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
    // Check if user has an approved author profile before allowing book creation
    if (!authorProfile.value || !authorProfile.value.id) {
      showSnackbar("Please create your author profile first before adding books.", "error");
      showCreateProfile.value = true;
      showEditBook.value = false; // Close book dialog
      return;
    }

    if (authorProfile.value.status !== 'approved') {
      showSnackbar("Your author profile must be approved before you can create books. Please wait for admin approval.", "error");
      showEditBook.value = false; // Close book dialog
      return;
    }

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
    const errorMsg = error.response?.data?.message || error.message || "Failed to save book";
    
    // If 403 error about needing approved author profile, show helpful message
    if (error.response?.status === 403 && (errorMsg.toLowerCase().includes('approved author profile') || errorMsg.toLowerCase().includes('author profile'))) {
      showSnackbar("You need an approved author profile to create books. Please create your profile and wait for admin approval.", "error");
      // Reload profile to check current status
      await loadAuthorProfile();
      // If no profile exists, show create dialog
      if (!authorProfile.value || !authorProfile.value.id) {
        showCreateProfile.value = true;
      }
      showEditBook.value = false; // Close book dialog
    } else {
      showSnackbar(errorMsg, "error");
    }
  }
}

function showSnackbar(text, color) {
  snackbar.value = { show: true, text, color };
}

function openEditProfile() {
  // Ensure profile is loaded before opening edit dialog
  if (!authorProfile.value || !authorProfile.value.id) {
    showSnackbar("Author profile not loaded. Please wait...", "warning");
    loadAuthorProfile().then(() => {
      if (authorProfile.value && authorProfile.value.id) {
        showEditProfile.value = true;
      }
    });
    return;
  }
  showEditProfile.value = true;
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
          <v-btn 
            v-if="authorProfile && authorProfile.id" 
            color="primary" 
            variant="text" 
            @click="openEditProfile"
            :disabled="loading"
          >
            <v-icon start>mdi-pencil</v-icon>
            Edit Profile
          </v-btn>
          <v-btn 
            v-else 
            color="primary" 
            variant="flat" 
            @click="showCreateProfile = true"
            :disabled="loading"
          >
            <v-icon start>mdi-account-plus</v-icon>
            Create Author Profile
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
        <v-card-text v-else>
          <div class="text-center py-4">
            <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-account-circle</v-icon>
            <p class="text-h6 mb-2">No Author Profile Yet</p>
            <p class="text-body-2 text-grey mb-4">
              Create your author profile to start adding books and managing your publications.
            </p>
            <v-btn color="primary" variant="flat" @click="showCreateProfile = true">
              <v-icon start>mdi-account-plus</v-icon>
              Create Author Profile
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <!-- My Books -->
      <v-card class="mb-6">
        <v-card-title class="d-flex justify-space-between align-center">
          <span>My Books ({{ myBooks.length }})</span>
          <v-btn 
            color="primary" 
            variant="flat" 
            @click="openEditBook(null)"
            :disabled="!authorProfile || !authorProfile.id || authorProfile.status !== 'approved'"
          >
            <v-icon start>mdi-plus</v-icon>
            Add Book
          </v-btn>
          <v-tooltip v-if="authorProfile && authorProfile.status !== 'approved'" activator="parent">
            You must have an approved author profile to create books!
          </v-tooltip>
        </v-card-title>
        <v-card-text v-if="!authorProfile || !authorProfile.id" class="text-center py-4">
          <p class="text-body-2 text-grey mb-2">
            Please create your author profile first before adding books.
          </p>
          <v-btn color="primary" variant="outlined" @click="showCreateProfile = true">
            Create Author Profile
          </v-btn>
        </v-card-text>
        <v-card-text v-else-if="authorProfile.status !== 'approved'" class="text-center py-4">
          <v-alert type="warning" variant="tonal" class="mb-4">
            <v-alert-title>Profile Pending Approval</v-alert-title>
            Your author profile is currently <strong>{{ authorProfile.status }}</strong>. 
            You'll be able to add books once your profile is approved by an administrator.
          </v-alert>
          <v-btn color="primary" variant="outlined" @click="showEditProfile = true">
            Update Profile
          </v-btn>
        </v-card-text>
        <v-card-text v-else>
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
                  <div class="d-flex align-center" style="gap: 4px">
                    <v-btn
                      icon
                      size="small"
                      color="primary"
                      @click="openEditBook(book)"
                      title="Edit Book"
                    >
                      <v-icon>mdi-pencil</v-icon>
                    </v-btn>
                    <v-btn
                      icon
                      size="small"
                      color="error"
                      @click="deleteBook(book.id)"
                      title="Delete Book"
                    >
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                    <v-btn
                      icon
                      size="small"
                      color="info"
                      :to="{ name: 'bookDetail', params: { id: book.id } }"
                      title="View Book"
                    >
                      <v-icon>mdi-eye</v-icon>
                    </v-btn>
                  </div>
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

      <!-- Create Profile Dialog -->
      <v-dialog v-model="showCreateProfile" max-width="600">
        <v-card>
          <v-card-title>Create Author Profile</v-card-title>
          <v-card-text>
            <div class="mb-4">
              <strong>Name:</strong> {{ currentUser?.firstName || currentUser?.first_name || currentUser?.name || "N/A" }}
            </div>
            <v-textarea
              v-model="profileForm.bio"
              label="Bio"
              rows="4"
              class="mb-4"
              hint="Tell readers about yourself and your writing"
              persistent-hint
            ></v-textarea>
            <v-text-field
              v-model="profileForm.website"
              label="Website URL (optional)"
              class="mb-4"
              hint="Your personal website or author page"
              persistent-hint
            ></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="showCreateProfile = false">Cancel</v-btn>
            <v-btn color="primary" variant="flat" @click="createProfile">Create Profile</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

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

