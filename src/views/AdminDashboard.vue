<!-- eslint-disable -->
<script setup>
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import AdminServices from "../services/AdminServices";
import BookServices from "../services/BookServices";
import apiClient from "../services/services";
import { useAuth } from "../composables/useAuth";

const router = useRouter();
const { isLoggedIn, isAdmin } = useAuth();

const tab = ref("books"); // Default to books to match the image
const authorSubTab = ref("all"); // Sub-tab for authors section
const users = ref([]);
const authorRequests = ref([]);
const authors = ref([]);
const books = ref([]);
const loading = ref({
  users: false,
  authors: false,
  authorRequests: false,
  books: false,
});
const showCreateAuthorDialog = ref(false);
const selectedUserForAuthor = ref(null);
const newAuthorForm = ref({
  name: "",
  bio: "",
  website: "",
});
const showEditBook = ref(false);
const editingBook = ref(null);
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
  genres: "",
  tags: "",
  retailer_links: "",
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

  if (!isAdmin.value) {
    showSnackbar("Access denied. Admin role required.", "error");
    router.push({ name: "books" });
    return;
  }

  await loadData();
});

// Watch for author sub-tab changes
watch(authorSubTab, async (newTab) => {
  if (tab.value === "authors") {
    if (newTab === "all") {
      await loadAuthors();
    } else if (newTab === "requests") {
      await loadAuthorRequests();
    }
  }
});

async function loadData() {
  if (tab.value === "users") {
    await loadUsers();
  } else if (tab.value === "authors") {
    // Load both authors and requests when on authors tab
    await Promise.all([loadAuthors(), loadAuthorRequests()]);
  } else if (tab.value === "books") {
    await loadBooks();
  }
}

function selectTab(tabName) {
  tab.value = tabName;
  if (tabName === "authors") {
    authorSubTab.value = "all";
  }
  loadData();
}

async function loadUsers() {
  loading.value.users = true;
  try {
    const response = await AdminServices.getUsers();
    users.value = Array.isArray(response.data)
      ? response.data
      : response.data?.users || [];
  } catch (error) {
    console.error("Error loading users:", error);
    console.error("Full error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
    });
    
    const errorMsg = error.message || error.response?.data?.message || "Failed to load users from the server.";
    showSnackbar(errorMsg, "error");
    users.value = [];
  } finally {
    loading.value.users = false;
  }
}

async function loadAuthorRequests() {
  loading.value.authorRequests = true;
  try {
    const response = await AdminServices.getAuthorRequests();
    authorRequests.value = Array.isArray(response.data)
      ? response.data
      : response.data?.requests || [];
  } catch (error) {
    console.error("Error loading author requests:", error);
    console.error("Full error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
    });
    
    const errorMsg = error.message || error.response?.data?.message || "Failed to load author requests from the server.";
    showSnackbar(errorMsg, "error");
    authorRequests.value = [];
  } finally {
    loading.value.authorRequests = false;
  }
}

