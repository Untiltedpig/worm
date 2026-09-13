/* ============================================================
   WORMROUTE — STANDALONE GAME (game.js)
   Pilot the data-worm out of the staging room and climb a
   winding 5-cell-wide conduit to the exfil node. Touch a wall
   and the worm splatters. 10 maps, auto-advancing on victory.

   No dependencies. No backend. Boots itself on page load.
   ============================================================ */
(function () {
  "use strict";

  /* ============================================================
     AUDIO — tiny WebAudio square-wave beep (self-contained)
     ============================================================ */
  var audioCtx = null;
  function beep(f, ms, n) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      n = n || 1;
      for (var i = 0; i < n; i++) {
        (function (k) {
          var o = audioCtx.createOscillator(), g = audioCtx.createGain();
          o.type = "square"; o.frequency.value = f;
          g.gain.value = 0.045;
          o.connect(g); g.connect(audioCtx.destination);
          var t0 = audioCtx.currentTime + k * 0.13;
          o.start(t0); o.stop(t0 + ms / 1000);
        })(i);
      }
    } catch (e) { /* audio unavailable — ignore */ }
  }

  /* ============================================================
     SHARED KIT
     ============================================================ */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function pad2(n) { return String(n).padStart(2, "0"); }

  /* ============================================================
     GAME SHELL — common frame (header, status bar, win/fail
     screens) + cleanup tracking so every interval/listener dies
     with the map.
     ============================================================ */
  function makeShell(container, map, sectorNum, sectorTotal) {
    var dead = false, cleanups = [], winTO = null, restartFn = null;

    container.innerHTML = "";
    var root = document.createElement("div");
    root.className = "mg-root scan-grid";
    root.innerHTML =
      '<div class="mg-head">' +
        '<span class="mg-cat">SECTOR ' + pad2(sectorNum) + "/" + sectorTotal + " // " + esc(map.category) + "</span>" +
        '<span class="mg-name">' + esc(map.name) + "</span>" +
      "</div>" +
      '<div class="mg-body"></div>' +
      '<div class="mg-foot"><span class="mg-status">STANDBY</span>' +
        '<span class="mg-hint">WORMROUTE SECTOR ' + pad2(sectorNum) + "</span></div>";
    container.appendChild(root);

    var body = root.querySelector(".mg-body");
    var statusEl = root.querySelector(".mg-status");

    function flush() {
      cleanups.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
      cleanups = [];
    }
    function track(idFn, clearFn) {
      var id = idFn();
      cleanups.push(function () { clearFn(id); });
      return id;
    }

    return {
      body: body,
      root: root,
      setRestart: function (fn) { restartFn = fn; },
      status: function (txt, cls) {
        statusEl.textContent = txt;
        statusEl.className = "mg-status" + (cls ? " " + cls : "");
      },
      every: function (ms, fn) {
        return track(function () { return setInterval(fn, ms); }, clearInterval);
      },
      after: function (ms, fn) {
        return track(function () { return setTimeout(fn, ms); }, clearTimeout);
      },
      on: function (elm, ev, fn) {
        elm.addEventListener(ev, fn);
        cleanups.push(function () { elm.removeEventListener(ev, fn); });
      },
      key: function (fn) {
        var h = function (e) { if (!dead) fn(e); };
        document.addEventListener("keydown", h);
        cleanups.push(function () { document.removeEventListener("keydown", h); });
      },
      raf: function (fn) {
        var id = 0, alive = true;
        function loop() { if (!alive) return; fn(); id = requestAnimationFrame(loop); }
        id = requestAnimationFrame(loop);
        cleanups.push(function () { alive = false; cancelAnimationFrame(id); });
      },
      win: function (onSuccess, msg) {
        if (dead) return;
        dead = true; flush();
        var m = msg || "SECTOR CLEAR";
        body.innerHTML = '<div class="mg-win glitch green" data-text="' + esc(m) + '">' + esc(m) + "</div>";
        beep(980, 90, 3);
        winTO = setTimeout(onSuccess, 1100);
      },
      fail: function (reason, retryLabel) {
        if (dead) return;
        dead = true; flush();
        body.innerHTML =
          '<div class="mg-failbox">' +
            '<div class="mg-failtitle glitch" data-text="ROUTE FAILED">ROUTE FAILED</div>' +
            '<div class="mg-failreason">' + esc(reason || "") + "</div>" +
            '<button class="btn-dos mg-retry">[ ' + esc(retryLabel || "RETRY SECTOR") + " ]</button>" +
          "</div>";
        beep(160, 220, 2);
        var btn = body.querySelector(".mg-retry");
        if (btn) btn.addEventListener("click", function () { if (restartFn) restartFn(); });
      },
      destroy: function () {
        dead = true;
        if (winTO) { clearTimeout(winTO); winTO = null; }
        flush();
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  /* ============================================================
     THE 10 MAPS — each defines the conduit meander (amplitude,
     full sine waves, phase), tunnel length, step speed and worm
     length. Later maps are longer, faster and windier.
     ============================================================ */
  var MAPS = [
    { name: "FIRST LINK",        category: "CALIBRATION",   len: 72,  amp: 8,  waves: 2,   phase: 0,    ms: 165, wormLen: 5 },
    { name: "OPEN CONDUIT",      category: "CALIBRATION",   len: 80,  amp: 11, waves: 2.5, phase: 1.1,  ms: 160, wormLen: 5 },
    { name: "LONG HAUL",         category: "MAINTENANCE",   len: 88,  amp: 12, waves: 3,   phase: 2.4,  ms: 156, wormLen: 5 },
    { name: "SWITCHBACK",        category: "MAINTENANCE",   len: 92,  amp: 14, waves: 3.5, phase: 0.7,  ms: 152, wormLen: 6 },
    { name: "DEEP CLIMB",        category: "SECURITY GRID", len: 96,  amp: 12, waves: 4,   phase: 3.6,  ms: 150, wormLen: 6 },
    { name: "NARROW MIND",       category: "SECURITY GRID", len: 96,  amp: 15, waves: 4.5, phase: 1.9,  ms: 146, wormLen: 6 },
    { name: "SERPENT RUN",       category: "BLACK ICE",     len: 100, amp: 16, waves: 5,   phase: 4.4,  ms: 142, wormLen: 7 },
    { name: "THE COIL",          category: "BLACK ICE",     len: 104, amp: 15, waves: 5.5, phase: 2.8,  ms: 138, wormLen: 7 },
    { name: "VERTIGO",           category: "CORE VAULT",    len: 108, amp: 17, waves: 6,   phase: 0.3,  ms: 134, wormLen: 8 },
    { name: "TERMINAL VELOCITY", category: "CORE VAULT",    len: 112, amp: 18, waves: 6.5, phase: 5.2,  ms: 130, wormLen: 8 }
  ];

  /* ============================================================
     WORM-ROUTE ENGINE
     ============================================================ */
  var CELL = 16;                 /* logical px per cell */
  var VIEW_W = 46, VIEW_H = 22;  /* visible cells -> 736 x 352 canvas */
  var W = 46;
  var CX = 23, R = 7;            /* circular staging room center + radius */

  function bootWormRoute(container, map, sectorNum, sectorTotal, onComplete) {
    var STEP_MS = map.ms;
    var SNAKE_LEN = map.wormLen;
    var TUNNEL_LEN = map.len;
    var ROUTE_A = map.amp, ROUTE_K = map.waves, ROUTE_PH = map.phase;

    /* world geometry — the room sits near the bottom, the conduit
       climbs TUNNEL_LEN rows to the exfil node near the top */
    var H = TUNNEL_LEN + 34;
    var CY = H - 22, CAM_Y0 = CY - 12;
    var START_Y = CY - R - 1;         /* first conduit row, mouth above the room */
    var END_Y = START_Y - TUNNEL_LEN; /* last conduit row */

    var shell = makeShell(container, map, sectorNum, sectorTotal);
    shell.setRestart(function () { bootWormRoute(container, map, sectorNum, sectorTotal, onComplete); });

    /* Cool route: the conduit climbs as a 5x5-cross-section tube whose
       centre line sweeps left/right in smooth switchback waves all the
       way to the exfil node at the top of the world. The centre moves at
       most 2 columns per row, so every 5x5 stamp overlaps its neighbours
       by at least one cell and there is always a continuous orthogonal
       path upward through a solid 5x5 opening. */
    function buildRoute() {
      var pts = [], x = CX, y = START_Y, t, targetX, d;
      for (var p = 0; p <= TUNNEL_LEN; p++) {
        pts.push({ x: x, y: y });
        t = p / TUNNEL_LEN;
        targetX = CX + ROUTE_A * Math.sin(Math.PI * 2 * ROUTE_K * t + ROUTE_PH);
        y -= 1;
        d = targetX - x;
        if (d >= 2) x += 2;
        else if (d <= -2) x -= 2;
        else if (d > 0.5) x += 1;
        else if (d < -0.5) x -= 1;
      }
      return pts;
    }
    var ROUTE = buildRoute();
    var END_X = ROUTE[ROUTE.length - 1].x;

    /* Each centre-line point stamps a full 5x5 open block (itself plus
       the two cells in every orthogonal and diagonal direction), so the
       tunnel cross-section is always exactly 5 cells wide and 5 cells
       tall at every step - the snake always has a 5x5 window of tunnel. */
    var openCells = {};
    (function () {
      var i, p, a, b, k;
      for (i = 0; i < ROUTE.length; i++) {
        p = ROUTE[i];
        for (a = -2; a <= 2; a++) {
          for (b = -2; b <= 2; b++) {
            openCells[(p.x + a) + "," + (p.y + b)] = true;
          }
        }
      }
      /* widen the room mouth so the worm can line up at the top of the
         circular staging room before it climbs */
      for (k = -2; k <= 2; k++) {
        openCells[(CX + k) + "," + (START_Y + 1)] = true;
      }
    })();

    function inRoom(x, y) {
      var dx = x - CX, dy = y - CY;
      return dx * dx + dy * dy <= R * R;
    }
    function isWall(x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H) return true;
      if (inRoom(x, y)) return false;
      return !openCells[x + "," + y];
    }

    /* --- DOM / canvas --- */
    var wrap = document.createElement("div");
    wrap.className = "mg-worm";
    wrap.innerHTML =
      '<div class="mg-worm-hud"><span class="mg-worm-label">WORM-ROUTE</span>' +
        '<span class="mg-worm-state">STAGING ROOM</span>' +
        '<span class="mg-worm-progress">0%</span></div>' +
      '<canvas class="mg-worm-canvas" width="' + (VIEW_W * CELL) + '" height="' + (VIEW_H * CELL) + '"></canvas>' +
      '<div class="mg-worm-hint">CLIMB THE 5-WIDE CONDUIT TO THE EXFIL NODE - ARROWS / WASD. DO NOT TOUCH THE WALLS.</div>';
    shell.body.appendChild(wrap);

    var canvas = wrap.querySelector(".mg-worm-canvas");
    var ctx = canvas.getContext("2d");
    var stateEl = wrap.querySelector(".mg-worm-state");
    var pctEl = wrap.querySelector(".mg-worm-progress");

    /* --- snake state --- */
    var snake = [], i;
    for (i = 0; i < SNAKE_LEN; i++) snake.push({ x: CX, y: CY + 3 - i });
    var dir = { x: 0, y: -1 };   /* worm climbs toward the room mouth */
    var queue = [];
    var over = false, entered = false, camX = 0, camY = CAM_Y0;

    function keyToDir(e) {
      var k = e.key;
      if (k === "ArrowUp" || k === "w" || k === "W") return { x: 0, y: -1 };
      if (k === "ArrowDown" || k === "s" || k === "S") return { x: 0, y: 1 };
      if (k === "ArrowLeft" || k === "a" || k === "A") return { x: -1, y: 0 };
      if (k === "ArrowRight" || k === "d" || k === "D") return { x: 1, y: 0 };
      return null;
    }
    function steer(d) {
      if (over) return;
      var last = queue.length ? queue[queue.length - 1] : dir;
      if (d.x === -last.x && d.y === -last.y) return;   /* no 180-degree turn */
      if (d.x === last.x && d.y === last.y) return;
      if (queue.length < 2) queue.push(d);
      beep(640, 18);
    }
    shell.key(function (e) {
      var d = keyToDir(e);
      if (d) { e.preventDefault(); steer(d); }
    });

    function crash() {
      over = true;
      shell.status("WALL CONTACT - WORM SPLATTERED", "bad");
      shell.fail("THE WORM CLIPPED THE CONDUIT WALL. ROUTE ABORTED.");
    }
    function win() {
      over = true;
      shell.status("EXFIL NODE REACHED - ROUTE COMPLETE", "ok");
      var lastMap = sectorNum >= sectorTotal;
      shell.win(onComplete, lastMap ? "NETWORK BREACHED" : "SECTOR CLEAR");
    }

    function step() {
      if (over) return;
      if (queue.length) dir = queue.shift();
      var head = snake[0];
      var nx = head.x + dir.x, ny = head.y + dir.y;
      if (isWall(nx, ny)) { crash(); return; }
      snake.unshift({ x: nx, y: ny });
      snake.pop();
      if (ny <= END_Y) { win(); return; }
      if (!entered && ny <= START_Y) {
        entered = true;
        beep(720, 70);
        shell.status("CONDUIT ENTERED - CLIMB FOR THE EXFIL NODE");
      }
    }

    function hud() {
      var head = snake[0];
      if (entered) {
        var pct = Math.max(0, Math.min(100, Math.round(((START_Y - head.y) / TUNNEL_LEN) * 100)));
        pctEl.textContent = pct + "%";
        stateEl.textContent = "CONDUIT " + pct + "%";
      } else {
        pctEl.textContent = "0%";
        stateEl.textContent = "STAGING ROOM";
      }
    }

    /* Crimson worm that heats to yellow as it nears the exfil node.
       Each segment colours by its own progress down the tunnel, so the
       head turns yellow first while the tail lags behind in red. */
    function segColor(seg, isHead) {
      var p = seg.y <= START_Y ? Math.min(1, (START_Y - seg.y) / TUNNEL_LEN) : 0;
      var r = 255;
      var g = Math.round(48 + (224 - 48) * p);
      var b = Math.round(48 + (28 - 48) * p);
      if (isHead) {
        g = Math.min(255, g + 26);
        b = Math.max(0, b - 8);
      }
      return "rgb(" + r + "," + g + "," + b + ")";
    }

    function draw() {
      var head = snake[0];
      var tx = Math.max(0, Math.min(W - VIEW_W, head.x - Math.floor(VIEW_W / 2)));
      var ty = Math.max(0, Math.min(H - VIEW_H, head.y - Math.floor(VIEW_H / 2)));
      camX += (tx - camX) * 0.16;
      camY += (ty - camY) * 0.16;
      var ox = Math.round(camX), oy = Math.round(camY);

      ctx.fillStyle = "#02130a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      var x, y;
      for (y = oy; y <= oy + VIEW_H; y++) {
        for (x = ox; x <= ox + VIEW_W; x++) {
          if (!isWall(x, y)) {
            if (inRoom(x, y)) {
              ctx.fillStyle = "#031b0c";
              ctx.fillRect((x - ox) * CELL, (y - oy) * CELL, CELL, CELL);
            }
            continue;
          }
          ctx.fillStyle = (y < START_Y) ? "#082913" : "#07230f";
          ctx.fillRect((x - ox) * CELL, (y - oy) * CELL, CELL, CELL);
        }
      }

      /* exfil goal pad at the top of the climb */
      for (y = END_Y - 2; y <= END_Y; y++) {
        for (x = END_X - 1; x <= END_X + 1; x++) {
          ctx.fillStyle = ((x + y) % 2 === 0) ? "rgba(255,176,0,.22)" : "rgba(255,176,0,.12)";
          ctx.fillRect((x - ox) * CELL, (y - oy) * CELL, CELL, CELL);
        }
      }
      ctx.fillStyle = "#ffb000";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("EXFIL", (END_X - 5 - ox + 0.5) * CELL, (END_Y - oy + 0.5) * CELL);

      /* worm body (tail -> head) */
      var s, seg;
      for (s = snake.length - 1; s >= 0; s--) {
        seg = snake[s];
        var sx = (seg.x - ox) * CELL, sy = (seg.y - oy) * CELL;
        if (sx < -CELL || sx > canvas.width || sy < -CELL || sy > canvas.height) continue;
        ctx.fillStyle = segColor(seg, s === 0);
        ctx.fillRect(sx + 1, sy + 1, CELL - 2, CELL - 2);
        if (s === 0) {
          ctx.fillStyle = "rgba(255,255,255,.30)";
          ctx.fillRect(sx + 4, sy + 4, CELL - 8, CELL - 8);
          ctx.fillStyle = "#02130a";
          var ex2 = sx + CELL / 2 - 1 + dir.x * (CELL / 2 - 3);
          var ey2 = sy + CELL / 2 - 1 + dir.y * (CELL / 2 - 3);
          ctx.fillRect(ex2, ey2, 3, 3);
        }
      }

      hud();
    }

    shell.every(STEP_MS, step);
    shell.raf(draw);
    shell.status("STAGING ROOM - CLIMB INTO THE 5-WIDE CONDUIT ABOVE");
    return shell;
  }

  /* ============================================================
     GAME FLOW — boot into a sector immediately on page load; a
     sector win advances to the next; clearing sector 10 shows
     the final screen. Progress persists in localStorage so the
     run resumes where the player left off.
     ============================================================ */
  var SESSION_SIZE = 3;
  var SAVE_KEY = "wormroute.session";
  var container = document.getElementById("game");
  var current = null;
  var sessionMaps = [];
  var sessionPos = 0;

  /* Random sample of SESSION_SIZE distinct map indices (Fisher-Yates). */
  function pickSession() {
    var idx = [], i;
    for (i = 0; i < MAPS.length; i++) idx.push(i);
    for (i = MAPS.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    return idx.slice(0, SESSION_SIZE);
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && Array.isArray(s.list) && s.list.length === SESSION_SIZE &&
            typeof s.pos === "number") {
          var ok = true, seen = {}, m, k;
          for (k = 0; k < s.list.length; k++) {
            m = s.list[k];
            if (typeof m !== "number" || m < 0 || m >= MAPS.length || seen[m]) { ok = false; break; }
            seen[m] = true;
          }
          if (ok && s.pos >= 0 && s.pos < SESSION_SIZE) {
            sessionMaps = s.list;
            sessionPos = s.pos;
            return;
          }
        }
      }
    } catch (e) { /* ignore */ }
    sessionMaps = pickSession();
    sessionPos = 0;
  }

  function saveSession() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ list: sessionMaps, pos: sessionPos }));
    } catch (e) { /* ignore */ }
  }

  function start() {
    if (current) current.destroy();
    saveSession();
    var map = MAPS[sessionMaps[sessionPos]];
    current = bootWormRoute(container, map, sessionPos + 1, SESSION_SIZE, function () {
      sessionPos++;
      if (sessionPos >= sessionMaps.length) showVictory();
      else start();
    });
  }

  function showVictory() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    if (current) { current.destroy(); current = null; }
    container.innerHTML =
      '<div class="mg-root scan-grid">' +
        '<div class="mg-head"><span class="mg-cat">SECTOR ' + pad2(SESSION_SIZE) + "/" + SESSION_SIZE + ' // CORE VAULT</span>' +
          '<span class="mg-name">SESSION COMPLETE</span></div>' +
        '<div class="mg-body">' +
          '<div class="mg-win glitch green" data-text="NETWORK BREACHED">NETWORK BREACHED</div>' +
          '<div class="mg-final-note">' + SESSION_SIZE + ' OF ' + MAPS.length + ' ROUTES CLEAR — THIS SESSION IS DONE</div>' +
          '<div style="text-align:center"><button class="btn-dos mg-retry" id="btn-again">[ RUN AGAIN ]</button></div>' +
        "</div>" +
        '<div class="mg-foot"><span class="mg-status">STANDBY</span>' +
          '<span class="mg-hint">WORMROUTE SESSION COMPLETE</span></div>' +
      "</div>";
    document.getElementById("btn-again").addEventListener("click", function () {
      sessionMaps = pickSession();
      sessionPos = 0;
      start();
    });
  }

  /* Boot immediately when the page opens — resume the saved session,
     or start a fresh random 3-route session. */
  loadSession();
  start();
})();
