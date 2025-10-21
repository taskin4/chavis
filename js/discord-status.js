
let typewriterTimeout = null;
let currentTargetText = '';
let isTypewriterRunning = false;

function startTypewriter(element, targetText) {
    currentTargetText = targetText;
    
    
    if (isTypewriterRunning) {
        return;
    }
    
    isTypewriterRunning = true;
    runTypewriterLoop(element);
}

function runTypewriterLoop(element) {
    const typingSpeed = 80;
    const deletingSpeed = 40;
    const pauseDuration = 2000; 
    

    function deleteText() {
        const currentText = element.textContent;
        if (currentText.length > 0) {
            element.textContent = currentText.substring(0, currentText.length - 1);
            typewriterTimeout = setTimeout(deleteText, deletingSpeed);
        } else {
           
            typewriterTimeout = setTimeout(() => {
                typeNewText();
            }, 500);
        }
    }
    
   
    function typeNewText() {
        const currentText = element.textContent;
        if (currentText.length < currentTargetText.length) {
            element.textContent = currentTargetText.substring(0, currentText.length + 1);
            typewriterTimeout = setTimeout(typeNewText, typingSpeed);
        } else {
            
            typewriterTimeout = setTimeout(() => {
                deleteText();
            }, pauseDuration);
        }
    }
    
    
    if (element.textContent.length > 0) {
        deleteText();
    } else {
        typeNewText();
    }
}

function stopTypewriter() {
    if (typewriterTimeout) {
        clearTimeout(typewriterTimeout);
    }
    isTypewriterRunning = false;
}


class DiscordStatusTracker {
    constructor() {
        this.eventSource = null;
        this.apiBaseUrl = 'https://chavis.com.tr'; 
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        
        this.statusIcons = {
            'online': 'images/online.png',
            'idle': 'images/idle.png', 
            'dnd': 'images/dnd.png',
            'offline': 'images/offline.png'
        };
        
        this.init();
    }
    
    init() {
        this.connectSSE();
        console.log('discord status tracker initialized');
    }

    connectSSE() {
        try {
            console.log(`Connecting to SSE: ${this.apiBaseUrl}/api/discord/status/stream`);
            this.eventSource = new EventSource(`${this.apiBaseUrl}/api/discord/status/stream`);
            
            this.eventSource.onopen = () => {
                console.log('SSE connected successfully');
                this.reconnectAttempts = 0;
            };
            
            this.eventSource.onmessage = (event) => {
                try {
                    console.log('SSE message received:', event.data);
                    const data = JSON.parse(event.data);
                    if (data.success) {
                        console.log('Discord status data:', data.data);
                        this.updateStatus(data.data);
                    }
                } catch (error) {
                    console.error('Error parsing SSE message:', error);
                }
            };
            
            this.eventSource.onerror = (error) => {
                console.error('SSE connection error:', error);
                this.eventSource.close();
                this.scheduleReconnect();
            };
        } catch (error) {
            console.error('Failed to create SSE connection:', error);
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * this.reconnectAttempts, 10000);
            console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connectSSE(), delay);
        } else {
            console.error('Max reconnection attempts reached. Please refresh the page.');
        }
    }
    
    updateStatus(userData) {
        console.log('updateStatus called with:', userData);
        
        if (!userData || !userData.discord_status) {
            console.warn('Invalid user data received:', userData);
            return;
        }
        
        const status = userData.discord_status;
        const statusIcon = this.statusIcons[status] || this.statusIcons['offline'];
        
        console.log(`Updating status to: ${status}`);
        
        const statusIconElement = document.querySelector('.status-icon');
        if (statusIconElement) {
            statusIconElement.src = statusIcon;
            statusIconElement.alt = status.charAt(0).toUpperCase() + status.slice(1);
            console.log(`discord status updated: ${status}`);
        } else {
            console.warn('Status icon element not found');
        }
        
        const usernameElement = document.querySelector('.username');
        if (usernameElement && userData.discord_user && userData.discord_user.global_name) {
            console.log(`Updating username to: ${userData.discord_user.global_name}`);
            if (usernameElement.textContent !== userData.discord_user.global_name) {
                usernameElement.textContent = userData.discord_user.global_name;
            }
        }
        
        const bioElement = document.querySelector('.bio');
        if (bioElement) {
            let newText = '';
            if (userData.activities && userData.activities.length > 0) {
                console.log('Activities found:', userData.activities);
                const customStatus = userData.activities.find(activity => activity.type === 4);
                if (customStatus && customStatus.state) {
                    newText = customStatus.state;
                    console.log('Custom status found:', customStatus.state);
                }
            }
            
            console.log(`Bio text: "${newText}"`);
            if (bioElement.dataset.targetText !== newText) {
                bioElement.dataset.targetText = newText;
                startTypewriter(bioElement, newText);
                console.log(`bio updated; ${newText || '(empty)'}`);
            }
        }
    }
    
    
    destroy() {
        if (this.eventSource) {
            this.eventSource.close();
            console.log('discord status sse closed');
        }
        stopTypewriter();
    }
}


document.addEventListener('DOMContentLoaded', function() {
    window.discordStatusTracker = new DiscordStatusTracker();
});


window.addEventListener('beforeunload', function() {
    if (window.discordStatusTracker) {
        window.discordStatusTracker.destroy();
    }
});