import apiClient from "./services";

export default {
  // Get current user's author profile
  getMyAuthorProfile() {
    return apiClient.get("authors/me");
  },

  // Request to become an author (for regular users)
  // Uses POST /authors/ which creates an author profile with status 'pending'
  requestAuthorProfile(requestData) {
    const payload = {
      name: requestData.name || requestData.firstName || "", // Backend requires 'name'
      bio: requestData.bio || null,
      website: requestData.website || null,
      social_links: requestData.social_links || null,
    };
    return apiClient.post("authors/", payload);
  },

  // Get author by ID
  getAuthor(authorId) {
    return apiClient.get(`authors/${authorId}`);
  },

  // Update author profile
  updateAuthorProfile(authorId, profile) {
    return apiClient.put(`authors/${authorId}`, profile);
  },

  // Get books by author
  getAuthorBooks(authorId) {
    return apiClient.get(`authors/${authorId}/books`);
  },

  // Get reviews on author's books
  getAuthorBookReviews(authorId) {
    return apiClient.get(`authors/${authorId}/reviews`);
  },
};

