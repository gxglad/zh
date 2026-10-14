/* ============================================================
   源码页 · 逻辑
   读取并展示本站四个源文件，带行号与轻量语法高亮
   ============================================================ */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  const FILES = [
    {
      file: 'index.html', label: 'index.html', lang: 'html',
      desc: '<b>index.html</b> —— 页面骨架与全部内容：黑胶入场、五位音乐人、五张曲目卡、底部播放器。曲目的高潮时间点写在每张卡的 <code>data-start</code> 上。'
    },
    {
      file: 'styles.css', label: 'styles.css', lang: 'css',
      desc: '<b>styles.css</b> —— 全部视觉：暗色胶片底、黑胶与唱针、光晕、颗粒、五套主题色（切歌时整站配色跟着渐变）。'
    },
    {
      file: 'app.js', label: 'app.js', lang: 'js',
      desc: '<b>app.js</b> —— 全部交互：黑胶自动旋转、点击进站、播放控制、从高潮段起播、进度条拖动、滚动叙事与波形动画。'
    },
    {
      file: 'engine.js', label: 'engine.js', lang: 'js',
      desc: '<b>engine.js</b>（可选）—— 纯 Web Audio 实时合成引擎。本站实际播放的是 <code>audio/</code> 里的真实音源；这个文件保留了「不依赖任何音频文件也能现场合成五首曲子」的方案，作为一种备份玩法。'
    }
  ];

  const tabsEl   = $('#codeTabs');
  const noteEl   = $('#codeNote');
  const metaEl   = $('#codeMeta');
  const fileEl   = $('#codeFile');
  const statEl   = $('#codeStat');
  const viewEl   = $('#codeView');
  const bodyEl   = $('#codeBody');
  const loadingEl= $('#codeLoading');
  const gutterEl = $('#codeGutter');
  const codeEl   = $('#codeCode');
  const rawBtn   = $('#btnRaw');

  let current = FILES[0];
  const cache = {};

  /* ---------- 语法高亮（保守实现：先转义，再按 token 上色） ---------- */
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function highlight(src, lang) {
    let out = esc(src);

    if (lang === 'html') {
      // 注释
      out = out.replace(/&lt;!--[\s\S]*?--&gt;/g, (m) => '\u0001C' + m + '\u0001');
      // 标签
      out = out.replace(/(&lt;\/?)([a-zA-Z][\w-]*)/g, '$1\u0001T$2\u0001');
      // 属性名
      out = out.replace(/([\w-]+)(=)("[^"]*")/g, '\u0001A$1\u0001$2\u0001S$3\u0001');
      out = out.replace(/\u0001C([\s\S]*?)\u0001/g, '<span class="tk-com">$1</span>');
      out = out.replace(/\u0001T([\w-]*)\u0001/g, '<span class="tk-tag">$1</span>');
      out = out.replace(/\u0001A([\w-]*)\u0001/g, '<span class="tk-attr">$1</span>');
      out = out.replace(/\u0001S([\s\S]*?)\u0001/g, '<span class="tk-str">$1</span>');
      return out;
    }

    if (lang === 'css') {
      out = out.replace(/\/\*[\s\S]*?\*\//g, (m) => '<span class="tk-com">' + m + '</span>');
      out = out.replace(/^(\s*)([.#@][\w-]+|[a-zA-Z][\w-]*(?=\s*\{))/gm,
        (m, sp, sel) => sp + '<span class="tk-tag">' + sel + '</span>');
      out = out.replace(/([\w-]+)(\s*:)/g, '<span class="tk-prop">$1</span>$2');
      // 颜色/数值
      out = out.replace(/(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|s|ms|vw|vh|vmin|%|em|rem|deg|fr)?\b)/g,
        '<span class="tk-num">$1</span>');
      return out;
    }

    // js
    out = out.replace(/\/\*[\s\S]*?\*\//g, (m) => '<span class="tk-com">' + m + '</span>');
    out = out.replace(/(^|[^:])\/\/[^\n]*/g, (m, a) => a + '<span class="tk-com">' + m.slice(a.length) + '</span>');
    out = out.replace(/(`[^`]*`|'[^'\n]*'|"[^"\n]*")/g, '<span class="tk-str">$1</span>');
    out = out.replace(/\b(const|let|var|function|return|if|else|for|while|new|class|get|set|try|catch|throw|typeof|instanceof|in|of|this|async|await|break|continue|switch|case|default|null|undefined|true|false)\b/g,
      '<span class="tk-key">$1</span>');
    out = out.replace(/\b([A-Za-z_$][\w$]*)(?=\s*\()/g, '<span class="tk-fn">$1</span>');
    out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tk-num">$1</span>');
    return out;
  }

  /* ---------- 行号 ---------- */
  function fillGutter(lineCount) {
    let g = '';
    for (let i = 1; i <= lineCount; i++) g += i + '\n';
    gutterEl.textContent = g;
  }

  /* ---------- 载入某个文件 ---------- */
  async function load(entry) {
    current = entry;
    FILES.forEach((f) => f.el && f.el.classList.toggle('is-on', f === entry));

    fileEl.textContent = entry.file;
    rawBtn.href = entry.file;
    noteEl.innerHTML = entry.desc;

    if (cache[entry.file]) { render(cache[entry.file]); return; }

    loadingEl.hidden = false;
    bodyEl.hidden = true;
    loadingEl.textContent = '正在读取 ' + entry.file + ' …';

    try {
      const res = await fetch(entry.file + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      cache[entry.file] = text;
      render(text);
    } catch (e) {
      loadingEl.textContent = '读取失败：' + e.message + '（请确认 ' + entry.file + ' 与 code.html 在同一目录）';
    }
  }

  function render(text) {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    // 末尾空行不计数
    const n = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;

    codeEl.innerHTML = highlight(text, current.lang);
    fillGutter(n);

    statEl.textContent = n + ' 行 · ' + (new Blob([text]).size / 1024).toFixed(1) + ' KB';
    loadingEl.hidden = true;
    bodyEl.hidden = false;
    viewEl.scrollTop = 0;
  }

  /* ---------- 顶部统计 ---------- */
  async function buildMeta() {
    let totalLines = 0, totalBytes = 0, ok = 0;
    for (const f of FILES) {
      try {
        if (!cache[f.file]) {
          const r = await fetch(f.file + '?t=' + Date.now(), { cache: 'no-store' });
          if (r.ok) cache[f.file] = await r.text();
        }
        const t = cache[f.file];
        if (t) {
          totalLines += t.replace(/\r\n/g, '\n').split('\n').length - 1;
          totalBytes += new Blob([t]).size;
          ok++;
        }
      } catch (e) {}
    }
    const kb = (totalBytes / 1024).toFixed(1);
    metaEl.innerHTML =
      '<div><b>文件</b><span>' + ok + '</span></div>' +
      '<div><b>总行数</b><span>' + totalLines.toLocaleString() + '</span></div>' +
      '<div><b>总体积</b><span>' + kb + ' KB</span></div>' +
      '<div><b>依赖</b><span>0</span></div>';
  }

  /* ---------- Tab ---------- */
  FILES.forEach((f) => {
    const b = document.createElement('button');
    b.className = 'code-tab';
    b.type = 'button';
    b.innerHTML = f.label;
    b.addEventListener('click', () => load(f));
    tabsEl.appendChild(b);
    f.el = b;
  });

  /* ---------- 工具栏 ---------- */
  let wrap = true;
  viewEl.classList.add('wrap');
  $('#btnWrap').addEventListener('click', function () {
    wrap = !wrap;
    viewEl.classList.toggle('wrap', wrap);
    this.textContent = '换行：' + (wrap ? '开' : '关');
  });

  $('#btnCopy').addEventListener('click', async function () {
    const t = cache[current.file];
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
    }
    this.textContent = '已复制 ✓';
    this.classList.add('is-ok');
    setTimeout(() => { this.textContent = '复制全文'; this.classList.remove('is-ok'); }, 1600);
  });

  /* ---------- 启动 ---------- */
  buildMeta();
  load(FILES[0]);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const i = FILES.indexOf(current);
      const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + FILES.length) % FILES.length;
      load(FILES[n]);
    }
  });

  console.log('%c源码 · 我的歌单', 'color:#ff3b2f;font-size:14px;font-weight:700');
})();
