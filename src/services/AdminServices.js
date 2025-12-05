import apiClient from "./services";

export default {
  // Get all users
  // Uses GET /users/ endpoint
  getUsers() {
    return apiClient.get("users/");
  },

  // Update user role
  // Uses PUT /users/:id/role endpoint (admin only)
  updateUserRole(userId, role) {
    return apiClient.put(`users/${userId}/role`, { role });
  },

  // Get pending author requests
  // Uses GET /authors/ with status=pending query param, or tries admin endpoint
  async getAuthorRequests() {
    // Try with status query parameter first
    try {
      const response = await apiClient.get("authors/", { params: { status: "pending" } });
      // If it returns all authors, filter for pending ones
      const data = response.data || [];
      const pending = Array.isArray(data) 
        ? data.filter(a => a.status === 'pending')
        : [];
      return { ...response, data: pending };
    } catch (error) {
      // If query param doesn't work, try admin endpoint
      if (error.response?.status === 404) {
        try {
          return await apiClient.get("admin/author-requests");
        } catch (err2) {
          // Try authors/requests
          try {
            return await apiClient.get("authors/requests");
          } catch (err3) {
            throw new Error(
              "Backend route not found. Please ensure your backend GET /booklistapi/authors/ " +
              "supports a 'status' query parameter, or implement GET /booklistapi/admin/author-requests"
            );
          }
        }
      }
      throw error;
    }
  },

  // Approve author request
  // Uses PUT /authors/:id/status with status='approved'
  approveAuthorRequest(authorId) {
    return apiClient.put(`authors/${authorId}/status`, { status: "approved" });
  },

  // Deny author request
  // Uses PUT /authors/:id/status with status='denied'
  denyAuthorRequest(authorId) {
    return apiClient.put(`authors/${authorId}/status`, { status: "denied" });
  },

  // Get all authors (for admin view)
  // Tries to get all authors regardless of status
  async getAllAuthors() {
    try {
      // First try without status filter to get all authors
      const response = await apiClient.get("authors/", { params: { status: "all" } });
      return response;
    } catch (error) {
      // If that fails, try with no params (might only return approved)
      try {
        const response = await apiClient.get("authors/");
        // If backend only returns approved, we need to also fetch pending/denied
        // Try to get pending authors separately
        try {
          const pendingResponse = await apiClient.get("authors/", { params: { status: "pending" } });
          const deniedResponse = await apiClient.get("authors/", { params: { status: "denied" } });
          
          const allAuthors = [
            ...(Array.isArray(response.data) ? response.data : response.data?.authors || []),
            ...(Array.isArray(pendingResponse.data) ? pendingResponse.data : pendingResponse.data?.authors || []),
            ...(Array.isArray(deniedResponse.data) ? deniedResponse.data : deniedResponse.data?.authors || [])
          ];
          
          // Remove duplicates
          const uniqueAuthors = allAuthors.filter((author, index, self) =>
            index === self.findIndex(a => a.id === author.id)
          );
          
          return { data: uniqueAuthors };
        } catch (e) {
          // If separate status calls fail, just return what we got
          return response;
        }
      } catch (e) {
        throw error;
      }
    }
  },

  // Create author profile for a user (admin only)
  createAuthorForUser(authorData) {
    return apiClient.post("authors/", authorData);
  },

  // Get all books (admin view)
  // Falls back to regular books endpoint if admin/books doesn't exist
  async getAllBooks() {
    try {
      return await apiClient.get("admin/books");
    } catch (error) {
      if (error.response?.status === 404) {
        // Fallback to regular books endpoint
        return await apiClient.get("books");
      }
      throw error;
    }
  },
};

