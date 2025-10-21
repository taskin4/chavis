
    const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000' 
        : 'https://your-domain.com'; 
    
    const API_ENDPOINTS = {
        getViews: `${API_BASE_URL}/api/views`,
        incrementViews: `${API_BASE_URL}/api/views/increment`
    };

    async function updateViewCounter() {
      try {
        
        let response = await fetch(API_ENDPOINTS.getViews, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        let data = await response.json();
        let currentCount = data.views || 0;

        
        response = await fetch(API_ENDPOINTS.incrementViews, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        data = await response.json();
        currentCount = data.views;

        
        const viewCountElement = document.getElementById("view-count");
        if (viewCountElement) {
          viewCountElement.textContent = currentCount;
        } else {
          console.warn("View count element not found");
        }
        
        console.log(`view count updated to: ${currentCount}`);
      } catch (error) {
        console.error("Error updating view counter:", error);
        
        
        const viewCountElement = document.getElementById("view-count");
        if (viewCountElement) {
          viewCountElement.textContent = "Error!";
          viewCountElement.style.color = "#ff6b6b";
        }
        
        
        console.warn("View counter service is temporarily unavailable");
      }
    }


    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateViewCounter);
    } else {
        updateViewCounter();
    }