async function loadAuthors() {
  loading.value.authors = true;
  try {
    const response = await AdminServices.getAllAuthors();
    
    // Handle various response formats
    let authorsData = [];
    if (Array.isArray(response.data)) {
      authorsData = response.data;
    } else if (response.data && typeof response.data === 'object') {
      // Try different possible keys
      authorsData = response.data.authors || 
                   response.data.data || 
                   response.data.items || 
                   response.data.results || 
                   [];
    }
    
    authors.value = authorsData;
    
    // Debug: Log what we got
    console.log("=== Authors Loading Debug ===");
    console.log("Response:", response);
    console.log("Response.data:", response.data);
    console.log("Authors found:", authors.value.length);
    console.log("Authors data:", authors.value);
    
    if (authors.value.length === 0) {
      console.warn("⚠️ No authors found. Possible reasons:");
      console.warn("1. Backend is filtering by status='approved' only");
      console.warn("2. All authors in database have status other than 'approved'");
      console.warn("3. Backend route /authors/ might need a status parameter");
      console.warn("4. Response format might be different than expected");
      
      // Try to fetch with explicit status parameters
      console.log("Attempting to fetch authors with different status filters...");
      try {
        const allStatuses = ['approved', 'pending', 'denied'];
        const allAuthors = [];
        
        for (const status of allStatuses) {
          try {
            const statusResponse = await apiClient.get("authors/", { params: { status } });
            const statusAuthors = Array.isArray(statusResponse.data) 
              ? statusResponse.data 
              : statusResponse.data?.authors || [];
            allAuthors.push(...statusAuthors);
            console.log(`Found ${statusAuthors.length} authors with status '${status}'`);
          } catch (e) {
            console.warn(`Could not fetch authors with status '${status}':`, e.message);
          }
        }
        
        // Remove duplicates
        const uniqueAuthors = allAuthors.filter((author, index, self) =>
          index === self.findIndex(a => a.id === author.id)
        );
        
        if (uniqueAuthors.length > 0) {
          console.log(`✅ Found ${uniqueAuthors.length} total authors across all statuses`);
          authors.value = uniqueAuthors;
        }
      } catch (e) {
        console.error("Error fetching authors by status:", e);
      }
    } else {
      console.log(`✅ Successfully loaded ${authors.value.length} authors`);
    }
  } catch (error) {
    console.error("Error loading authors:", error);
    console.error("Full error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
    });
    const errorMsg = error.response?.data?.message || "Failed to load authors";
    showSnackbar(errorMsg, "error");
    authors.value = [];
  } finally {
    loading.value.authors = false;
  }
}

async function loadBooks() {
  loading.value.books = true;
  try {
    const response = await AdminServices.getAllBooks();
    
    // Handle different response formats
    let booksData = [];
    if (Array.isArray(response.data)) {
      booksData = response.data;
    } else if (response.data && typeof response.data === 'object') {
      // Try different possible keys
      booksData = response.data.books || 
                  response.data.data || 
                  response.data.items || 
                  response.data.results || 
                  [];
    }
    
    books.value = booksData;
    
    console.log("=== Books Loading Debug ===");
    console.log("Response:", response);
    console.log("Response.data:", response.data);
    console.log("Books found:", books.value.length);
    
    if (books.value.length === 0) {
      console.warn("No books found. Response structure:", response);
    }
  } catch (error) {
    console.error("Error loading books:", error);
    console.error("Full error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
    });
    const errorMsg = error.response?.data?.message || error.message || "Failed to load books";
    showSnackbar(errorMsg, "error");
    books.value = [];
  } finally {
    loading.value.books = false;
  }
}

async function updateUserRole(userId, newRole) {
  try {
    await AdminServices.updateUserRole(userId, newRole);
    showSnackbar("User role updated successfully", "success");
    await loadUsers();
    // If role changed to writer, reload authors to see if they need an author profile
    if (newRole === "writer") {
      await loadAuthors();
    }
  } catch (error) {
    console.error("Error updating user role:", error);
    showSnackbar(error.response?.data?.message || "Failed to update user role", "error");
  }
}

function openCreateAuthorDialog(user) {
  selectedUserForAuthor.value = user;
  newAuthorForm.value = {
    name: user.first_name || user.firstName || user.email || "",
    bio: "",
    website: "",
  };
  showCreateAuthorDialog.value = true;
}

async function createAuthorForUser() {
  if (!selectedUserForAuthor.value) return;
  
  try {
    // Note: Backend may need to support admin creating authors for other users
    // If backend uses req.userId from token, this will create author for admin
    // Backend should be updated to accept user_id parameter when admin makes request
    await AdminServices.createAuthorForUser({
      name: newAuthorForm.value.name,
      bio: newAuthorForm.value.bio || null,
      website: newAuthorForm.value.website || null,
      // Backend should check if admin and allow user_id override
      user_id: selectedUserForAuthor.value.id,
      status: "approved", // Auto-approve when created by admin
    });
    showSnackbar("Author profile created successfully", "success");
    showCreateAuthorDialog.value = false;
    selectedUserForAuthor.value = null;
    newAuthorForm.value = { name: "", bio: "", website: "" };
    await loadAuthors();
    await loadUsers();
  } catch (error) {
    console.error("Error creating author:", error);
    const errorMsg = error.response?.data?.message || "Failed to create author profile";
    showSnackbar(
      errorMsg + (errorMsg.includes("already have") ? " - User may already have an author profile." : ""),
      "error"
    );
  }
}

