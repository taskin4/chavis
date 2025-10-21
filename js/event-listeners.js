
document.addEventListener('DOMContentLoaded', function() {
    
    
    const overlayBtn = document.getElementById('overlay-btn');
    if (overlayBtn) {
        overlayBtn.addEventListener('click', function() {
            if (typeof removeOverlay === 'function') {
                removeOverlay();
            }
        });
    }

    
    const btcBtn = document.getElementById('btc');
    if (btcBtn) {
        btcBtn.addEventListener('click', function() {
            window.open('https://discord.gg/cZsbKbYHWS', '_blank');
        });
    }

    
    const igBtn = document.getElementById('ig');
    if (igBtn) {
        igBtn.addEventListener('click', function() {
            window.open('https://www.youtube.com/@chavis0', '_blank');
        });
    }

    
    const ttBtn = document.getElementById('tt');
    if (ttBtn) {
        ttBtn.addEventListener('click', function() {
            window.open('https://www.roblox.com/tr/users/2979645355/profile', '_blank');
        });
    }

    
    const teleBtn = document.getElementById('tele');
    if (teleBtn) {
        teleBtn.addEventListener('click', function() {
            window.open('https://open.spotify.com/intl-tr/artist/3LIsNJyf9Itp0nOoDVtHJE?si=ODr3d3pKRti3RsXz3VaWdg', '_blank');
        });
    }

    
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
