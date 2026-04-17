/**
 * Speed Test Plus - Internet Speed Test Engine
 * Client-side speed test using multiple techniques
 * Measures: Download, Upload, Ping, Jitter
 */

class SpeedTestEngine {
  constructor(options = {}) {
    this.testServers = [
      'https://speed.cloudflare.com/__down?bytes=',
      'https://bouygues.testdebit.info/10M.iso',
    ];
    this.downloadSizes = [
      { size: 256 * 1024, label: '256KB' },
      { size: 512 * 1024, label: '512KB' },
      { size: 1024 * 1024, label: '1MB' },
      { size: 2 * 1024 * 1024, label: '2MB' },
      { size: 5 * 1024 * 1024, label: '5MB' },
      { size: 10 * 1024 * 1024, label: '10MB' },
      { size: 25 * 1024 * 1024, label: '25MB' },
    ];
    this.isTesting = false;
    this.aborted = false;
    this.abortController = null;
    this.results = {
      download: 0,
      upload: 0,
      ping: 0,
      jitter: 0,
    };
    this.callbacks = {
      onProgress: options.onProgress || (() => {}),
      onDownloadProgress: options.onDownloadProgress || (() => {}),
      onUploadProgress: options.onUploadProgress || (() => {}),
      onPingProgress: options.onPingProgress || (() => {}),
      onComplete: options.onComplete || (() => {}),
      onError: options.onError || (() => {}),
      onPhaseChange: options.onPhaseChange || (() => {}),
    };
  }

  async start() {
    if (this.isTesting) return;
    this.isTesting = true;
    this.aborted = false;
    this.abortController = new AbortController();
    this.results = { download: 0, upload: 0, ping: 0, jitter: 0 };

    try {
      // Phase 1: Ping & Jitter
      this.callbacks.onPhaseChange('ping');
      this.callbacks.onProgress(5);
      await this.measurePing();
      if (this.aborted) return;

      // Phase 2: Download
      this.callbacks.onPhaseChange('download');
      this.callbacks.onProgress(20);
      await this.measureDownload();
      if (this.aborted) return;

      // Phase 3: Upload
      this.callbacks.onPhaseChange('upload');
      this.callbacks.onProgress(70);
      await this.measureUpload();
      if (this.aborted) return;

      // Complete
      this.callbacks.onProgress(100);
      this.callbacks.onComplete(this.results);
      this.saveToHistory(this.results);
    } catch (err) {
      if (!this.aborted) {
        console.error('Speed test error:', err);
        this.callbacks.onError(err.message || 'Test failed. Please try again.');
      }
    } finally {
      this.isTesting = false;
    }
  }

  stop() {
    this.aborted = true;
    this.isTesting = false;
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // ==========================================
  // PING & JITTER
  // ==========================================
  async measurePing() {
    const pings = [];
    const pingUrl = 'https://speed.cloudflare.com/__down?bytes=0';
    const iterations = 20;

    for (let i = 0; i < iterations; i++) {
      if (this.aborted) return;
      try {
        const start = performance.now();
        await fetch(pingUrl + '&_=' + Date.now() + i, {
          method: 'HEAD',
          mode: 'cors',
          cache: 'no-store',
          signal: this.abortController.signal,
        });
        const end = performance.now();
        const latency = end - start;
        pings.push(latency);
        
        const currentPing = Math.round(this.getMedian(pings));
        this.callbacks.onPingProgress(currentPing);
        this.callbacks.onProgress(5 + (i / iterations) * 15);
      } catch (e) {
        if (this.aborted) return;
        // skip failed pings
      }
    }

    if (pings.length > 2) {
      // Remove outliers
      pings.sort((a, b) => a - b);
      const trimmed = pings.slice(1, -1);
      this.results.ping = Math.round(this.getMedian(trimmed));
      
      // Jitter = average deviation between consecutive pings
      let jitterSum = 0;
      for (let i = 1; i < trimmed.length; i++) {
        jitterSum += Math.abs(trimmed[i] - trimmed[i - 1]);
      }
      this.results.jitter = Math.round((jitterSum / (trimmed.length - 1)) * 10) / 10;
    } else {
      this.results.ping = pings.length > 0 ? Math.round(pings[0]) : 0;
      this.results.jitter = 0;
    }
  }

  getMedian(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // ==========================================
  // DOWNLOAD SPEED
  // ==========================================
  async measureDownload() {
    const measurements = [];
    const testDuration = 10000; // 10 seconds max
    const startTime = performance.now();

    // Start with small files and scale up
    for (let sizeIdx = 0; sizeIdx < this.downloadSizes.length; sizeIdx++) {
      if (this.aborted) return;
      if (performance.now() - startTime > testDuration) break;

      const { size } = this.downloadSizes[sizeIdx];
      const url = `https://speed.cloudflare.com/__down?bytes=${size}&_=${Date.now()}`;

      try {
        const dlStart = performance.now();
        const response = await fetch(url, {
          mode: 'cors',
          cache: 'no-store',
          signal: this.abortController.signal,
        });

        const reader = response.body.getReader();
        let loaded = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done || this.aborted) break;
          loaded += value.length;
          
          const elapsed = (performance.now() - dlStart) / 1000;
          if (elapsed > 0) {
            const speed = (loaded * 8) / elapsed / 1000000;
            this.callbacks.onDownloadProgress(Math.round(speed * 10) / 10);
          }
        }

        const dlEnd = performance.now();
        const duration = (dlEnd - dlStart) / 1000;
        
        if (duration > 0 && loaded > 0) {
          const speedMbps = (loaded * 8) / duration / 1000000;
          measurements.push(speedMbps);
        }

        const progress = 20 + ((performance.now() - startTime) / testDuration) * 50;
        this.callbacks.onProgress(Math.min(progress, 70));
        
        // If download was too fast, try a bigger file
        if (performance.now() - dlStart < 1000 && sizeIdx < this.downloadSizes.length - 1) {
          continue;
        }

        // Run multiple tests at current size for accuracy
        if (sizeIdx >= 2 && performance.now() - startTime < testDuration) {
          // Do another round at same size
          const url2 = `https://speed.cloudflare.com/__down?bytes=${size}&_=${Date.now()}r`;
          try {
            const dlStart2 = performance.now();
            const resp2 = await fetch(url2, {
              mode: 'cors',
              cache: 'no-store',
              signal: this.abortController.signal,
            });
            const reader2 = resp2.body.getReader();
            let loaded2 = 0;
            while (true) {
              const { done, value } = await reader2.read();
              if (done || this.aborted) break;
              loaded2 += value.length;
            }
            const dur2 = (performance.now() - dlStart2) / 1000;
            if (dur2 > 0 && loaded2 > 0) {
              measurements.push((loaded2 * 8) / dur2 / 1000000);
            }
          } catch (e) { /* skip */ }
        }

      } catch (e) {
        if (this.aborted) return;
        continue;
      }
    }

    if (measurements.length > 0) {
      // Use the top 60% of measurements for the result (removes slow starts)
      measurements.sort((a, b) => b - a);
      const topN = Math.max(1, Math.ceil(measurements.length * 0.6));
      const topMeasurements = measurements.slice(0, topN);
      this.results.download = Math.round(
        (topMeasurements.reduce((a, b) => a + b, 0) / topMeasurements.length) * 100
      ) / 100;
    }

    this.callbacks.onDownloadProgress(this.results.download);
  }

