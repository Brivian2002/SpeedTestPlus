/**
 * Speed Test Plus - Main Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initFAQ();
  initScrollAnimations();
  initSpeedTest();
  setActiveNav();
});

// ==========================================
// NAVBAR
// ==========================================
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');

  // Scroll effect
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Mobile toggle
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navLinks.classList.toggle('open');
    });

    // Close on link click
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navLinks.classList.remove('open');
      });
    });
  }
}

// ==========================================
// SET ACTIVE NAV
// ==========================================
function setActiveNav() {
  const path = window.location.pathname;
  const links = document.querySelectorAll('.nav-links a');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || 
        (path === '/' && href === 'index.html') ||
        (path.endsWith(href))) {
      link.classList.add('active');
    }
  });
}

// ==========================================
// FAQ ACCORDION
// ==========================================
function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        // Close all
        faqItems.forEach(f => f.classList.remove('open'));
        // Toggle current
        if (!isOpen) {
          item.classList.add('open');
        }
      });
    }
  });
}

// ==========================================
// SCROLL ANIMATIONS
// ==========================================
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// ==========================================
// SPEED TEST UI CONTROLLER
// ==========================================
function initSpeedTest() {
  const startBtn = document.getElementById('start-test-btn');
  if (!startBtn) return;

  const gaugeNumber = document.getElementById('gauge-number');
  const gaugeUnit = document.getElementById('gauge-unit');
  const gaugeLabel = document.getElementById('gauge-label');
  const gaugeFill = document.getElementById('gauge-fill');
  const progressBar = document.getElementById('test-progress-bar');
  const progressContainer = document.getElementById('test-progress');
  const statusText = document.getElementById('test-status');
  const downloadResult = document.getElementById('result-download');
  const uploadResult = document.getElementById('result-upload');
  const pingResult = document.getElementById('result-ping');
  const jitterResult = document.getElementById('result-jitter');

  let engine = null;

  function resetUI() {
    gaugeNumber.textContent = '0';
    gaugeUnit.textContent = 'Mbps';
    gaugeLabel.textContent = 'Ready';
    setGauge(0);
    downloadResult.textContent = '--';
    uploadResult.textContent = '--';
    pingResult.textContent = '--';
    jitterResult.textContent = '--';
    progressBar.style.width = '0%';
    statusText.textContent = 'Click "Start Test" to begin';
    progressContainer.classList.remove('active');
  }

  function setGauge(speed, maxSpeed = 500) {
    const percentage = Math.min(speed / maxSpeed, 1);
    // Arc length = 283 (for our SVG path)
    const offset = 283 - (283 * percentage);
    gaugeFill.style.strokeDashoffset = offset;
  }

  function animateNumber(element, target, duration = 300) {
    const start = parseFloat(element.textContent) || 0;
    const diff = target - start;
    const startTime = performance.now();
    
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      
      if (target >= 100) {
        element.textContent = Math.round(current);
      } else if (target >= 10) {
        element.textContent = current.toFixed(1);
      } else {
        element.textContent = current.toFixed(2);
      }
      
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  }

  startBtn.addEventListener('click', () => {
    if (engine && engine.isTesting) {
      engine.stop();
      startBtn.classList.remove('testing');
      startBtn.innerHTML = '<i class="fas fa-play"></i> Start Test <span class="btn-pulse"></span>';
      resetUI();
      return;
    }

    resetUI();
    startBtn.classList.add('testing');
    startBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Test';
    progressContainer.classList.add('active');

    engine = new SpeedTestEngine({
      onProgress(percent) {
        progressBar.style.width = percent + '%';
      },
      onPhaseChange(phase) {
        switch (phase) {
          case 'ping':
            statusText.textContent = 'Testing latency...';
            gaugeLabel.textContent = 'Ping';
            gaugeUnit.textContent = 'ms';
            break;
          case 'download':
            statusText.textContent = 'Testing download speed...';
            gaugeLabel.textContent = 'Download';
            gaugeUnit.textContent = 'Mbps';
            break;
          case 'upload':
            statusText.textContent = 'Testing upload speed...';
            gaugeLabel.textContent = 'Upload';
            gaugeUnit.textContent = 'Mbps';
            break;
        }
      },
      onPingProgress(ping) {
        animateNumber(gaugeNumber, ping, 200);
        setGauge(ping, 100);
      },
      onDownloadProgress(speed) {
        animateNumber(gaugeNumber, speed, 200);
        setGauge(speed);
        downloadResult.textContent = speed.toFixed(2);
      },
      onUploadProgress(speed) {
        animateNumber(gaugeNumber, speed, 200);
        setGauge(speed);
        uploadResult.textContent = speed.toFixed(2);
      },
      onComplete(results) {
        startBtn.classList.remove('testing');
        startBtn.innerHTML = '<i class="fas fa-redo"></i> Test Again <span class="btn-pulse"></span>';
        statusText.textContent = 'Test complete!';
        gaugeLabel.textContent = 'Download';
        gaugeUnit.textContent = 'Mbps';

        animateNumber(gaugeNumber, results.download, 500);
        setGauge(results.download);
        downloadResult.textContent = results.download.toFixed(2);
        uploadResult.textContent = results.upload.toFixed(2);
        pingResult.textContent = results.ping;
        jitterResult.textContent = results.jitter;

        // Show rating
        showSpeedRating(results.download);
        // Refresh history
        renderHistory();
      },
      onError(msg) {
        startBtn.classList.remove('testing');
        startBtn.innerHTML = '<i class="fas fa-play"></i> Start Test <span class="btn-pulse"></span>';
        statusText.textContent = 'Error: ' + msg;
        progressContainer.classList.remove('active');
      },
    });

    engine.start();
  });

  // Initialize history display
  renderHistory();
}

// ==========================================
// SPEED RATING
// ==========================================
function showSpeedRating(downloadMbps) {
  const ratingEl = document.getElementById('speed-rating');
  if (!ratingEl) return;

  let rating, color, description;
  if (downloadMbps >= 100) {
    rating = 'Excellent';
    color = '#10B981';
    description = 'Your connection is blazing fast! Perfect for 4K streaming, gaming, and large downloads.';
  } else if (downloadMbps >= 50) {
    rating = 'Very Good';
    color = '#06B6D4';
    description = 'Great speed! Smooth for HD streaming, video calls, and multi-device usage.';
  } else if (downloadMbps >= 25) {
    rating = 'Good';
    color = '#4F46E5';
    description = 'Solid speed for most activities including HD streaming and video conferencing.';
  } else if (downloadMbps >= 10) {
    rating = 'Fair';
    color = '#F59E0B';
    description = 'Adequate for basic browsing and SD streaming. May struggle with multiple devices.';
  } else {
    rating = 'Slow';
    color = '#EF4444';
    description = 'Your connection is slow. Consider upgrading your plan or troubleshooting.';
  }

  ratingEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-top:1rem;padding:1rem;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid ${color}30;">
      <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></div>
      <div>
        <strong style="color:${color};font-size:0.95rem;">${rating}</strong>
        <p style="color:#94A3B8;font-size:0.82rem;margin:0;line-height:1.5;">${description}</p>
      </div>
    </div>
  `;
}

// ==========================================
// HISTORY
// ==========================================
function renderHistory() {
  const historyContainer = document.getElementById('history-body');
  if (!historyContainer) return;

  const history = SpeedTestEngine.getHistory();
  
  if (history.length === 0) {
    historyContainer.innerHTML = `
      <tr>
        <td colspan="5" class="history-empty">
          <i class="fas fa-history" style="font-size:1.5rem;margin-bottom:0.5rem;display:block;color:var(--gray-600);"></i>
          No test history yet. Run a speed test to see results here.
        </td>
      </tr>
    `;
    return;
  }

  historyContainer.innerHTML = history.slice(0, 10).map(entry => {
    const date = new Date(entry.timestamp);
    const formatted = date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    return `
      <tr>
        <td>${formatted}</td>
        <td style="color:#818CF8;">${entry.download.toFixed(2)} Mbps</td>
        <td style="color:#06B6D4;">${entry.upload.toFixed(2)} Mbps</td>
        <td>${entry.ping} ms</td>
        <td>${entry.jitter} ms</td>
      </tr>
    `;
  }).join('');
}

function clearHistory() {
  SpeedTestEngine.clearHistory();
  renderHistory();
}

// Make clearHistory available globally
window.clearHistory = clearHistory;
