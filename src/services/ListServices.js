import apiClient from "./services";

export default {
  // Get all lists for current user
  getMyLists() {
    return apiClient.get("lists/my");
  },

  // Get a single list by ID
  getList(listId) {
    return apiClient.get(`lists/${listId}`);
  },

  // Get items in a list
  getListItems(listId) {
    return apiClient.get(`lists/${listId}/items`);
  },

  // Create a new list
  createList(list) {
    return apiClient.post("lists", list);
  },

  // Update a list (name, visibility, etc.)
  updateList(listId, list) {
    return apiClient.put(`lists/${listId}`, list);
  },

  // Delete a list
  deleteList(listId) {
    return apiClient.delete(`lists/${listId}`);
  },

  // Add a book to a list
  addBookToList(listId, bookId) {
    return apiClient.post(`lists/${listId}/items`, { book_id: bookId });
  },

  // Remove a book from a list
  removeBookFromList(listId, itemId) {
    return apiClient.delete(`lists/${listId}/items/${itemId}`);
  },

  // Update list item order
  updateListItemOrder(listId, itemId, orderIndex) {
    return apiClient.put(`lists/${listId}/items/${itemId}`, { order_index: orderIndex });
  },
};