  // ==========================================
  // UPLOAD SPEED
  // ==========================================
  async measureUpload() {
    const measurements = [];
    const uploadSizes = [256 * 1024, 512 * 1024, 1024 * 1024, 2 * 1024 * 1024];
    const testDuration = 8000;
    const startTime = performance.now();

    for (let sizeIdx = 0; sizeIdx < uploadSizes.length; sizeIdx++) {
      if (this.aborted) return;
      if (performance.now() - startTime > testDuration) break;

      const size = uploadSizes[sizeIdx];
      const data = new ArrayBuffer(size);
      const blob = new Blob([data]);

      try {
        const ulStart = performance.now();
        await fetch('https://speed.cloudflare.com/__up', {
          method: 'POST',
          mode: 'cors',
          body: blob,
          signal: this.abortController.signal,
        });
        const ulEnd = performance.now();
        const duration = (ulEnd - ulStart) / 1000;

        if (duration > 0) {
          const speedMbps = (size * 8) / duration / 1000000;
          measurements.push(speedMbps);
          this.callbacks.onUploadProgress(Math.round(speedMbps * 10) / 10);
        }

        const progress = 70 + ((performance.now() - startTime) / testDuration) * 28;
        this.callbacks.onProgress(Math.min(progress, 98));

        // Run another round at same size for accuracy
        if (sizeIdx >= 1 && performance.now() - startTime < testDuration) {
          const data2 = new ArrayBuffer(size);
          const blob2 = new Blob([data2]);
          try {
            const ulStart2 = performance.now();
            await fetch('https://speed.cloudflare.com/__up', {
              method: 'POST',
              mode: 'cors',
              body: blob2,
              signal: this.abortController.signal,
            });
            const dur2 = (performance.now() - ulStart2) / 1000;
            if (dur2 > 0) {
              measurements.push((size * 8) / dur2 / 1000000);
            }
          } catch (e) { /* skip */ }
        }

      } catch (e) {
        if (this.aborted) return;
        continue;
      }
    }

    if (measurements.length > 0) {
      measurements.sort((a, b) => b - a);
      const topN = Math.max(1, Math.ceil(measurements.length * 0.6));
      const topMeasurements = measurements.slice(0, topN);
      this.results.upload = Math.round(
        (topMeasurements.reduce((a, b) => a + b, 0) / topMeasurements.length) * 100
      ) / 100;
    }

    this.callbacks.onUploadProgress(this.results.upload);
  }

  // ==========================================
  // HISTORY
  // ==========================================
  saveToHistory(results) {
    try {
      const history = JSON.parse(localStorage.getItem('speedtest_history') || '[]');
      history.unshift({
        ...results,
        timestamp: new Date().toISOString(),
        id: Date.now(),
      });
      // Keep last 50 results
      if (history.length > 50) history.length = 50;
      localStorage.setItem('speedtest_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Could not save to history:', e);
    }
  }

  static getHistory() {
    try {
      return JSON.parse(localStorage.getItem('speedtest_history') || '[]');
    } catch (e) {
      return [];
    }
  }

  static clearHistory() {
    localStorage.removeItem('speedtest_history');
  }
}

// Export for use
window.SpeedTestEngine = SpeedTestEngine;
