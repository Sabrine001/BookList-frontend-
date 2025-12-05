<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import ListServices from "../services/ListServices";
import { useAuth } from "../composables/useAuth";

const router = useRouter();
const { isLoggedIn } = useAuth();

const lists = ref([]);
const loading = ref(false);
const showCreateDialog = ref(false);
const showEditDialog = ref(false);
const editingList = ref(null);

const newList = ref({
  name: "",
  visibility: "private",
  description: "",
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
  await loadLists();
});

async function loadLists() {
  loading.value = true;
  try {
    const response = await ListServices.getMyLists();
    lists.value = response.data || [];
  } catch (error) {
    console.error("Error loading lists:", error);
    showSnackbar("Failed to load lists", "error");
    lists.value = [];
  } finally {
    loading.value = false;
  }
}

async function createList() {
  if (!newList.value.name.trim()) {
    showSnackbar("Please enter a list name", "error");
    return;
  }

  try {
    await ListServices.createList(newList.value);
    showSnackbar("List created successfully", "success");
    showCreateDialog.value = false;
    newList.value = { name: "", visibility: "private", description: "" };
    await loadLists();
  } catch (error) {
    console.error("Error creating list:", error);
    showSnackbar(error.response?.data?.message || "Failed to create list", "error");
  }
}

function openEditDialog(list) {
  editingList.value = { ...list };
  showEditDialog.value = true;
}

async function updateList() {
  if (!editingList.value.name.trim()) {
    showSnackbar("Please enter a list name", "error");
    return;
  }

  try {
    await ListServices.updateList(editingList.value.id, {
      name: editingList.value.name,
      visibility: editingList.value.visibility,
      description: editingList.value.description,
    });
    showSnackbar("List updated successfully", "success");
    showEditDialog.value = false;
    editingList.value = null;
    await loadLists();
  } catch (error) {
    console.error("Error updating list:", error);
    showSnackbar(error.response?.data?.message || "Failed to update list", "error");
  }
}

async function deleteList(listId) {
  if (!confirm("Are you sure you want to delete this list?")) return;

  try {
    await ListServices.deleteList(listId);
    showSnackbar("List deleted successfully", "success");
    await loadLists();
  } catch (error) {
    console.error("Error deleting list:", error);
    showSnackbar("Failed to delete list", "error");
  }
}

function viewList(listId) {
  router.push({ name: "listDetail", params: { id: listId } });
}

function showSnackbar(text, color) {
  snackbar.value = { show: true, text, color };
}
</script>

<template>
  <v-container>
    <div id="body">
      <v-row align="center" class="mb-4">
        <v-col cols="10">
          <h1 class="text-h4 font-weight-bold">My Reading Lists</h1>
        </v-col>
        <v-col cols="2" class="d-flex justify-end">
          <v-btn color="primary" variant="flat" @click="showCreateDialog = true">
            Create List
          </v-btn>
        </v-col>
      </v-row>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      </div>

      <!-- Empty State -->
      <div v-else-if="lists.length === 0" class="text-center py-12">
        <v-icon size="64" color="grey-lighten-1">mdi-bookmark-outline</v-icon>
        <p class="text-h6 mt-4 text-grey">You don't have any reading lists yet.</p>
        <v-btn
          color="primary"
          variant="flat"
          @click="showCreateDialog = true"
          class="mt-4"
        >
          Create Your First List
        </v-btn>
      </div>

      <!-- Lists Grid -->
      <v-row v-else>
        <v-col
          v-for="list in lists"
          :key="list.id"
          cols="12"
          sm="6"
          md="4"
        >
          <v-card>
            <v-card-title>{{ list.name }}</v-card-title>
            <v-card-subtitle>
              <v-chip size="small" class="mr-2">{{ list.visibility || "private" }}</v-chip>
              <span>{{ list.book_count || 0 }} {{ (list.book_count || 0) === 1 ? "book" : "books" }}</span>
            </v-card-subtitle>
            <v-card-text v-if="list.description">
              {{ list.description }}
            </v-card-text>
            <v-card-actions>
              <v-btn color="primary" variant="text" @click="viewList(list.id)">
                View
              </v-btn>
              <v-spacer></v-spacer>
              <v-btn icon size="small" @click="openEditDialog(list)">
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
              <v-btn icon size="small" color="error" @click="deleteList(list.id)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>

      <!-- Create List Dialog -->
      <v-dialog v-model="showCreateDialog" max-width="600">
        <v-card>
          <v-card-title>Create New List</v-card-title>
          <v-card-text>
            <v-text-field
              v-model="newList.name"
              label="List Name"
              required
              class="mb-4"
            ></v-text-field>
            <v-select
              v-model="newList.visibility"
              :items="['private', 'public', 'shared']"
              label="Visibility"
              class="mb-4"
            ></v-select>
            <v-textarea
              v-model="newList.description"
              label="Description (optional)"
              rows="3"
            ></v-textarea>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="showCreateDialog = false">Cancel</v-btn>
            <v-btn color="primary" variant="flat" @click="createList">Create</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Edit List Dialog -->
      <v-dialog v-model="showEditDialog" max-width="600">
        <v-card v-if="editingList">
          <v-card-title>Edit List</v-card-title>
          <v-card-text>
            <v-text-field
              v-model="editingList.name"
              label="List Name"
              required
              class="mb-4"
            ></v-text-field>
            <v-select
              v-model="editingList.visibility"
              :items="['private', 'public', 'shared']"
              label="Visibility"
              class="mb-4"
            ></v-select>
            <v-textarea
              v-model="editingList.description"
              label="Description (optional)"
              rows="3"
            ></v-textarea>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="showEditDialog = false">Cancel</v-btn>
            <v-btn color="primary" variant="flat" @click="updateList">Save</v-btn>
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

