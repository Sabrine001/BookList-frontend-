<script setup>
import { ref, onMounted, watch } from "vue";
import ListServices from "../services/ListServices";
import { useAuth } from "../composables/useAuth";

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  book: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update:modelValue", "close"]);

const { isLoggedIn } = useAuth();
const lists = ref([]);
const selectedLists = ref([]);
const loading = ref(false);
const snackbar = ref({
  show: false,
  text: "",
  color: "",
});

watch(() => props.modelValue, async (newVal) => {
  if (newVal && isLoggedIn.value) {
    await loadLists();
    await loadBookLists();
  }
});

async function loadLists() {
  try {
    const response = await ListServices.getMyLists();
    lists.value = response.data || [];
  } catch (error) {
    console.error("Error loading lists:", error);
    showSnackbar("Failed to load lists", "error");
  }
}

async function loadBookLists() {
  // Check which lists already contain this book
  selectedLists.value = [];
  for (const list of lists.value) {
    try {
      const itemsResponse = await ListServices.getListItems(list.id);
      const items = itemsResponse.data || [];
      const hasBook = items.some(item => item.book_id === props.book.id || item.book?.id === props.book.id);
      if (hasBook) {
        selectedLists.value.push(list.id);
      }
    } catch (error) {
      console.warn(`Could not check list ${list.id}:`, error);
    }
  }
}

async function save() {
  loading.value = true;
  try {
    // Add to newly selected lists
    for (const listId of selectedLists.value) {
      if (!lists.value.find(l => l.id === listId)) continue;
      try {
        const itemsResponse = await ListServices.getListItems(listId);
        const items = itemsResponse.data || [];
        const alreadyInList = items.some(item => item.book_id === props.book.id || item.book?.id === props.book.id);
        
        if (!alreadyInList) {
          await ListServices.addBookToList(listId, props.book.id);
        }
      } catch (error) {
        console.error(`Error adding to list ${listId}:`, error);
      }
    }

    // Remove from unselected lists
    for (const list of lists.value) {
      if (selectedLists.value.includes(list.id)) continue;
      try {
        const itemsResponse = await ListServices.getListItems(list.id);
        const items = itemsResponse.data || [];
        const item = items.find(i => i.book_id === props.book.id || i.book?.id === props.book.id);
        
        if (item) {
          await ListServices.removeBookFromList(list.id, item.id);
        }
      } catch (error) {
        console.error(`Error removing from list ${list.id}:`, error);
      }
    }

    showSnackbar("Lists updated successfully", "success");
    close();
  } catch (error) {
    console.error("Error updating lists:", error);
    showSnackbar("Failed to update lists", "error");
  } finally {
    loading.value = false;
  }
}

function close() {
  emit("update:modelValue", false);
  emit("close");
}

function showSnackbar(text, color) {
  snackbar.value = { show: true, text, color };
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="500" @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title>Add to Lists</v-card-title>
      <v-card-text>
        <div v-if="lists.length === 0" class="text-center py-4">
          <p class="text-grey">You don't have any lists yet.</p>
          <v-btn color="primary" variant="text" :to="{ name: 'lists' }">
            Create a List
          </v-btn>
        </div>
        <v-list v-else>
          <v-list-item
            v-for="list in lists"
            :key="list.id"
          >
            <template v-slot:prepend>
              <v-checkbox
                v-model="selectedLists"
                :value="list.id"
                hide-details
              ></v-checkbox>
            </template>
            <v-list-item-title>{{ list.name }}</v-list-item-title>
            <v-list-item-subtitle v-if="list.visibility">
              {{ list.visibility }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          @click="save"
          :loading="loading"
          :disabled="lists.length === 0"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color">
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-dialog>
</template>

