let activeAudios = [];

function playSound(filename, volume = 1.0) {
  const audio = new Audio(chrome.runtime.getURL(filename));
  audio.volume = volume;
  activeAudios.push(audio);
  audio.play().catch(() => {});
  audio.addEventListener('ended', () => {
    activeAudios = activeAudios.filter(a => a !== audio);
  });
}

function stopAllSounds() {
  activeAudios.forEach(a => {
    a.pause();
    a.currentTime = 0;
  });
  activeAudios = [];
}

// layout math: 250px squares + 20px margins = 270px per item
function openFullscreenSpinner(actualScore, onComplete, customBezier = null) {
  const overlay = document.createElement('div');
  overlay.className = 'csgo-fullscreen-overlay';
  document.body.appendChild(overlay);

  const container = document.createElement('div');
  container.className = 'csgo-reveal-container';
  overlay.appendChild(container);

  const line = document.createElement('div');
  line.className = 'csgo-selection-line';
  container.appendChild(line);

  const track = document.createElement('div');
  track.className = 'csgo-track';
  if (customBezier) {
    track.style.transition = `transform cubic-bezier(${customBezier}) 7s`;
  }
  container.appendChild(track);

  const itemOuterWidth = 270;
  const targetIndex = 45;
  const totalItems = targetIndex + 15;
  
  for (let i = 0; i < totalItems; i++) {
    const item = document.createElement('div');
    let score = Math.floor(Math.random() * 5) + 1;
    if (i === targetIndex) score = actualScore;

    item.className = `csgo-item score-${score}`;
    item.innerText = score;
    track.appendChild(item);
  }

  void track.offsetWidth; 

  const windowWidth = window.innerWidth;
  
  let offset;
  const rand = Math.random();
  if (rand < 0.65) {
    if (Math.random() < 0.10) {
      offset = 115 + Math.random() * 8;
    } else {
      offset = 65 + Math.random() * 50;
    }
  } else if (rand < 0.90) {
    if (Math.random() < 0.10) {
      offset = -(115 + Math.random() * 8);
    } else {
      offset = -(65 + Math.random() * 50);
    }
  } else {
    offset = (Math.random() * 130) - 65;
  }

  const targetLeft = targetIndex * itemOuterWidth;
  const finalTx = -(targetLeft + (itemOuterWidth / 2) - (windowWidth / 2)) + offset;

  let startTimeout, endTimeout, animationFrameId;
  let currentTickIndex = -1;

  function trackTicks() {
    const trackRect = track.getBoundingClientRect();
    const centerRelative = (windowWidth / 2) - trackRect.left;
    const newIndex = Math.floor(centerRelative / itemOuterWidth);

    if (currentTickIndex !== -1 && newIndex !== currentTickIndex) {
      playSound('sounds/click.mp3', 0.5);
    }
    currentTickIndex = newIndex;
    animationFrameId = requestAnimationFrame(trackTicks);
  }

  playSound('sounds/start.mp3');

  startTimeout = setTimeout(() => {
    track.style.transform = `translateX(${finalTx}px)`;
    trackTicks();
  }, 1500);

  endTimeout = setTimeout(() => {
    cancelAnimationFrame(animationFrameId);
    if (actualScore >= 4) {
      playSound('sounds/goldEnd.mp3');
    } else {
      playSound('sounds/blueEnd.mp3');
    }
    
    if (onComplete) onComplete(overlay);
  }, 7500 + 1500); 
}

const DEBUG = false;

