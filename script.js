document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-button');
    const numberDisplayEl = document.getElementById('number-display');
    const qrCanvasEl = document.getElementById('qr-code');

    const LINKS = [
        'https://m.indiamart.com/impcat/washing-ball.html?utm_source=insta_show2.0&utm_medium=affiliate&utm_campaign=0525&utm_content=9',
        'https://m.indiamart.com/proddetail/23456124662.html?utm_source=picksby_me_&utm_medium=affiliate&utm_campaign=0425&utm_content=41',
        'https://m.indiamart.com/proddetail/26269935273.html?utm_source=picksby_me_&utm_medium=affiliate&utm_campaign=0425&utm_content=45'
    ];
    const ADSTERRA_LINK = 'https://www.profitableratecpm.com/mwbg7v2g0r?key=c6aaa3a2635e2ddc891a9c145928f823';
    const GOOGLE_SHEET_ENDPOINT = 'https://script.google.com/macros/s/REPLACE_ME/exec';
    const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000;

    let clickCounter = 0;
    let lastClickTime = Date.now();
    let inactivityTimer;
    let qrInstance = null;

    // Animation specific variables
    let digitReelElements = [];
    let spinIntervals = [null, null, null, null];
    const NUM_DIGITS_IN_REEL = 10; // 0-9
    const REEL_REPETITIONS = 5; // How many sets of 0-9 in each reel for smooth rolling look
    const DIGIT_ANIMATION_CONFIG = {
        INITIAL_FULL_SPIN_DURATION: 1500, // ms, all 4 digits spin
        SUBSEQUENT_SPIN_DURATION: 1000,   // ms, remaining digits spin after one settles
        SETTLE_TRANSITION_DURATION: 800, // ms, CSS transition for ease-out stop
        SPIN_UPDATE_INTERVAL: 50,        // ms, how fast numbers change during spin
    };


    function initializeApp() {
        // ... (localStorage and inactivity logic remains the same)
        const storedClickCounter = localStorage.getItem('clickCounter');
        clickCounter = storedClickCounter ? parseInt(storedClickCounter) : 0;

        const storedLastClickTime = localStorage.getItem('lastClickTime');
        lastClickTime = storedLastClickTime ? parseInt(storedLastClickTime) : Date.now();

        if (storedLastClickTime) {
            checkAndResetInactivity();
        } else {
            localStorage.setItem('lastClickTime', lastClickTime.toString());
        }
        
        startButton.addEventListener('click', handleStartClick);
        resetInactivityTimer();
        if (clickCounter === 0) {
             clearDisplay(); // Ensure clean state on first load or after reset
        }
        setupDigitDisplay(); // Create digit containers once
    }

    function sendLog(type, value) { /* ... (same as before) ... */ 
        const payload = {
            timestamp: new Date().toISOString(),
            type: type,
            value: value,
            clickCount: clickCounter
        };
        fetch(GOOGLE_SHEET_ENDPOINT, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            body: JSON.stringify(payload)
        })
        .then(() => console.log('Log sent. Type:', type, "Value:", value))
        .catch(error => console.error('Error sending log:', error));
    }

    function generateValidRandomNumber() { /* ... (same as before) ... */
        let randomNumber;
        do {
            randomNumber = Math.floor(1000 + Math.random() * 9000);
        } while (randomNumber >= 1950 && randomNumber <= 2025);
        return randomNumber.toString();
    }
    
    function getDigitHeight() {
        // Calculate digit height dynamically once, or use a fixed value if #number-display height is fixed
        // For simplicity, assuming it matches the CSS line-height/height of #number-display (e.g., 1.5em)
        // This needs to be a pixel value for translateY.
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.fontSize = getComputedStyle(numberDisplayEl).fontSize;
        tempSpan.style.lineHeight = getComputedStyle(numberDisplayEl).lineHeight;
        tempSpan.textContent = '0';
        document.body.appendChild(tempSpan);
        const height = tempSpan.offsetHeight;
        document.body.removeChild(tempSpan);
        return height > 0 ? height : 50; // Fallback
    }
    let computedDigitHeight = 0; // Will be computed once

    function setupDigitDisplay() {
        numberDisplayEl.innerHTML = ''; // Clear any previous
        digitReelElements = [];
        for (let i = 0; i < 4; i++) {
            const container = document.createElement('div');
            container.className = 'digit-container';
            
            const reel = document.createElement('div');
            reel.className = 'digit-reel';
            
            for (let r = 0; r < REEL_REPETITIONS; r++) {
                for (let d = 0; d < NUM_DIGITS_IN_REEL; d++) {
                    const digitSpan = document.createElement('span');
                    digitSpan.textContent = d.toString();
                    reel.appendChild(digitSpan);
                }
            }
            container.appendChild(reel);
            numberDisplayEl.appendChild(container);
            digitReelElements.push(reel);
        }
        computedDigitHeight = getDigitHeight(); // Compute once setup is in DOM
    }

    function clearRunningAnimations() {
        spinIntervals.forEach(intervalId => {
            if (intervalId) clearInterval(intervalId);
        });
        spinIntervals = [null, null, null, null];
        digitReelElements.forEach(reel => {
            if (reel) { // Ensure reel exists
                reel.style.transition = 'none'; // Stop any ongoing CSS transition
                reel.style.transform = `translateY(0px)`; // Reset position
            }
        });
    }

    function clearDisplay() {
        clearRunningAnimations();
        // Don't clear and recreate digit containers here if setupDigitDisplay is called in initializeApp
        // Just reset their state. For this version, setupDigitDisplay is robust enough.

        if (qrCanvasEl) {
            const ctx = qrCanvasEl.getContext('2d');
            ctx.clearRect(0, 0, qrCanvasEl.width, qrCanvasEl.height);
            qrCanvasEl.style.display = 'none';
        }
    }
    
    function startReelSpin(reelIndex) {
        if (spinIntervals[reelIndex]) clearInterval(spinIntervals[reelIndex]); // Clear existing
        const reel = digitReelElements[reelIndex];
        if (!reel) return;

        reel.style.transition = 'none'; // No CSS transition during fast spin

        spinIntervals[reelIndex] = setInterval(() => {
            const randomReelDigitIndex = Math.floor(Math.random() * NUM_DIGITS_IN_REEL);
            // Spin within the first repetition block to leave room for "roll down"
            const targetY = -randomReelDigitIndex * computedDigitHeight;
            reel.style.transform = `translateY(${targetY}px)`;
        }, DIGIT_ANIMATION_CONFIG.SPIN_UPDATE_INTERVAL);
    }

    function settleReel(reelIndex, finalDigit) {
        if (spinIntervals[reelIndex]) {
            clearInterval(spinIntervals[reelIndex]);
            spinIntervals[reelIndex] = null;
        }
        const reel = digitReelElements[reelIndex];
        if (!reel) return;

        reel.style.transition = `transform ${DIGIT_ANIMATION_CONFIG.SETTLE_TRANSITION_DURATION}ms ease-out`;
        
        // Target the digit in the second to last repetition for a good roll effect
        const targetReelItemIndex = (REEL_REPETITIONS - 2) * NUM_DIGITS_IN_REEL + parseInt(finalDigit);
        const targetY = -targetReelItemIndex * computedDigitHeight;
        reel.style.transform = `translateY(${targetY}px)`;
    }

    function animateNumberDisplay(numberString) {
        clearRunningAnimations(); // Clear any previous animation states first
        if (computedDigitHeight === 0) computedDigitHeight = getDigitHeight(); // Ensure it's computed

        const finalDigits = numberString.split('');

        // Phase 1: Initial Full Spin
        for (let i = 0; i < 4; i++) {
            startReelSpin(i);
        }

        // Sequential settling
        let currentDigitToSettle = 0;
        function scheduleNextSettle() {
            if (currentDigitToSettle >= 4) {
                 // All digits settled
                setTimeout(() => generateQRCode(numberString), DIGIT_ANIMATION_CONFIG.SETTLE_TRANSITION_DURATION); // Wait for last ease-out
                return;
            }

            const delay = (currentDigitToSettle === 0) ? 
                          DIGIT_ANIMATION_CONFIG.INITIAL_FULL_SPIN_DURATION : 
                          DIGIT_ANIMATION_CONFIG.SUBSEQUENT_SPIN_DURATION;

            setTimeout(() => {
                settleReel(currentDigitToSettle, finalDigits[currentDigitToSettle]);
                currentDigitToSettle++;
                scheduleNextSettle();
            }, delay);
        }
        scheduleNextSettle();
    }

    function generateQRCode(text) { /* ... (same as before) ... */
        if (!text) return;
        qrCanvasEl.style.display = 'block';
        if (qrInstance) {
            qrInstance.set({ value: text, size: 150 });
        } else {
            qrInstance = new QRious({
                element: qrCanvasEl,
                value: text,
                size: 150,
                padding: 10,
                level: 'H',
                background: '#ffffff',
                foreground: '#333333'
            });
        }
    }
    
    function redirectToUrl(url) { /* ... (same as before) ... */ 
        sendLog('redirect', url);
        window.location.href = url;
    }

    function resetUserCycle(reason = 'inactivity') { /* ... (same as before, clearDisplay will handle animation reset) ... */
        console.log(`User cycle reset due to ${reason}.`);
        clickCounter = 0;
        localStorage.setItem('clickCounter', clickCounter.toString());
        localStorage.setItem('lastClickTime', Date.now().toString());
        
        clearDisplay(); 
        
        sendLog('reset', reason);
        resetInactivityTimer();
    }

    function checkAndResetInactivity() { /* ... (same as before) ... */ 
        const now = Date.now();
        if (now - lastClickTime > INACTIVITY_TIMEOUT_MS) {
            resetUserCycle('inactivity_check_on_load');
        }
    }

    function resetInactivityTimer() { /* ... (same as before) ... */ 
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            resetUserCycle('timeout');
        }, INACTIVITY_TIMEOUT_MS);
    }

    function handleStartClick() { /* ... (same as before) ... */
        lastClickTime = Date.now();
        localStorage.setItem('lastClickTime', lastClickTime.toString());
        resetInactivityTimer();

        clickCounter++;
        localStorage.setItem('clickCounter', clickCounter.toString());
        sendLog('click', `Button click #${clickCounter}`);

        if (clickCounter === 1 || clickCounter === 3 || clickCounter === 5 || clickCounter === 7) {
            const randomNumber = generateValidRandomNumber();
            animateNumberDisplay(randomNumber);
        } else if (clickCounter === 2) {
            redirectToUrl(LINKS[0]);
        } else if (clickCounter === 4) {
            redirectToUrl(LINKS[1]);
        } else if (clickCounter === 6) {
            redirectToUrl(LINKS[2]);
        } else {
            redirectToUrl(ADSTERRA_LINK);
        }
    }

    initializeApp(); // Start the application
});