
class OverlayTypewriter {
    constructor() {
        this.button = document.getElementById('overlay-btn');
        this.text = 'ｃｌｉｃｋ';
        this.typingSpeed = 100;
        this.deletingSpeed = 50;
        this.pauseDuration = 2000; 
        this.timeout = null;
        
        this.init();
    }
    
    init() {
        
        setTimeout(() => {
            this.startTypewriter();
        }, 1000); 
    }
    
    startTypewriter() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.runTypewriterLoop();
    }
    
    runTypewriterLoop() {
        
        this.typeText();
    }
    
    typeText() {
        let index = 0;
        const typeChar = () => {
            if (index < this.text.length) {
                this.button.textContent = this.text.substring(0, index + 1);
                this.button.classList.add('typewriter-cursor');
                index++;
                this.timeout = setTimeout(typeChar, this.typingSpeed);
            } else {
                
                this.timeout = setTimeout(() => {
                    this.deleteText();
                }, this.pauseDuration);
            }
        };
        
        typeChar();
    }
    
    deleteText() {
        let index = this.text.length;
        const deleteChar = () => {
            if (index > 0) {
                this.button.textContent = this.text.substring(0, index - 1);
                this.button.classList.add('typewriter-cursor');
                index--;
                this.timeout = setTimeout(deleteChar, this.deletingSpeed);
            } else {
                
                this.button.classList.remove('typewriter-cursor');
                this.timeout = setTimeout(() => {
                    this.typeText();
                }, 500);
            }
        };
        
        deleteChar();
    }
    
    stop() {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.isRunning = false;
        this.button.classList.remove('typewriter-cursor');
    }
}


document.addEventListener('DOMContentLoaded', function() {
    window.overlayTypewriter = new OverlayTypewriter();
});


window.addEventListener('beforeunload', function() {
    if (window.overlayTypewriter) {
        window.overlayTypewriter.stop();
    }
});