function injectDebugUI() {
  if (!DEBUG || document.getElementById('csgo-bezier-panel')) return;

  const bezierPanel = document.createElement('div');
  bezierPanel.id = 'csgo-bezier-panel';
  bezierPanel.style.position = 'fixed';
  bezierPanel.style.top = '0';
  bezierPanel.style.left = '0';
  bezierPanel.style.zIndex = '999999';

  bezierPanel.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: flex-start;">
      <div style="display: flex;">
        <input type="text" id="csgo-debug-bezier" value="0.135, 0.755, 0.425, 0.970">
        <button id="csgo-debug-btn">Test</button>
      </div>
      <canvas id="csgo-bezier-canvas" width="300" height="300" style="background:#fff;"></canvas>
    </div>
  `;
  document.body.appendChild(bezierPanel);

  const canvas = document.getElementById('csgo-bezier-canvas');
  const ctx = canvas.getContext('2d');
  const input = document.getElementById('csgo-debug-bezier');
  
  let p1 = { x: 0.135, y: 0.755 };
  let p2 = { x: 0.425, y: 0.970 };
  let dragging = null;

  const pad = 50;
  const box = 200;

  function drawBezier() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad, box, box);
    
    ctx.strokeStyle = '#eee'; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(pad, pad + box/2); ctx.lineTo(pad + box, pad + box/2); ctx.stroke();
    ctx.setLineDash([]);

    const cx1 = pad + p1.x * box, cy1 = pad + box - (p1.y * box);
    const cx2 = pad + p2.x * box, cy2 = pad + box - (p2.y * box);

    ctx.strokeStyle = '#aaa';
    ctx.beginPath(); ctx.moveTo(pad, pad + box); ctx.lineTo(cx1, cy1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad + box, pad); ctx.lineTo(cx2, cy2); ctx.stroke();

    ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pad, pad + box);
    ctx.bezierCurveTo(cx1, cy1, cx2, cy2, pad + box, pad);
    ctx.stroke();

    ctx.fillStyle = '#00f'; ctx.fillRect(cx1 - 4, cy1 - 4, 8, 8);
    ctx.fillStyle = '#f00'; ctx.fillRect(cx2 - 4, cy2 - 4, 8, 8);
  }

  function updateInput() {
    input.value = `${p1.x.toFixed(3)}, ${p1.y.toFixed(3)}, ${p2.x.toFixed(3)}, ${p2.y.toFixed(3)}`;
  }

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const cx1 = pad + p1.x * box, cy1 = pad + box - (p1.y * box);
    const cx2 = pad + p2.x * box, cy2 = pad + box - (p2.y * box);
    
    if (Math.hypot(mx - cx1, my - cy1) < 15) dragging = p1;
    else if (Math.hypot(mx - cx2, my - cy2) < 15) dragging = p2;
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    let nx = ((e.clientX - rect.left) - pad) / box;
    let ny = (pad + box - (e.clientY - rect.top)) / box;
    
    dragging.x = Math.max(0, Math.min(1, nx));
    dragging.y = ny;
    
    drawBezier();
    updateInput();
  });

  window.addEventListener('mouseup', () => dragging = null);

  input.addEventListener('input', () => {
    const vals = input.value.split(',').map(v => parseFloat(v));
    if (vals.length === 4 && vals.every(v => !isNaN(v))) {
      p1 = { x: Math.max(0, Math.min(1, vals[0])), y: vals[1] };
      p2 = { x: Math.max(0, Math.min(1, vals[2])), y: vals[3] };
      drawBezier();
    }
  });

  drawBezier();

  document.getElementById('csgo-debug-btn').addEventListener('click', () => {
    const bezier = document.getElementById('csgo-debug-bezier').value;
    openFullscreenSpinner(5, (overlay) => {
      overlay.remove();
      fireConfetti(200);
    }, bezier);
  });
}

// observer triggers this to swap cb scores with placeholders
function initialize() {
  injectDebugUI();
  const cards = document.querySelectorAll('.apscores-card'); 

  cards.forEach(card => {
    if (card.dataset.csgo === 'true' || card.querySelector('.csgo-inline-placeholder')) return;

    const badge = card.querySelector('.apscores-badge-score');
    const body = card.querySelector('.apscores-card-body');
    
    if (!badge || !body) return;

    const match = badge.textContent.trim().match(/([1-5])$/);
    if (match) {
      const score = parseInt(match[1], 10);
      
      card.dataset.csgo = 'true';
      body.classList.add('ap-score-hidden');
      body.style.setProperty('display', 'none', 'important');

      const placeholder = document.createElement('div');
      placeholder.className = 'csgo-inline-placeholder';
      placeholder.innerText = 'Click to Reveal AP Score';
      card.appendChild(placeholder);

      let opened = false;
      placeholder.addEventListener('click', () => {
        if (opened) return;
        opened = true;

        const useOvershoot = Math.random() < 0.10;
        const bezier = useOvershoot ? '0.135, 0.755, 0.405, 1.195' : null;

        openFullscreenSpinner(score, (overlay) => {
          overlay.remove();
          placeholder.remove();
          body.classList.remove('ap-score-hidden');
          body.style.removeProperty('display');
          
          if (score === 5) fireConfetti(200);
          if (score === 4) fireConfetti(50);
        }, bezier);
      });
    }
  });
}

function fireConfetti(amount) {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '2147483647';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'];

  for (let i = 0; i < amount; i++) {
    const isLeft = i % 2 === 0;
    particles.push({
      x: isLeft ? 0 : canvas.width,
      y: canvas.height,
      vx: (isLeft ? 1 : -1) * (Math.random() * 20 + 5),
      vy: -(Math.random() * 20 + 15),
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      spin: (Math.random() - 0.5) * 15,
      tilt: Math.random() * 360,
      tiltSpin: (Math.random() - 0.5) * 15
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4;
      p.vx *= 0.99;

      p.rotation += p.spin;
      p.tilt += p.tiltSpin;

      if (p.y < canvas.height + 20) active = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.scale(1, Math.sin(p.tilt * Math.PI / 180)); 
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    if (active) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }

  animate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

const observer = new MutationObserver((mutations) => {
    if (mutations.some(m => m.addedNodes.length > 0)) {
        clearTimeout(window.csgoTimeout);
        window.csgoTimeout = setTimeout(initialize, 50);
    }
});
observer.observe(document.documentElement, { childList: true, subtree: true });