function userHasAuthorProfile(userId) {
  return authors.value.some(a => a.user_id === userId || a.user?.id === userId);
}

async function approveAuthorRequest(authorId) {
  try {
    await AdminServices.approveAuthorRequest(authorId);
    showSnackbar("Author request approved", "success");
    // Reload both lists in parallel to keep them in sync
    const isAuthorsTab = tab.value === "authors";
    await Promise.all([
      isAuthorsTab ? loadAuthors() : loadAuthorRequests(),
      isAuthorsTab ? loadAuthorRequests() : loadAuthors(),
    ]);
  } catch (error) {
    console.error("Error approving author request:", error);
    showSnackbar(error.response?.data?.message || "Failed to approve request", "error");
  }
}

async function denyAuthorRequest(authorId) {
  if (!confirm("Are you sure you want to deny this author request?")) return;

  try {
    await AdminServices.denyAuthorRequest(authorId);
    showSnackbar("Author request denied", "success");
    // Reload both lists in parallel to keep them in sync
    const isAuthorsTab = tab.value === "authors";
    await Promise.all([
      isAuthorsTab ? loadAuthors() : loadAuthorRequests(),
      isAuthorsTab ? loadAuthorRequests() : loadAuthors(),
    ]);
  } catch (error) {
    console.error("Error denying author request:", error);
    showSnackbar(error.response?.data?.message || "Failed to deny request", "error");
  }
}

