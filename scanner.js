/**
 * Scanner Engine for Attendify Pro
 * Handles Camera QR stream, BarcodeDetector API, manual barcode gun input,
 * and synthesized Web Audio confirmation chimes.
 */
(function(window) {
  const Scanner = {
    stream: null,
    videoEl: null,
    isScanning: false,
    audioCtx: null,
    recentScans: [],
    soundEnabled: true,
    scanCooldown: false
  };

  /**
   * Synthesize a crisp double-chime verification sound via Web Audio API
   */
  Scanner.playSuccessChime = function() {
    if (!Scanner.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!Scanner.audioCtx) {
        Scanner.audioCtx = new AudioCtx();
      }
      if (Scanner.audioCtx.state === 'suspended') {
        Scanner.audioCtx.resume();
      }

      const now = Scanner.audioCtx.currentTime;
      const osc1 = Scanner.audioCtx.createOscillator();
      const osc2 = Scanner.audioCtx.createOscillator();
      const gain = Scanner.audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // First beep: 880Hz (A5), second beep: 1320Hz (E6)
      osc1.frequency.setValueAtTime(880, now);
      osc2.frequency.setValueAtTime(1320, now + 0.08);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(Scanner.audioCtx.destination);

      osc1.start(now);
      osc1.stop(now + 0.08);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.warn('Web Audio chime unavailable:', e);
    }
  };

  /**
   * Start camera feed
   */
  Scanner.startCamera = async function(videoElementId, onScanSuccess, onError) {
    Scanner.videoEl = document.getElementById(videoElementId);
    if (!Scanner.videoEl) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (onError) onError('Camera access is not supported by your browser.');
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      Scanner.stream = await navigator.mediaDevices.getUserMedia(constraints);
      Scanner.videoEl.srcObject = Scanner.stream;
      await Scanner.videoEl.play();
      Scanner.isScanning = true;

      // Start frame processing
      Scanner.detectLoop(onScanSuccess);
    } catch (err) {
      console.warn('Camera stream error:', err);
      if (onError) onError(err.message || 'Unable to access camera. Please allow camera permissions.');
    }
  };

  /**
   * Detection loop using BarcodeDetector if available
   */
  Scanner.detectLoop = async function(onScanSuccess) {
    if (!Scanner.isScanning || !Scanner.videoEl) return;

    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
        const detectFrame = async () => {
          if (!Scanner.isScanning) return;
          try {
            if (Scanner.videoEl.readyState >= 2 && !Scanner.scanCooldown) {
              const barcodes = await barcodeDetector.detect(Scanner.videoEl);
              if (barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue;
                Scanner.triggerScan(rawValue, onScanSuccess);
              }
            }
          } catch (e) {
            // Frame detection pass error (ignore transient frame drop)
          }
          if (Scanner.isScanning) {
            requestAnimationFrame(detectFrame);
          }
        };
        requestAnimationFrame(detectFrame);
      } catch (err) {
        console.warn('BarcodeDetector initialization fallback', err);
      }
    }
  };

  /**
   * Handle identified code (prevents duplicate rapid triggers)
   */
  Scanner.triggerScan = function(code, onScanSuccess) {
    if (Scanner.scanCooldown) return;
    Scanner.scanCooldown = true;

    Scanner.playSuccessChime();
    if (onScanSuccess) onScanSuccess(code);

    // 2-second debounce between scans
    setTimeout(() => {
      Scanner.scanCooldown = false;
    }, 2000);
  };

  /**
   * Stop camera feed
   */
  Scanner.stopCamera = function() {
    Scanner.isScanning = false;
    if (Scanner.stream) {
      Scanner.stream.getTracks().forEach(track => track.stop());
      Scanner.stream = null;
    }
    if (Scanner.videoEl) {
      Scanner.videoEl.srcObject = null;
    }
  };

  window.ScannerEngine = Scanner;
})(window);
