import apiClient from "./services";

export default {
  // Get all favorites for current user
  getFavorites() {
    return apiClient.get("favorites");
  },

  // Add a book to favorites
  addFavorite(bookId) {
    return apiClient.post("favorites", { book_id: bookId });
  },

  // Remove a book from favorites
  removeFavorite(bookId) {
    return apiClient.delete(`favorites/${bookId}`);
  },

  // Check if a book is favorited
  isFavorite(bookId) {
    return apiClient.get(`favorites/${bookId}/check`);
  },
};

