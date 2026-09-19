(function() {
  const ARENAS = window.ARENAS;
  const audio = window.studioAudio;

  let curIdx = 0, graph = null, police = [], thief = null;
  let selPolice = null, turn = 'POLICE', over = false;
  let mode = 'SINGLE', role = 'POLICE', history = [];

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    ctx.resetTransform(); ctx.scale(dpr, dpr);
  }
  window.addEventListener('resize', resize);

  function loadLevel(i) {
    curIdx = Math.max(0, Math.min(i, ARENAS.length - 1));
    const d = ARENAS[curIdx];
    graph = { id: d.id, name: d.name, nodes: d.nodes, edges: d.edges, adj: new Map() };
    d.nodes.forEach(n => graph.adj.set(n.id, []));
    d.edges.forEach(e => { graph.adj.get(e[0]).push(e[1]); graph.adj.get(e[1]).push(e[0]); });
    police = d.police.slice(); thief = d.thief;
    selPolice = null; turn = 'POLICE'; over = false; history = [];
    document.getElementById('level-label').textContent = d.name;
    document.getElementById('modal-gameover').style.display = 'none';
    updateTurn();

    if (mode === 'SINGLE' && role === 'THIEF' && turn === 'POLICE') {
      runAI();
    }
  }

  function updateTurn() {
    const t = document.getElementById('turn-indicator');
    t.textContent = turn === 'POLICE' ? "POLICE TURN" : "BUGGU'S TURN";
    t.style.background = turn === 'POLICE' ? "#1e3a8a" : "#881337";
    t.style.color = turn === 'POLICE' ? "#93c5fd" : "#fecdd3";
    t.style.border = turn === 'POLICE' ? "1px solid #3b82f6" : "1px solid #f43f5e";
  }

  function checkGameState() {
    const n = graph.nodes.find(node => node.id === thief);
    if (n && n.isExit) { finish(false); return true; }
    const moves = graph.adj.get(thief).filter(id => !police.includes(id));
    if (moves.length === 0) { finish(true); return true; }
    return false;
  }

  function finish(policeWon) {
    over = true;
    document.getElementById('modal-gameover').style.display = 'flex';
    document.getElementById('end-title').textContent = policeWon ? "Police wins" : "Buggu wins";
    document.getElementById('end-subtitle').textContent = policeWon ? "Buggu is trapped!" : "Buggu escaped!";
    document.getElementById('end-art-police').style.display = policeWon ? 'flex' : 'none';
    document.getElementById('end-art-thief').style.display = policeWon ? 'none' : 'flex';
    if (policeWon) audio.playTone(523, 0.2); else audio.playTone(220, 0.2, 'sawtooth');

    const act = document.getElementById('end-actions');
    act.innerHTML = '';
    const userWon = (role === 'POLICE' && policeWon) || (role === 'THIEF' && !policeWon);
    if (mode === 'SINGLE' && !userWon) {
      const btn = document.createElement('button');
      btn.textContent = 'Retry Level';
      btn.style.cssText = 'width:100%; padding:12px; border-radius:12px; font-weight:700; color:#fff; background:#0284c7; border:none; cursor:pointer;';
      btn.onclick = () => loadLevel(curIdx);
      act.appendChild(btn);
    } else {
      const b1 = document.createElement('button');
      b1.textContent = 'Replay';
      b1.style.cssText = 'flex:1; padding:12px; border-radius:12px; font-weight:700; color:#fff; background:#64748b; border:none; cursor:pointer;';
      b1.onclick = () => loadLevel(curIdx);
      const b2 = document.createElement('button');
      b2.textContent = 'Next';
      b2.style.cssText = 'flex:1; padding:12px; border-radius:12px; font-weight:700; color:#fff; background:#65a30d; border:none; cursor:pointer;';
      b2.onclick = () => loadLevel((curIdx + 1) % ARENAS.length);
      act.appendChild(b1); act.appendChild(b2);
    }
  }

  function runAI() {
    if (over || mode === 'PASS_PLAY') return;
    setTimeout(() => {
      if (turn === 'THIEF' && role === 'POLICE') {
        const free = graph.adj.get(thief).filter(id => !police.includes(id));
        if (free.length > 0) {
          const exit = free.find(id => graph.nodes.find(n => n.id === id).isExit);
          thief = exit !== undefined ? exit : free[Math.floor(Math.random() * free.length)];
          audio.playTone(320, 0.08);
        }
        turn = 'POLICE'; updateTurn(); checkGameState();
      } else if (turn === 'POLICE' && role === 'THIEF') {
        const possibleMoves = [];
        for (let i = 0; i < police.length; i++) {
          const p = police[i];
          const adj = graph.adj.get(p).filter(id => !police.includes(id) && id !== thief);
          adj.forEach(target => possibleMoves.push({ policeIndex: i, to: target }));
        }
        if (possibleMoves.length > 0) {
          const chosen = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
          police[chosen.policeIndex] = chosen.to;
          audio.playTone(400, 0.06);
        }
        turn = 'THIEF'; updateTurn(); checkGameState();
      }
    }, 400);
  }

  function toScreen(nx, ny, r) {
    return { x: r.width * 0.10 + nx * (r.width * 0.80), y: r.height * 0.12 + ny * (r.height * 0.76) };
  }

  function handleBoardTap(clientX, clientY) {
    if (over) return;
    const r = canvas.getBoundingClientRect();
    const px = clientX - r.left, py = clientY - r.top;
    let target = null, minD = 48;
    graph.nodes.forEach(n => {
      const pt = toScreen(n.x, n.y, r);
      const d = Math.hypot(pt.x - px, pt.y - py);
      if (d < minD) { minD = d; target = n; }
    });
    if (!target) return;

    if (turn === 'POLICE' && (mode === 'PASS_PLAY' || role === 'POLICE')) {
      if (police.includes(target.id)) {
        selPolice = target.id; audio.playTone(480, 0.05);
      } else if (selPolice !== null) {
        if (graph.adj.get(selPolice).includes(target.id) && !police.includes(target.id) && target.id !== thief) {
          history.push({ p: police.slice(), t: thief, turn });
          police[police.indexOf(selPolice)] = target.id;
          selPolice = null; audio.playTone(300, 0.08);
          turn = 'THIEF'; updateTurn();
          if (!checkGameState()) runAI();
        }
      }
    } else if (turn === 'THIEF' && (mode === 'PASS_PLAY' || role === 'THIEF')) {
      if (graph.adj.get(thief).includes(target.id) && !police.includes(target.id)) {
        history.push({ p: police.slice(), t: thief, turn });
        thief = target.id; audio.playTone(300, 0.08);
        turn = 'POLICE'; updateTurn();
        if (!checkGameState()) runAI();
      }
    }
  }

  canvas.addEventListener('pointerdown', e => handleBoardTap(e.clientX, e.clientY));

  function render() {
    const r = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    if (graph) {
      ctx.strokeStyle = '#5dbbfb'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      graph.edges.forEach(e => {
        const p1 = toScreen(graph.nodes.find(n => n.id === e[0]).x, graph.nodes.find(n => n.id === e[0]).y, r);
        const p2 = toScreen(graph.nodes.find(n => n.id === e[1]).x, graph.nodes.find(n => n.id === e[1]).y, r);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      });
      graph.nodes.forEach(n => {
        const pt = toScreen(n.x, n.y, r);
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 20, 0, Math.PI * 2);
        if (n.isExit) {
          ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4; ctx.stroke();
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#ef4444'; ctx.fill();
        } else {
          ctx.fillStyle = '#83858c'; ctx.fill(); ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 5; ctx.stroke();
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2); ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5; ctx.stroke();
        }
      });
      police.forEach(p => {
        const pt = toScreen(graph.nodes.find(n => n.id === p).x, graph.nodes.find(n => n.id === p).y, r);
        if (selPolice === p) {
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 26, 0, Math.PI * 2); ctx.fillStyle = 'rgba(56,189,248,0.4)'; ctx.fill();
        }
        ctx.font = '34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('👮‍♂️', pt.x, pt.y - 3);
      });
      if (thief !== null) {
        const pt = toScreen(graph.nodes.find(n => n.id === thief).x, graph.nodes.find(n => n.id === thief).y, r);
        ctx.font = '34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🦹', pt.x, pt.y - 3);
      }
    }
    requestAnimationFrame(render);
  }

  // Bind Buttons
  document.getElementById('btn-start-single').onclick = () => {
    audio.playTone(400, 0.05);
    document.getElementById('step-mode').style.display = 'none';
    document.getElementById('step-role').style.display = 'flex';
  };
  document.getElementById('btn-start-pass').onclick = () => {
    audio.playTone(400, 0.05);
    mode = 'PASS_PLAY';
    document.getElementById('screen-title').style.display = 'none';
    loadLevel(0);
  };
  document.getElementById('btn-role-back').onclick = () => {
    audio.playTone(300, 0.05);
    document.getElementById('step-role').style.display = 'none';
    document.getElementById('step-mode').style.display = 'flex';
  };
  document.getElementById('btn-role-police').onclick = () => {
    audio.playTone(500, 0.05);
    mode = 'SINGLE'; role = 'POLICE';
    document.getElementById('screen-title').style.display = 'none';
    loadLevel(0);
  };
  document.getElementById('btn-role-thief').onclick = () => {
    audio.playTone(500, 0.05);
    mode = 'SINGLE'; role = 'THIEF';
    document.getElementById('screen-title').style.display = 'none';
    loadLevel(0);
  };
  document.getElementById('btn-go-home').onclick = () => {
    document.getElementById('modal-gameover').style.display = 'none';
    document.getElementById('step-role').style.display = 'none';
    document.getElementById('step-mode').style.display = 'flex';
    document.getElementById('screen-title').style.display = 'flex';
  };
  document.getElementById('btn-restart').onclick = () => loadLevel(curIdx);
  document.getElementById('btn-undo').onclick = () => {
    if (history.length && !over) {
      const l = history.pop(); police = l.p.slice(); thief = l.t; turn = l.turn; selPolice = null; updateTurn();
    }
  };
  document.getElementById('btn-open-levels').onclick = () => {
    const g = document.getElementById('levels-grid'); g.innerHTML = '';
    ARENAS.forEach((l, idx) => {
      const b = document.createElement('button');
      b.style.cssText = `padding:8px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; border:none; ${idx === curIdx ? 'background:#2563eb; color:#fff;' : 'background:#334155; color:#cbd5e1;'}`;
      b.textContent = l.id;
      b.onclick = () => { loadLevel(idx); document.getElementById('modal-levels').style.display = 'none'; };
      g.appendChild(b);
    });
    document.getElementById('modal-levels').style.display = 'flex';
  };
  document.getElementById('btn-close-levels').onclick = () => {
    document.getElementById('modal-levels').style.display = 'none';
  };

  function handleSoundToggle() {
    const on = audio.toggle();
    const icon = on ? '🔊' : '🔇';
    document.getElementById('btn-sound-game').textContent = icon;
    document.getElementById('title-sound-btn').textContent = icon;
  }
  document.getElementById('btn-sound-game').onclick = handleSoundToggle;
  document.getElementById('title-sound-btn').onclick = handleSoundToggle;

  resize();
  loadLevel(0);
  requestAnimationFrame(render);
})();
