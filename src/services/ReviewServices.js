import apiClient from "./services";

export default {
  // Get reviews for a book
  getBookReviews(bookId) {
    return apiClient.get(`reviews/book/${bookId}`);
  },

  // Get a single review
  getReview(reviewId) {
    return apiClient.get(`reviews/${reviewId}`);
  },

  // Get current user's review for a book
  getMyReview(bookId) {
    return apiClient.get(`reviews/book/${bookId}/my`);
  },

  // Create a review
  createReview(review) {
    return apiClient.post("reviews", review);
  },

  // Update a review
  updateReview(reviewId, review) {
    return apiClient.put(`reviews/${reviewId}`, review);
  },

  // Delete a review
  deleteReview(reviewId) {
    return apiClient.delete(`reviews/${reviewId}`);
  },

  // Mark review as helpful
  markHelpful(reviewId) {
    return apiClient.post(`reviews/${reviewId}/helpful`);
  },

  // Mark review as not helpful
  markNotHelpful(reviewId) {
    return apiClient.post(`reviews/${reviewId}/not-helpful`);
  },
};