async function deleteBook(bookId) {
  if (!confirm("Are you sure you want to delete this book? This action cannot be undone.")) return;

  try {
    await BookServices.deleteBook(bookId);
    showSnackbar("Book deleted successfully", "success");
    await loadBooks();
  } catch (error) {
    console.error("Error deleting book:", error);
    showSnackbar(error.response?.data?.message || "Failed to delete book", "error");
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
    await loadBooks();
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
  <div class="admin-dashboard">
    <!-- Sidebar -->
    <v-navigation-drawer
      permanent
      width="250"
      class="admin-sidebar"
      style="background-color: #8B0000; border-right: 2px solid #8B0000;"
    >
      <div class="pa-4">
        <h2 class="text-h5 font-weight-bold white--text mb-6">Admin</h2>
        <v-list nav dense class="admin-nav-list">
          <v-list-item
            :class="['admin-nav-item', { 'active': tab === 'books' }]"
            @click="selectTab('books')"
          >
            <v-list-item-title class="white--text">Manage Books</v-list-item-title>
          </v-list-item>
          <v-list-item
            :class="['admin-nav-item', { 'active': tab === 'users' }]"
            @click="selectTab('users')"
          >
            <v-list-item-title class="white--text">Manage User</v-list-item-title>
          </v-list-item>
          <v-list-item
            :class="['admin-nav-item', { 'active': tab === 'authors' || tab === 'author-requests' }]"
            @click="selectTab('authors')"
          >
            <v-list-item-title class="white--text">Manage Authors</v-list-item-title>
          </v-list-item>
          <v-list-item
            :class="['admin-nav-item', { 'active': tab === 'settings' }]"
            @click="selectTab('settings')"
          >
            <v-list-item-title class="white--text">Settings</v-list-item-title>
          </v-list-item>
        </v-list>
      </div>
    </v-navigation-drawer>

    <!-- Main Content Area -->
    <v-main class="admin-main-content">
      <v-container fluid class="pa-6">
        <h1 class="text-h4 font-weight-bold mb-6">Admin</h1>

        <div v-if="tab === 'books'">
          <v-card class="mt-4">
            <v-card-title>All Books ({{ books.length }})</v-card-title>
            <v-card-text>
              <div v-if="loading.books" class="text-center py-8">
                <v-progress-circular indeterminate color="primary"></v-progress-circular>
              </div>
              <v-table v-else-if="books.length > 0">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>ISBN</th>
                    <th>Authors</th>
                    <th>Published</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="book in books" :key="book.id">
                    <td>{{ book.id }}</td>
                    <td>{{ book.title }}</td>
                    <td>{{ book.isbn || "N/A" }}</td>
                    <td>
                      <span v-for="(author, index) in (book.authors || [])" :key="author.id">
                        {{ author.name }}{{ index < book.authors.length - 1 ? ", " : "" }}
                      </span>
                    </td>
                    <td>{{ book.pub_date || "N/A" }}</td>
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
              <div v-else class="text-center py-8 text-grey">
                No books found.
              </div>
            </v-card-text>
          </v-card>
        </div>

        <div v-else-if="tab === 'users'">
        <v-card class="mt-4">
          <v-card-title>Users ({{ users.length }})</v-card-title>
          <v-card-text>
              <div v-if="loading.users" class="text-center py-8">
              <v-progress-circular indeterminate color="primary"></v-progress-circular>
            </div>
            <v-table v-else-if="users.length > 0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in users" :key="user.id">
                  <td>{{ user.id }}</td>
                  <td>{{ user.email }}</td>
                  <td>{{ user.first_name || user.firstName || "N/A" }}</td>
                  <td>
                    <v-chip size="small" :color="user.role === 'admin' ? 'error' : user.role === 'writer' ? 'primary' : 'default'">
                      {{ user.role || "reader" }}
                    </v-chip>
                  </td>
                  <td>
                      <div class="d-flex align-center" style="gap: 8px">
                    <v-select
                      :model-value="user.role || 'reader'"
                      :items="['reader', 'writer', 'admin']"
                      density="compact"
                      variant="outlined"
                      hide-details
                      style="max-width: 120px"
                      @update:model-value="updateUserRole(user.id, $event)"
                    ></v-select>
                        <v-btn
                          v-if="user.role === 'writer' && !userHasAuthorProfile(user.id)"
                          icon
                          size="small"
                          color="primary"
                          @click="openCreateAuthorDialog(user)"
                          title="Create Author Profile"
                        >
                          <v-icon>mdi-account-plus</v-icon>
                        </v-btn>
                      </div>
                  </td>
                </tr>
              </tbody>
            </v-table>
            <div v-else class="text-center py-8 text-grey">
              No users found.
              </div>
            </v-card-text>
          </v-card>
        </div>

        <div v-else-if="tab === 'authors'">
          <!-- Authors Sub-tabs -->
          <v-tabs v-model="authorSubTab" class="mb-4">
            <v-tab value="all">All Authors</v-tab>
            <v-tab value="requests">Author Requests</v-tab>
          </v-tabs>

          <v-window v-model="authorSubTab">
            <!-- All Authors -->
            <v-window-item value="all">

              <v-card class="mt-4">
                <v-card-title>All Authors ({{ authors.length }})</v-card-title>
                <v-card-text>
                  <div v-if="loading.authors" class="text-center py-8">
                    <v-progress-circular indeterminate color="primary"></v-progress-circular>
                  </div>
                  <v-table v-else-if="authors.length > 0">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Bio</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="author in authors" :key="author.id">
                        <td>{{ author.id }}</td>
                        <td>{{ author.name || author.user?.first_name || "N/A" }}</td>
                        <td>{{ author.user?.email || "N/A" }}</td>
                        <td>
                          <v-chip
                            size="small"
                            :color="author.status === 'approved' ? 'success' : author.status === 'denied' ? 'error' : 'warning'"
                          >
                            {{ author.status || "pending" }}
                          </v-chip>
                        </td>
                        <td>{{ author.bio ? (author.bio.substring(0, 50) + "...") : "N/A" }}</td>
                        <td>
                          <template v-if="author.status === 'pending'">
                            <v-btn
                              color="success"
                              size="small"
                              variant="text"
                              @click="approveAuthorRequest(author.id)"
                            >
                              Approve
                            </v-btn>
                            <v-btn
                              color="error"
                              size="small"
                              variant="text"
                              @click="denyAuthorRequest(author.id)"
                            >
                              Deny
                            </v-btn>
                          </template>
                          <template v-else>
                            <v-chip
                              v-if="author.status === 'approved'"
                              size="small"
                              color="success"
                            >
                              Approved
                            </v-chip>
                            <v-chip
                              v-else-if="author.status === 'denied'"
                              size="small"
                              color="error"
                            >
                              Denied
                            </v-chip>
                          </template>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                  <div v-else class="text-center py-8 text-grey">
                    No authors found.
            </div>
          </v-card-text>
        </v-card>
      </v-window-item>

            <!-- Author Requests -->
            <v-window-item value="requests">
        <v-card class="mt-4">
          <v-card-title>Author Requests ({{ authorRequests.length }})</v-card-title>
          <v-card-text>
                  <div v-if="loading.authorRequests" class="text-center py-8">
              <v-progress-circular indeterminate color="primary"></v-progress-circular>
            </div>
            <v-table v-else-if="authorRequests.length > 0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Bio</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="author in authorRequests" :key="author.id">
                  <td>{{ author.id }}</td>
                  <td>{{ author.name || author.first_name || "N/A" }}</td>
                  <td>{{ author.email || "N/A" }}</td>
                  <td>
                    <v-chip
                      size="small"
                      :color="author.status === 'approved' ? 'success' : author.status === 'denied' ? 'error' : 'warning'"
                    >
                      {{ author.status || "pending" }}
                    </v-chip>
                  </td>
                  <td>{{ author.bio ? (author.bio.substring(0, 50) + "...") : "N/A" }}</td>
                  <td>
                    <v-btn
                      v-if="author.status === 'pending'"
                      color="success"
                      size="small"
                      variant="text"
                      @click="approveAuthorRequest(author.id)"
                    >
                      Approve
                    </v-btn>
                    <v-btn
                      v-if="author.status === 'pending'"
                      color="error"
                      size="small"
                      variant="text"
                      @click="denyAuthorRequest(author.id)"
                    >
                      Deny
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
            <div v-else class="text-center py-8 text-grey">
              No pending author requests.
            </div>
          </v-card-text>
        </v-card>
      </v-window-item>
          </v-window>
        </div>

        <div v-else-if="tab === 'settings'">
        <v-card class="mt-4">
            <v-card-title>Settings</v-card-title>
          <v-card-text>
              <p class="text-grey">Settings panel coming soon...</p>
            </v-card-text>
          </v-card>
            </div>
      </v-container>
    </v-main>

    <!-- Create Author Dialog -->
    <v-dialog v-model="showCreateAuthorDialog" max-width="600">
      <v-card>
        <v-card-title>Create Author Profile</v-card-title>
        <v-card-text>
          <div class="mb-4">
            <strong>User:</strong> {{ selectedUserForAuthor?.first_name || selectedUserForAuthor?.firstName || selectedUserForAuthor?.email }}
            <br>
            <strong>Email:</strong> {{ selectedUserForAuthor?.email }}
            </div>
          <v-text-field
            v-model="newAuthorForm.name"
            label="Author Name"
            required
            class="mb-4"
          ></v-text-field>
          <v-textarea
            v-model="newAuthorForm.bio"
            label="Bio"
            rows="4"
            class="mb-4"
          ></v-textarea>
          <v-text-field
            v-model="newAuthorForm.website"
            label="Website URL"
            class="mb-4"
          ></v-text-field>
          </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showCreateAuthorDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" @click="createAuthorForUser">Create Author</v-btn>
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
</template>

<style scoped>
.admin-dashboard {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.admin-sidebar {
  flex-shrink: 0;
}

.admin-main-content {
  flex: 1;
  overflow-y: auto;
  background-color: #f5f5f5;
}

.admin-nav-list {
  background-color: transparent !important;
}

.admin-nav-item {
  margin-bottom: 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.admin-nav-item:hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

.admin-nav-item.active {
  background-color: rgba(255, 255, 255, 0.2) !important;
}

.admin-nav-item :deep(.v-list-item-title) {
  font-weight: 500;
}
</style>

