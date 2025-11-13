
document.addEventListener('DOMContentLoaded', function() {
    
    
    const overlayBtn = document.getElementById('overlay-btn');
    if (overlayBtn) {
        overlayBtn.addEventListener('click', function() {
            if (typeof removeOverlay === 'function') {
                removeOverlay();
            }
        });
    }

    loadSocialLinks();

    const muteBtn = document.getElementById('mutetext');
    if (muteBtn) {
        muteBtn.addEventListener('click', function() {
            if (typeof toggleMusic === 'function') {
                toggleMusic();
            }
        });
    }

    console.log('event listeners initialized successfully');
});

async function loadSocialLinks() {
    try {
        const response = await fetch('/api/social-links');
        const data = await response.json();
        const linksContainer = document.getElementById('linksDiv');
        
        if (!linksContainer) return;
        
        linksContainer.innerHTML = '';
        
        data.links.forEach((link, index) => {
            const logoDiv = document.createElement('div');
            logoDiv.className = 'logo';
            logoDiv.id = `social_${link.id}`;
            logoDiv.style.cursor = 'pointer';
            
            const img = document.createElement('img');
            img.src = link.iconPath;
            img.alt = link.label;
            img.className = 'links';
            img.style.width = '50px';
            img.style.height = '50px';
            
            logoDiv.appendChild(img);
            logoDiv.addEventListener('click', function() {
                window.open(link.url, '_blank');
            });
            
            linksContainer.appendChild(logoDiv);
        });
    } catch (error) {
        console.error('Error loading social links:', error);
    }
}
