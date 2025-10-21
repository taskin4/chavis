async function fetchSvgImage() {
    try {
      
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (isLocal) {
        console.log('rpc disabled');
        return;
      }
      
      const response = await fetch('/.netlify/functions/getRpc');
      
      if (!response.ok) {
        console.error('rpc error', response.status);
        return;
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('rpc returned non-json');
        return;
      }
      
      const data = await response.json();

      if (data.base64SVG) {
        document.getElementById('rpc').src = data.base64SVG;
      } else {
        console.error('SVG data');
      }
    } catch (error) {
      console.error('SVG image', error);
    }
  }

  fetchSvgImage();