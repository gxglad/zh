/* ============================================================
   我的歌单 · MY PLAYLIST  (app.js)
   ------------------------------------------------------------
   · 入场黑胶：自动开始旋转，点击即可进入
   · 播放：本地整首音频，默认从每首的高潮段落切入
   · 真实演唱，无视频
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     0. 曲目数据
     ============================================================ */
  const tracks = $$('.track');
  const SONGS = tracks.map((t) => {
    const sec = t.closest('.artist');
    return {
      file:   t.dataset.file,
      start:  parseFloat(t.dataset.start) || 0,
      title:  t.dataset.title,
      artist: t.dataset.artist,
      color:  t.dataset.color,
      dur:    parseFloat(t.dataset.dur) || 0,
      el:     t,
      btn:    $('.play', t),
      prog:   $('.track__prog i', t),
      key:    sec ? sec.dataset.key : 'hero'
    };
  });
  const byFile = {};
  SONGS.forEach((s) => { byFile[s.file] = s; });

  /* ============================================================
     1. 音频播放核心
     ============================================================ */
  const audio = $('#player');

  const dockName   = $('#dockName');
  const dockArtist = $('#dockArtist');
  const dockGlow   = $('#dockGlow');
  const dockCur    = $('#dockCur');
  const dockDur    = $('#dockDur');
  const dockFill   = $('#dockFill');
  const dockSeek   = $('#dockSeek');
  const dockBadge  = $('#dockBadge');
  const dockDisc   = $('#dockDisc');
  const dockKnob   = $('#dockKnob');

  /* 底部条柱（先建，stopAll / frame 会用到） */
  const BARS = 42;
  const dockBars = $('#dockBars');
  const barsArr = [];
  for (let i = 0; i < BARS; i++) {
    const b = document.createElement('i');
    dockBars.appendChild(b);
    barsArr.push(b);
  }
  const barVals = new Array(BARS).fill(0.06);
  const barKind = barsArr.map(() => { const r = Math.random(); return r < 0.24 ? 0 : r < 0.55 ? 1 : 2; });

  let current = null;
  let fromClimax = true;
  let pendingSeek = null;   // 等 metadata 就绪后再跳转（src 刚设时 currentTime 无效）

  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  /** 跳转到目标秒数；若元数据还没好，就记下来等 loadedmetadata */
  function seekTo(sec) {
    if (audio.readyState >= 1) {
      try { audio.currentTime = sec; } catch (e) { pendingSeek = sec; }
    } else {
      pendingSeek = sec;
    }
  }

  function markActive(song) {
    tracks.forEach((t) => t.classList.toggle('is-active', !!song && t === song.el));
    $$('.oc').forEach((o) => o.classList.toggle('is-on', !!song && o.dataset.file === song.file));
    if (song) {
      dockName.textContent = song.title;
      dockArtist.textContent = song.artist + ' · 我的最爱';
      dockGlow.style.background = 'linear-gradient(90deg, ' + song.color + ', #f2efe9)';
      dockGlow.style.boxShadow = '0 0 20px ' + song.color;
      dockDisc.querySelector('i').style.background = song.color;
      dockBadge.textContent = fromClimax ? '高潮' : '从头';
    }
  }

  function playSong(song, climax) {
    if (!song) return;
    const isSame = current === song;

    if (climax !== undefined) fromClimax = climax;

    if (!isSame) {
      current = song;
      /* 优先用预加载好的 Blob 地址：本地内存读取，不卡不断 */
      audio.src = song.blobUrl || song.file;
      /* 必须先 load()，否则 metadata 不会开始加载 */
      audio.load();
      pendingSeek = fromClimax ? song.start : 0;
    } else {
      seekTo(fromClimax ? song.start : 0);
    }

    dockBadge.textContent = fromClimax ? '高潮' : '从头';
    markActive(song);
    applyTheme(song.key);
    dockDur.textContent = fmt(song.dur);

    const p = audio.play();
    if (p && p.catch) p.catch(() => {});

    setTimeout(() => {
      song.el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }, 260);
  }

  function togglePlay() {
    if (!current) { playSong(SONGS[0], true); return; }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function stopAll() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    current = null;
    pendingSeek = null;
    fromClimax = true;
    document.body.classList.remove('is-playing');
    markActive(null);
    tracks.forEach((t) => t.classList.remove('is-active'));
    dockName.textContent = '还没有开始播放';
    dockArtist.textContent = '点任意一首，从高潮直接听起';
    dockGlow.style.width = '0%';
    dockCur.textContent = '0:00';
    dockDur.textContent = '0:00';
    dockFill.style.width = '0%';
    dockKnob.style.left = '0%';
    dockBadge.textContent = '高潮';
    barsArr.forEach((b) => { b.style.transform = 'scaleY(.06)'; });
    $$('.track__wave i').forEach((b) => { b.style.height = ((b._base || 0.3) * 100).toFixed(1) + '%'; });
    $$('.track__prog i').forEach((b) => { b.style.width = '0%'; });
  }

  audio.addEventListener('play',  () => document.body.classList.add('is-playing'));
  audio.addEventListener('pause', () => document.body.classList.remove('is-playing'));
  audio.addEventListener('ended', () => {
    const i = SONGS.indexOf(current);
    playSong(SONGS[(i + 1) % SONGS.length], true);
  });
  audio.addEventListener('loadedmetadata', () => {
    const d = isFinite(audio.duration) ? audio.duration : (current ? current.dur : 0);
    if (d) dockDur.textContent = fmt(d);
    /* 元数据就绪 → 执行挂起的跳转（这时 currentTime 才生效） */
    if (pendingSeek !== null) {
      const target = clamp(pendingSeek, 0, Math.max(0, (audio.duration || pendingSeek) - 0.5));
      pendingSeek = null;
      try { audio.currentTime = target; } catch (e) {}
    }
    /* seek 完成后再确保处于播放状态 */
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
  });
  audio.addEventListener('error', () => {
    if (!current) return;
    dockArtist.textContent = '这首歌加载失败了，试试下一首';
  });
  audio.addEventListener('timeupdate', () => {
    if (!current) return;
    const d = audio.duration || current.dur || 1;
    const frac = clamp(audio.currentTime / d, 0, 1);
    const pct = (frac * 100).toFixed(2) + '%';
    dockFill.style.width = pct;
    dockKnob.style.left = pct;
    dockCur.textContent = fmt(audio.currentTime);
    if (current.prog) current.prog.style.width = pct;
  });

  dockSeek.addEventListener('click', (e) => {
    if (!current || !audio.duration) return;
    const r = dockSeek.getBoundingClientRect();
    audio.currentTime = clamp((e.clientX - r.left) / r.width, 0, 1) * audio.duration;
  });

  $('#dockMode').addEventListener('click', function () {
    if (!current) { playSong(SONGS[0], true); return; }
    fromClimax = !fromClimax;
    seekTo(fromClimax ? current.start : 0);
    dockBadge.textContent = fromClimax ? '高潮' : '从头';
    this.textContent = fromClimax ? '高潮' : '从头';
    if (audio.paused) audio.play().catch(() => {});
  });

  $('#dockToggle').addEventListener('click', togglePlay);
  $('#dockPrev').addEventListener('click', () => {
    const i = SONGS.indexOf(current);
    playSong(SONGS[(i <= 0 ? SONGS.length : i) - 1], true);
  });
  $('#dockNext').addEventListener('click', () => {
    const i = SONGS.indexOf(current);
    playSong(SONGS[(i + 1) % SONGS.length], true);
  });

  /* ============================================================
     2. 载入页：黑胶转动 + 预加载
     策略：只等「第一首」完整下载完就进站（约 5MB，快），
     其余四首在后台按顺序继续缓存。
     这样既进站快，点开歌又不会卡；而且任何一首失败都不影响进门。
     ============================================================ */
  const intro     = $('#intro');
  const ripple    = $('#ripple');
  const introBar  = $('#introBar');
  const introPct  = $('#introPct');
  const introCap  = $('#introCaption');

  [0, 1, 2].forEach(() => ripple.appendChild(document.createElement('span')));

  let phase = 'loading';
  const preloadDone = [];   // 已缓存完成的曲目（供调试查看）

  function enter() {
    if (phase === 'out') return;
    phase = 'out';
    intro.classList.add('is-done');
    document.body.classList.remove('is-loading');
    requestAnimationFrame(() => {
      document.body.classList.add('is-ready');
      window.scrollTo(0, 0);
      onScroll();
    });
    setTimeout(() => { intro.style.display = 'none'; }, 1200);
    /* 进站后不自动播放，等用户主动点 */
  }

  /* ---- 单首下载：拉全量 → 存 Blob URL ---- */
  function preloadOne(song) {
    return fetch(song.file, { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (!res.body || !res.body.getReader) {
          return res.blob().then((b) => { song.blobUrl = URL.createObjectURL(b); });
        }
        const reader = res.body.getReader();
        const chunks = [];
        return (function pump() {
          return reader.read().then((r) => {
            if (r.done) {
              song.blobUrl = URL.createObjectURL(new Blob(chunks, { type: 'audio/mpeg' }));
              return;
            }
            chunks.push(r.value);
            if (song === SONGS[0]) firstBytes += r.value.length;   // 只统计第一首用于进度
            return pump();
          });
        })();
      })
      .then(() => { preloadDone.push(song.title); })
      .catch(() => null);   // 失败不阻断：回退成网络流式播放
  }

  /* ---- 第一首：决定什么时候可以进站 ---- */
  const FIRST_MIN_MS = 1600;   // 最短展示时间，别一闪而过
  const FIRST_MAX_MS = 9000;   // 第一首太久没下完也放行，不让人干等
  const EST_FIRST = 5 * 1024 * 1024;   // 第一首约 5MB，用于估算进度
  const t0 = performance.now();
  let firstBytes = 0;
  let firstReady = false;
  let shown = 0;          // 当前显示的进度百分比
  let finished = false;   // 是否已判定可进站

  const firstLoad = preloadOne(SONGS[0]).then(() => { firstReady = true; });

  /* 其余四首在后台顺序缓存，不参与进度、不拦进门 */
  firstLoad.then(() => {
    SONGS.slice(1).reduce((chain, s) => chain.then(() => preloadOne(s)), Promise.resolve());
  });

  /* ---- 进度条：时间主轴匀速推进，用第一首的下载量做闸门 ---- */
  const DURATION = 2200;   // 0 → 100% 的基准时长
  const GATE = 92;         // 第一首没下完时，进度压在这个值以内

  (function loadLoop(now) {
    if (phase === 'out') return;
    requestAnimationFrame(loadLoop);

    const elapsed = now - t0;

    /* 时间基准：绝对匀速，不受网络分段影响，所以绝不会一断一断 */
    let target = (elapsed / DURATION) * 100;

    /* 闸门：第一首没好就压在 GATE 以内 */
    if (!firstReady && elapsed < FIRST_MAX_MS) target = Math.min(target, GATE);

    /* 用真实下载量微调：下载飞快时可以稍微提前，但不影响整体匀速 */
    if (!firstReady && firstBytes > 0) {
      const est = (firstBytes / EST_FIRST) * GATE;
      target = Math.max(target * 0.55, Math.min(est, GATE));
    }

    shown = clamp(target, 0, 100);
    introBar.style.width = shown.toFixed(2) + '%';
    introPct.textContent = Math.round(shown) + '%';

    /* 可以进站的条件：第一首已就绪（或超时兜底）＋ 最短展示时间已过 */
    const canEnter = (firstReady || elapsed >= FIRST_MAX_MS) && elapsed >= FIRST_MIN_MS;

    if (canEnter && !finished) {
      finished = true;
      introBar.style.width = '100%';
      introPct.textContent = '100%';
      intro.classList.add('is-loaded');
      introCap.textContent = firstReady ? '载入完成' : '先听着，后面继续载入';
      setTimeout(enter, 320);
    }
  })(t0);

  /* ============================================================
     3. 曲目卡按钮
     ============================================================ */
  SONGS.forEach((song) => {
    song.btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (current === song) togglePlay();
      else playSong(song, true);
    });
    song.el.addEventListener('click', (e) => {
      if (e.target.closest('.play')) return;
      if (current !== song) playSong(song, true);
    });
  });

  /* ============================================================
     4. 尾声网格
     ============================================================ */
  const grid = $('#outroGrid');
  SONGS.forEach((song, i) => {
    const el = document.createElement('div');
    el.className = 'oc';
    el.dataset.file = song.file;
    el.style.setProperty('--c1', song.color);
    el.innerHTML =
      '<div class="oc__g"></div>' +
      '<div class="oc__no">' + String(i + 1).padStart(2, '0') + ' / 05</div>' +
      '<div class="oc__t">' + song.title + '</div>' +
      '<div class="oc__a">' + song.artist + '</div>' +
      '<div class="oc__play"><svg viewBox="0 0 24 24"><path d="M8 5.2v13.6L19 12z"/></svg></div>';
    el.addEventListener('click', () => playSong(song, true));
    grid.appendChild(el);
  });

  $('#playAllBtn').addEventListener('click', () => playSong(SONGS[0], true));
  $('#stopAllBtn').addEventListener('click', stopAll);
  $('#startBtn').addEventListener('click', () => {
    $('#sec-pharaoh').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (!current) setTimeout(() => playSong(SONGS[0], true), 700);
  });

  /* ============================================================
     5. 主题色
     ============================================================ */
  const THEMES = {
    hero:       ['#ff3b2f', '#ff8a3d', '#5a0d12'],
    pharaoh:    ['#ff3b2f', '#ff8a3d', '#5a0d12'],
    huichundan: ['#3ddc84', '#a8ff78', '#0b3d24'],
    meni:       ['#f0a4c8', '#9ec5ff', '#2a2140'],
    cynic:      ['#8f9bb3', '#c9d4e6', '#141821'],
    caodong:    ['#6c7a89', '#e0e6ec', '#101418'],
    outro:      ['#c9d4e6', '#f2efe9', '#2a2140']
  };
  function hexToRgb(h) {
    const v = String(h).replace('#', '');
    if (v.length !== 6) return [255, 59, 47];
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }
  function mixHex(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')';
  }
  let curTheme = 'hero', themeAnim = null;
  function applyTheme(key) {
    if (key === curTheme || !THEMES[key]) return;
    const from = THEMES[curTheme], to = THEMES[key];
    const start = performance.now(), dur = 850;
    if (themeAnim) cancelAnimationFrame(themeAnim);
    const root = document.documentElement.style;
    (function run(now) {
      const t = clamp((now - start) / dur, 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      root.setProperty('--a1', mixHex(from[0], to[0], e));
      root.setProperty('--a2', mixHex(from[1], to[1], e));
      root.setProperty('--a3', mixHex(from[2], to[2], e));
      if (t < 1) themeAnim = requestAnimationFrame(run);
      else { root.setProperty('--a1', to[0]); root.setProperty('--a2', to[1]); root.setProperty('--a3', to[2]); }
    })(start);
    curTheme = key;
  }

  /* ============================================================
     6. 侧栏 / 揭示 / 视差
     ============================================================ */
  const rail = $('#rail');
  const sections = $$('section[data-label]');
  sections.forEach((sec, i) => {
    const b = document.createElement('button');
    b.className = 'rail__item' + (i === 0 ? ' is-on' : '');
    b.innerHTML = '<span>' + sec.dataset.label + '</span><i></i>';
    b.addEventListener('click', () => sec.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
    rail.appendChild(b);
  });
  const railItems = $$('.rail__item', rail);

  const io = new IntersectionObserver((es) => {
    es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((el) => io.observe(el));

  const secIO = new IntersectionObserver((es) => {
    es.forEach((en) => {
      const idx = sections.indexOf(en.target);
      if (idx < 0 || !en.isIntersecting) return;
      railItems.forEach((r, i) => r.classList.toggle('is-on', i === idx));
      if (en.target.dataset.key) applyTheme(en.target.dataset.key);
    });
  }, { threshold: 0.42 });
  sections.forEach((s) => secIO.observe(s));

  const artistIO = new IntersectionObserver((es) => {
    es.forEach((en) => en.target.classList.toggle('is-live', en.isIntersecting));
  }, { threshold: 0.25 });
  $$('.artist').forEach((s) => artistIO.observe(s));

  $$('[data-split]').forEach((el) => {
    const txt = el.textContent.trim();
    el.innerHTML = txt.split('').map((c) => '<span class="ch">' + c + '</span>').join('');
    $$('.ch', el).forEach((c, i) => {
      c.style.opacity = '0';
      c.style.transform = 'translateY(40px) rotate(4deg)';
      c.style.transition = 'opacity .8s var(--ease) ' + (i * 0.05) + 's, transform .95s var(--ease) ' + (i * 0.05) + 's';
    });
    const o = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        $$('.ch', el).forEach((c) => { c.style.opacity = '1'; c.style.transform = 'none'; });
        o.disconnect();
      });
    }, { threshold: 0.3 });
    o.observe(el);
  });

  const parallaxEls = $$('[data-parallax]');
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const vh = window.innerHeight;
      parallaxEls.forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const sp = parseFloat(el.dataset.parallax) || 0.15;
        el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - vh / 2) * sp).toFixed(1) + 'px,0)';
      });
      if (window.scrollY > 90) $('#scrollHint').classList.add('is-off');
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ============================================================
     7. 可视化 + UI 帧循环
     ============================================================ */
  const viz = $('#viz');
  const vctx = viz.getContext('2d');
  let vw = 0, vh = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

  function sizeViz() {
    vw = viz.clientWidth; vh = viz.clientHeight;
    viz.width = Math.floor(vw * dpr);
    viz.height = Math.floor(vh * dpr);
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeViz();
  window.addEventListener('resize', sizeViz);

  function themeRgb() {
    const h = getComputedStyle(document.documentElement).getPropertyValue('--a1').trim();
    if (h.charAt(0) === '#') return hexToRgb(h);
    const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(h);
    return m ? [+m[1], +m[2], +m[3]] : [255, 59, 47];
  }

  $$('.track__wave').forEach((w) => {
    for (let i = 0; i < 34; i++) {
      const b = document.createElement('i');
      // 静止时也保持一条有起伏的波形，不是一条平线
      const base = 0.22 + 0.5 * Math.abs(Math.sin(i * 0.55)) * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7)));
      b.style.height = (base * 100).toFixed(1) + '%';
      b._ph = Math.random() * Math.PI * 2;
      b._amp = 0.25 + Math.random() * 0.75;
      b._base = base;
      w.appendChild(b);
    }
  });

  const N = 96;
  const wave = new Array(N).fill(0);

  function drawViz(now) {
    requestAnimationFrame(drawViz);
    if (!vctx) return;
    vctx.clearRect(0, 0, vw, vh);
    const [r, g, b] = themeRgb();
    const playing = document.body.classList.contains('is-playing');

    for (let i = 0; i < N; i++) {
      const target = playing
        ? 0.12 + 0.62 * (1 - i / N) * (0.55 + 0.45 * Math.abs(Math.sin(now / 420 + i * 0.19)))
        : 0.05 + 0.035 * Math.sin(now / 950 + i * 0.32);
      wave[i] = lerp(wave[i], target, playing ? 0.3 : 0.06);
    }

    const bw = vw / N;
    vctx.beginPath();
    vctx.moveTo(0, vh);
    for (let i = 0; i < N; i++) vctx.lineTo(i * bw, vh - wave[i] * vh * 0.92);
    vctx.lineTo(vw, vh);
    vctx.closePath();
    const grad = vctx.createLinearGradient(0, vh, 0, vh * 0.25);
    grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    grad.addColorStop(0.55, 'rgba(' + r + ',' + g + ',' + b + ',0.32)');
    grad.addColorStop(1, 'rgba(' + Math.min(255, r + 60) + ',' + g + ',' + b + ',0.78)');
    vctx.fillStyle = grad;
    vctx.fill();

    vctx.beginPath();
    for (let i = 0; i < N; i++) {
      const x = i * bw, y = vh - wave[i] * vh * 0.92;
      if (i === 0) vctx.moveTo(x, y); else vctx.lineTo(x, y);
    }
    vctx.strokeStyle = 'rgba(' + Math.min(255, r + 90) + ',' + (g + 30) + ',' + (b + 30) + ',0.85)';
    vctx.lineWidth = 1.6;
    vctx.stroke();
  }
  requestAnimationFrame(drawViz);

  function frame(now) {
    requestAnimationFrame(frame);
    const playing = document.body.classList.contains('is-playing');
    for (let i = 0; i < BARS; i++) {
      const v = playing
        ? 0.1 + (1 - i / BARS) * (0.5 + 0.5 * Math.sin(now / (barKind[i] === 0 ? 260 : barKind[i] === 1 ? 340 : 200) + i * 0.55)) * (barKind[i] === 0 ? 1 : barKind[i] === 1 ? 0.72 : 0.5)
        : 0.06 + 0.05 * Math.sin(now / 1100 + i * 0.4);
      barVals[i] = lerp(barVals[i], clamp(v, 0.05, 1), playing ? 0.3 : 0.06);
      barsArr[i].style.transform = 'scaleY(' + barVals[i].toFixed(3) + ')';
    }
    if (current) {
      const w = current.el && $('.track__wave', current.el);
      if (w) {
        $$('i', w).forEach((bar, i) => {
          const v = playing
            ? (0.16 + (1 - i / 34) * (0.5 + 0.5 * Math.sin(now / 300 + bar._ph))) * bar._amp
            /* 静止：以自身基准线轻微呼吸，保持波形感 */
            : bar._base * (0.85 + 0.15 * Math.sin(now / 1100 + bar._ph));
          bar.style.height = clamp(v * 100, 8, 100).toFixed(1) + '%';
        });
      }
    }
  }
  requestAnimationFrame(frame);

  /* ============================================================
     8. 键盘
     ============================================================ */
  window.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (phase !== 'out') {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); enter(); }
      return;
    }
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.key >= '1' && e.key <= '5') playSong(SONGS[+e.key - 1], true);
    else if (e.key === 'Escape') stopAll();
    else if (e.key === 'ArrowRight') $('#dockNext').click();
    else if (e.key === 'ArrowLeft') $('#dockPrev').click();
  });

  /* ============================================================
     9. 收尾
     ============================================================ */
  document.documentElement.style.setProperty('--a1', '#ff3b2f');
  document.documentElement.style.setProperty('--a2', '#ff8a3d');
  document.documentElement.style.setProperty('--a3', '#5a0d12');

  window.addEventListener('load', () => setTimeout(() => { sizeViz(); onScroll(); }, 80));
  setTimeout(() => { sizeViz(); onScroll(); }, 500);

  console.log('%c我的歌单 · MY PLAYLIST', 'color:#ff3b2f;font-size:15px;font-weight:700');
  console.log('%c空格播放/暂停 · 数字键 1-5 切歌 · ← → 上一首/下一首 · Esc 停止', 'color:#a7a29a;font-size:11px');
})();
