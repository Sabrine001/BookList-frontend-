import apiClient from "./services";

export default {
  // Get all books with optional query params (q, page, limit, genre, isbn)
  getBooks(params = {}) {
    return apiClient.get("books", { params });
  },

  // Get a single book by ID
  getBook(id) {
    return apiClient.get("books/" + id);
  },

  // Get similar books
  getSimilarBooks(bookId) {
    return apiClient.get(`books/${bookId}/similar`);
  },

  // Get recommendations for current user
  getRecommendations() {
    return apiClient.get("recommendations");
  },

  // Add a new book (requires authentication)
  addBook(book) {
    return apiClient.post("books", book);
  },

  // Update a book (requires authentication)
  updateBook(bookId, book) {
    return apiClient.put("books/" + bookId, book);
  },

  // Delete a book (requires authentication)
  deleteBook(bookId) {
    return apiClient.delete("books/" + bookId);
  },
};

