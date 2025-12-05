<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import BookServices from "../services/BookServices";
import AuthorServices from "../services/AuthorServices";
import { useAuth } from "../composables/useAuth";
import BookCard from "../components/BookCard.vue";

const router = useRouter();
const { isLoggedIn, isAdmin, isWriter, currentUser } = useAuth();

const recommendations = ref([]);
const newReleases = ref([]);
const loading = ref(false);
const snackbar = ref({
  show: false,
  text: "",
  color: "",
});

// Author request dialog state (for readers who want to become authors)
const showAuthorRequestDialog = ref(false);
const authorRequestForm = ref({
  bio: "",
  website: "",
});

onMounted(async () => {
  if (!isLoggedIn.value) {
    router.push({ name: "login" });
    return;
  }
  
  // Redirect admins to admin dashboard
  if (isAdmin.value) {
    router.push({ name: "adminDashboard" });
    return;
  }
  
  // Redirect writers to author dashboard
  if (isWriter.value) {
    router.push({ name: "authorDashboard" });
    return;
  }
  
  // Load reader dashboard content
  await loadRecommendations();
  await loadNewReleases();
});

async function loadRecommendations() {
  loading.value = true;
  try {
    const response = await BookServices.getRecommendations();
    recommendations.value = response.data || [];
  } catch (error) {
    console.warn("Could not load recommendations:", error);
    recommendations.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadNewReleases() {
  try {
    // Get recent books sorted by publication date
    const response = await BookServices.getBooks({ limit: 12, sort: "pub_date", order: "desc" });
    if (response && response.data) {
      if (Array.isArray(response.data)) {
        newReleases.value = response.data;
      } else if (response.data.books) {
        newReleases.value = response.data.books;
      } else {
        newReleases.value = [];
      }
    }
  } catch (error) {
    console.warn("Could not load new releases:", error);
    newReleases.value = [];
  }
}

function showSnackbar(text, color) {
  snackbar.value = { show: true, text, color };
}

async function submitAuthorRequest() {
  try {
    if (!authorRequestForm.value.bio) {
      showSnackbar("Please add a short bio to request author access.", "warning");
      return;
    }

    // Get user's name from auth
    const { currentUser } = useAuth();
    const userName = currentUser.value?.firstName || 
                     currentUser.value?.first_name || 
                     currentUser.value?.name || 
                     currentUser.value?.user?.first_name || 
                     "";

    if (!userName) {
      showSnackbar("Unable to get user name. Please try logging in again.", "error");
      return;
    }

    await AuthorServices.requestAuthorProfile({
      name: userName,
      bio: authorRequestForm.value.bio,
      website: authorRequestForm.value.website || null,
    });

    showSnackbar("Your request to become an author has been submitted.", "success");
    showAuthorRequestDialog.value = false;
    authorRequestForm.value = { bio: "", website: "" };
  } catch (error) {
    console.error("Error submitting author request:", error);
    console.error("Full error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
    });
    
    let errorMsg = error.message || error.response?.data?.message || "Failed to submit author request.";
    
    // If it's a 404, the error message already contains helpful details about all attempted endpoints
    if (error.response?.status === 404) {
      // Show the detailed message which includes all attempted endpoints
      showSnackbar(errorMsg, "error");
    } else {
      showSnackbar(errorMsg, "error");
    }
  }
}
</script>

<template>
  <v-container>
    <div id="body">
      <h1 class="text-h4 font-weight-bold mb-6">Welcome to BookList</h1>

      <!-- Recommended for You -->
      <div v-if="recommendations.length > 0" class="mb-8">
        <h2 class="text-h5 mb-4">Recommended for You</h2>
        <v-row>
          <v-col
            v-for="book in recommendations"
            :key="book.id"
            cols="12"
            sm="6"
            md="4"
            lg="3"
          >
            <BookCard :book="book" />
          </v-col>
        </v-row>
      </div>

      <!-- New Releases -->
      <div v-if="newReleases.length > 0" class="mb-8">
        <h2 class="text-h5 mb-4">New Releases</h2>
        <v-row>
          <v-col
            v-for="book in newReleases"
            :key="book.id"
            cols="12"
            sm="6"
            md="4"
            lg="3"
          >
            <BookCard :book="book" />
          </v-col>
        </v-row>
      </div>

      <!-- Empty State -->
      <div v-if="!loading && recommendations.length === 0 && newReleases.length === 0" class="text-center py-12">
        <v-icon size="64" color="grey-lighten-1">mdi-book-open-variant</v-icon>
        <p class="text-h6 mt-4 text-grey">Start exploring books!</p>
        <v-btn
          color="primary"
          variant="flat"
          :to="{ name: 'books' }"
          class="mt-4"
        >
          Browse All Books
        </v-btn>
      </div>

      <!-- Become an Author (reader only) -->
      <div
        v-if="!isAdmin && !isWriter"
        class="mt-10 pa-6 rounded-lg"
        style="border: 1px dashed rgba(0,0,0,0.12)"
      >
        <h2 class="text-h6 mb-2">Want to publish your own books?</h2>
        <p class="text-body-2 mb-3">
          You can request an author account. Our admins will review your request and notify you.
        </p>
        <v-btn color="primary" variant="outlined" @click="showAuthorRequestDialog = true">
          <v-icon start>mdi-account-plus</v-icon>
          Request Author Account
        </v-btn>
      </div>

      <!-- Author Request Dialog -->
      <v-dialog v-model="showAuthorRequestDialog" max-width="600">
        <v-card>
          <v-card-title>Request Author Account</v-card-title>
          <v-card-text>
            <v-textarea
              v-model="authorRequestForm.bio"
              label="Tell us about yourself"
              rows="4"
              class="mb-4"
              required
            ></v-textarea>
            <v-text-field
              v-model="authorRequestForm.website"
              label="Website or portfolio URL (optional)"
              class="mb-2"
            ></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="showAuthorRequestDialog = false">Cancel</v-btn>
            <v-btn color="primary" variant="flat" @click="submitAuthorRequest">
              Submit Request
            </v-btn>
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

