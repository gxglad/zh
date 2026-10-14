/* ============================================================
 *  我的歌单 · MY PLAYLIST  —  audio.js
 *  ------------------------------------------------------------
 *  纯 Web Audio API 实时合成引擎（本站在线播放未使用）。
 *
 *  说明：站点最终采用的是本地真实音源播放（见 audio/ 目录），
 *  这个模块保留下来，作为「在浏览器里现场合成五首曲子」的可选方案。
 *  如果你把 index.html 里的 <audio> 换成这个引擎，也能出声，
 *  而且不需要任何外部文件、不涉及版权音源 —— 只是没有真实演唱。
 *
 *  每首曲子按各自的调式 / 速度 / 配器 / 情绪独立编写：
 *    法老    A 小调 88 BPM   暗色陷阱鼓组 + 808 次低音 + 稀疏钢琴
 *    回春丹  D 大调 132 BPM  明亮刷弦 + 失真扫弦 + 上口主音
 *    门尼    F 大调 76 BPM   梦泡合成器 + 电钢 + 弦垫
 *    犬儒    E 小调 148 BPM  冷调失真强力和弦 + 推进鼓组
 *    草东    A 小调 112 BPM  克制留白：延迟吉他 + 桶鼓 + 极简贝斯
 * ============================================================ */

const Engine = (function () {
  'use strict';

  /* ---------- 音名 → MIDI ---------- */
  const PC = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6,
               G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 };

  function midiOf(name) {
    const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
    if (!m) return 60;
    return PC[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  }
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  const QUAL = {
    maj:   [0, 4, 7],
    min:   [0, 3, 7],
    maj7:  [0, 4, 7, 11],
    min7:  [0, 3, 7, 10],
    dom7:  [0, 4, 7, 10],
    min9:  [0, 3, 7, 10, 14],
    add9:  [0, 4, 7, 14],
    maj9:  [0, 4, 7, 11, 14],
    sus4:  [0, 5, 7],
    five:  [0, 7],
    dim:   [0, 3, 6],
    min6:  [0, 3, 7, 9]
  };

  /** 'Fmaj7' + 八度 → midi 数组 */
  function voice(name, oct) {
    const m = /^([A-G][#b]?)(.*)$/.exec(name);
    const pc = PC[m[1]];
    const iv = QUAL[m[2]] || QUAL.maj;
    return iv.map((i) => 12 * (oct + 1) + pc + i);
  }
  function rootOf(name, oct) {
    const m = /^([A-G][#b]?)/.exec(name);
    return 12 * (oct + 1) + PC[m[1]];
  }

  /* ============================================================
     五首作品的乐谱数据
     ============================================================ */
  const SONGS = {

    /* ── 01 法老《亲密爱人》── */
    pharaoh: {
      id: 'pharaoh', title: '亲密爱人', artist: '法老', tag: 'PHARAOH',
      bpm: 88, bars: 8, color: '#ff3b2f', color2: '#ff8a3d',
      chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'],
      melody: [
        { s: 0, n: 'A4', d: 3 }, { s: 3, n: 'C5', d: 1 }, { s: 4, n: 'B4', d: 2 },
        { s: 6, n: 'A4', d: 2 }, { s: 8, n: 'E4', d: 3 }, { s: 11, n: 'G4', d: 1 },
        { s: 12, n: 'A4', d: 4 }
      ],
      render(S, step, t, bar, s16) {
        const KICK = ['x.......x.......', 'x.......x.......', 'x.......x.....x.',
                      'x.......x.......', 'x.....x.x.......', 'x.......x.......',
                      'x.......x...x...', 'x.......x.......'];
        const HAT  = ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.xx', 'x.x.x.x.xxx.x.x.',
                      'x.x.x.x.x.x.x.xx', 'x.x.x.x.x.x.x.x.', 'x.x.xxx.x.x.x.x.',
                      'x.x.x.x.x.x.xxx.', 'x.x.x.x.xxx.x.xx'];
        const hatPat = HAT[bar % HAT.length];
        const kickPat = KICK[bar % KICK.length];

        if (kickPat[s16] === 'x') S.kick(t, 0.95);
        if (s16 === 8) S.clap(t, 0.5);
        if (hatPat[s16] === 'x') S.hat(t, s16 % 4 === 0 ? 0.17 : 0.1);

        if (s16 === 0) {
          S.sub(t, hz(rootOf(this.chords[bar], 1)), 60 / this.bpm * 3.4, 0.85);
        }
        if (s16 === 10 && (bar === 2 || bar === 6)) {
          S.sub(t, hz(rootOf(this.chords[bar], 1) + 7), 60 / this.bpm * 1.4, 0.6);
        }
        if (s16 === 0 || s16 === 8) {
          const v = voice(this.chords[bar], 4);
          v.forEach((n, i) => S.keys(t + i * 0.012, hz(n), 1.5, 0.1 - i * 0.012));
        }
        if (bar >= 4) {
          const e = this.melody[(step % 16)];
          if (e && e.s === s16) {
            const oct = bar >= 6 ? 12 : 0;
            S.lead(t, hz(midiOf(e.n) + oct), e.d * (60 / this.bpm / 4) * 0.95, 0.1, 'triangle', 2400);
          }
        }
        if (s16 === 0 && (bar === 0 || bar === 4)) S.crash(t, bar === 0 ? 0.16 : 0.1);
        if (bar === 0 || bar === 4) S.hiss(t, 60 / this.bpm * 4);
      }
    },

    /* ── 02 回春丹《鲜花》── */
    huichundan: {
      id: 'huichundan', title: '鲜花', artist: '回春丹', tag: 'HUI CHUN DAN',
      bpm: 132, bars: 8, color: '#3ddc84', color2: '#a8ff78',
      chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A'],
      melody: [
        { s: 0, n: 'D5', d: 2 }, { s: 2, n: 'E5', d: 2 }, { s: 4, n: 'F#5', d: 4 },
        { s: 8, n: 'A5', d: 2 }, { s: 10, n: 'F#5', d: 2 }, { s: 12, n: 'E5', d: 4 },
        { s: 16, n: 'E5', d: 2 }, { s: 18, n: 'D5', d: 2 }, { s: 20, n: 'B4', d: 4 },
        { s: 24, n: 'D5', d: 2 }, { s: 26, n: 'E5', d: 2 }, { s: 28, n: 'D5', d: 4 }
      ],
      render(S, step, t, bar, s16) {
        const HAT = ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.xx', 'x.x.x.x.x.x.x.x.',
                      'x.x.x.xxx.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.xx',
                      'x.x.x.x.x.x.x.x.', 'x.x.xx.xx.x.x.x.'];
        const KICK = ['x...x...x...x...', 'x...x...x...x..x', 'x...x...x...x...',
                      'x...x...x...x...', 'x...x...x...x...', 'x...x...x...x..x',
                      'x...x...x...x...', 'x.....x.x...x...'];
        const kickPat = KICK[bar % KICK.length];
        const hatPat = HAT[bar % HAT.length];

        const drumsIn = bar >= 1;
        if (drumsIn) {
          if (kickPat[s16] === 'x') S.kick(t, 0.86);
          if (s16 === 4 || s16 === 12) S.snare(t, 0.44);
          if (hatPat[s16] === 'x') S.hat(t, s16 % 4 === 0 ? 0.13 : 0.075);
        }
        if (s16 === 0) {
          S.bass(t, hz(rootOf(this.chords[bar], 2)), (60 / this.bpm) * 1.8, 0.5, 700);
          S.bass(t + (60 / this.bpm) * 2, hz(rootOf(this.chords[bar], 2)), (60 / this.bpm) * 1.6, 0.36, 700);
        }
        if (s16 % 2 === 0) {
          const v = voice(this.chords[bar], 4);
          const g = s16 % 4 === 0 ? 0.1 : 0.06;
          S.gtr(t, hz(v[0] + 12), 0.32, g, 2800, 0.5);
          if (s16 % 4 === 0) {
            v.forEach((n, i) => S.gtr(t + i * 0.008, hz(n + 12), 0.5, 0.055, 2600, 1));
          }
        }
        if (bar >= 2) {
          const e = this.melody[step % 32];
          if (e && e.s === s16) {
            S.lead(t, hz(midiOf(e.n)), e.d * (60 / this.bpm / 4) * 0.85, 0.115, 'sawtooth', 3400);
          }
        }
        if (s16 === 0 && (bar === 0 || bar === 4)) S.crash(t, bar === 0 ? 0.2 : 0.13);
      }
    },

    /* ── 03 门尼《罗曼蒂克乌托邦》── */
    meni: {
      id: 'meni', title: '罗曼蒂克乌托邦', artist: '门尼', tag: 'MONEY',
      bpm: 76, bars: 8, color: '#f0a4c8', color2: '#9ec5ff',
      chords: ['Fmaj7', 'Am7', 'Bbmaj7', 'C', 'Fmaj7', 'Am7', 'Gm7', 'C'],
      melody: [
        { s: 0, n: 'A4', d: 4 }, { s: 4, n: 'C5', d: 2 }, { s: 6, n: 'E5', d: 2 },
        { s: 8, n: 'D5', d: 4 }, { s: 12, n: 'C5', d: 4 }
      ],
      render(S, step, t, bar, s16) {
        const beat = 60 / this.bpm;
        if (s16 === 0) {
          const v = voice(this.chords[bar], 3);
          S.pad(t, v.map(hz), beat * 3.9, 0.075, 1500);
        }
        if (s16 === 0 || s16 === 6 || s16 === 10) {
          const v = voice(this.chords[bar], 4);
          v.forEach((n, i) => S.keys(t + i * 0.02, hz(n), 1.6, 0.085 - i * 0.01, 3.2));
        }
        if (s16 % 2 === 0) {
          const v = voice(this.chords[bar], 5);
          const n = v[(s16 / 2) % v.length];
          S.pluck(t, hz(n), 0.9, 0.05, 3200);
        }
        if (bar >= 1) {
          if (s16 === 0) S.kick(t, 0.55);
          if (s16 === 8) S.rim(t, 0.22);
          if (s16 % 4 === 2) S.hat(t, 0.045, 0.05);
        }
        if (bar >= 3) {
          const e = this.melody[step % 16];
          if (e && e.s === s16) {
            S.lead(t, hz(midiOf(e.n)), e.d * (beat / 4) * 0.9, 0.075, 'sine', 2200);
          }
        }
        if (s16 === 0 && bar === 0) S.hiss(t, beat * 4);
      }
    },

    /* ── 04 犬儒《志铭》── */
    cynic: {
      id: 'cynic', title: '志铭', artist: '犬儒', tag: 'CYNIC',
      bpm: 148, bars: 8, color: '#8f9bb3', color2: '#c9d4e6',
      chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'D', 'D'],
      melody: [
        { s: 0, n: 'E5', d: 2 }, { s: 2, n: 'G5', d: 2 }, { s: 4, n: 'B5', d: 4 },
        { s: 8, n: 'A5', d: 2 }, { s: 10, n: 'G5', d: 2 }, { s: 12, n: 'E5', d: 4 }
      ],
      render(S, step, t, bar, s16) {
        const beat = 60 / this.bpm;
        const drumsIn = bar >= 1;
        if (drumsIn) {
          if (s16 === 0 || s16 === 6 || s16 === 10) S.kick(t, 0.8);
          if (s16 === 4 || s16 === 12) S.snare(t, 0.5);
          S.hat(t, s16 % 2 === 0 ? 0.08 : 0.05, 0.035);
        }
        if (s16 % 2 === 0) {
          const r = rootOf(this.chords[bar], 2);
          S.gtr(t, hz(r), 0.22, 0.115, 1900, 2.2);
          S.gtr(t, hz(r + 7), 0.22, 0.085, 2000, 2.4);
          if (s16 % 4 === 0) S.gtr(t, hz(r + 12), 0.3, 0.06, 2100, 1.8);
        }
        if (s16 === 0) S.bass(t, hz(rootOf(this.chords[bar], 1)), beat * 3.6, 0.6, 900);
        if (bar >= 2) {
          const e = this.melody[step % 16];
          if (e && e.s === s16) {
            S.lead(t, hz(midiOf(e.n)), e.d * (beat / 4) * 0.8, 0.085, 'square', 2600, 0.6);
          }
        }
        if (s16 === 0 && (bar === 0 || bar === 4)) S.crash(t, 0.17);
      }
    },

    /* ── 05 草东没有派对《大风吹》── */
    caodong: {
      id: 'caodong', title: '大风吹', artist: '草东没有派对', tag: 'NO PARTY FOR CAO DONG',
      bpm: 112, bars: 8, color: '#6c7a89', color2: '#e0e6ec',
      chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'E'],
      melody: [
        { s: 0, n: 'A4', d: 4 }, { s: 4, n: 'C5', d: 2 }, { s: 6, n: 'B4', d: 2 },
        { s: 8, n: 'A4', d: 4 }, { s: 12, n: 'G4', d: 4 }
      ],
      render(S, step, t, bar, s16) {
        const beat = 60 / this.bpm;
        const drumsIn = bar >= 1;
        if (drumsIn) {
          if (s16 === 0 || s16 === 10) S.kick(t, 0.62);
          if (s16 === 8) S.snare(t, 0.36);
          if (s16 === 4 || s16 === 12 || s16 === 14) S.tom(t, 0.3, s16 === 14 ? 120 : 95);
          if (s16 % 4 === 0) S.hat(t, 0.06, 0.06);
          if (s16 === 14 && bar % 2 === 1) S.hat(t, 0.05, 0.03);
        }
        const v = voice(this.chords[bar], 4);
        if (s16 % 2 === 0) {
          const n = v[(s16 / 2) % v.length];
          S.gtr(t, hz(n), 0.7, 0.062, 2400, 0.9);
        }
        if (s16 === 0) S.bass(t, hz(rootOf(this.chords[bar], 2)), beat * 3.5, 0.44, 600);
        if (bar >= 4) {
          const e = this.melody[step % 16];
          if (e && e.s === s16) {
            S.lead(t, hz(midiOf(e.n)), e.d * (beat / 4) * 0.95, 0.07, 'triangle', 2000, 0.5);
          }
        }
        if (s16 === 0 && bar === 0) S.crash(t, 0.11);
      }
    }
  };

  /* ============================================================
     音频引擎
     ============================================================ */
  let ctx = null, master = null, comp = null, analyser = null,
      dry = null, revSend = null, revGain = null, noiseBuf = null;

  let state = {
    playing: false,
    id: null,
    step: 0,
    nextTime: 0,
    accum: 0,      // 之前累计播放秒数
    playStart: 0,  // 本轮连续播放的起点（ctx.currentTime）
    timer: null,
    mode: 'synth'
  };

  const LOOKAHEAD = 0.14;
  const TICK = 25;

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });

    master = ctx.createGain();
    master.gain.value = 0.82;

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 26;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.005;
    comp.release.value = 0.22;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.78;

    dry = ctx.createGain();
    dry.gain.value = 1;

    const conv = ctx.createConvolver();
    conv.buffer = makeIR(2.6, 2.4);
    revSend = ctx.createGain();
    revSend.gain.value = 1;
    revGain = ctx.createGain();
    revGain.gain.value = 0.34;

    dry.connect(comp);
    revSend.connect(conv);
    conv.connect(revGain);
    revGain.connect(comp);
    comp.connect(master);
    master.connect(analyser);
    analyser.connect(ctx.destination);

    noiseBuf = makeNoise(2);
    return ctx;
  }

  function makeNoise(sec) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function makeIR(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  function noise(t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
    return s;
  }

  function env(node, t, a, d, peak, dur, r, sus) {
    const g = node.gain;
    const sl = Math.max(sus === undefined ? peak * 0.55 : sus, 0.0002);
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.exponentialRampToValueAtTime(sl, t + a + d);
    const holdEnd = Math.max(t + a + d, t + dur);
    g.setValueAtTime(sl, holdEnd);
    g.exponentialRampToValueAtTime(0.0001, holdEnd + r);
    return holdEnd + r;
  }

  function out(node, send) {
    node.connect(dry);
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send * (state.mode === 'live' ? 1.5 : 1);
      node.connect(s);
      s.connect(revSend);
    }
  }

  /* ---------- 鼓组 ---------- */
  const DR = {
    kick(t, g) {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(165, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.085);
      env(gn, t, 0.002, 0.09, g, 0.02, 0.2, 0.0002);
      o.connect(gn); out(gn, 0.05);
      o.start(t); o.stop(t + 0.45);

      const c = noise(t, 0.02);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1600;
      const cg = ctx.createGain();
      env(cg, t, 0.001, 0.014, g * 0.22, 0, 0.02, 0.0002);
      c.connect(hp); hp.connect(cg); out(cg, 0);
    },
    snare(t, g) {
      const n = noise(t, 0.2);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
      const ng = ctx.createGain();
      env(ng, t, 0.001, 0.11, g, 0.01, 0.12, 0.0002);
      n.connect(bp); bp.connect(ng); out(ng, 0.14);

      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(210, t);
      o.frequency.exponentialRampToValueAtTime(140, t + 0.07);
      env(og, t, 0.001, 0.06, g * 0.5, 0.01, 0.06, 0.0002);
      o.connect(og); out(og, 0.1);
      o.start(t); o.stop(t + 0.2);
    },
    clap(t, g) {
      [0, 0.011, 0.023].forEach((off, i) => {
        const n = noise(t + off, 0.12);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.1;
        const ng = ctx.createGain();
        env(ng, t + off, 0.001, i === 2 ? 0.13 : 0.03, g * (i === 2 ? 1 : 0.6), 0, 0.09, 0.0002);
        n.connect(bp); bp.connect(ng); out(ng, 0.22);
      });
    },
    hat(t, g, dec) {
      const n = noise(t, dec || 0.045);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 8200;
      const ng = ctx.createGain();
      env(ng, t, 0.0008, dec || 0.045, g, 0, 0.03, 0.0002);
      n.connect(hp); hp.connect(ng); out(ng, 0.06);
    },
    rim(t, g) {
      const n = noise(t, 0.05);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 3;
      const ng = ctx.createGain();
      env(ng, t, 0.001, 0.035, g, 0, 0.04, 0.0002);
      n.connect(bp); bp.connect(ng); out(ng, 0.2);
    },
    tom(t, g, f) {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f || 110, t);
      o.frequency.exponentialRampToValueAtTime((f || 110) * 0.6, t + 0.22);
      env(gn, t, 0.002, 0.22, g, 0.01, 0.16, 0.0002);
      o.connect(gn); out(gn, 0.16);
      o.start(t); o.stop(t + 0.5);
    },
    crash(t, g) {
      const n = noise(t, 1.7);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 5200;
      const ng = ctx.createGain();
      env(ng, t, 0.004, 0.5, g, 0.05, 1.2, 0.0002);
      n.connect(hp); hp.connect(ng); out(ng, 0.36);
    },
    hiss(t, dur) {
      const n = noise(t, dur);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.4;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.012, t);
      ng.gain.setValueAtTime(0.012, t + dur);
      ng.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
      n.connect(bp); bp.connect(ng); out(ng, 0.2);
    }
  };

  /* ---------- 音高乐器 ---------- */
  function tone(type, freq, t, dur, g, cut, a, send, detune) {
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const gn = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.value = detune;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cut || 3000, t);
    f.Q.value = 0.9;
    if (a === 'sweep') {
      f.frequency.exponentialRampToValueAtTime(Math.max((cut || 3000) * 0.32, 220), t + Math.min(dur + 0.2, 1.2));
    }
    env(gn, t, a === 'sweep' ? 0.008 : 0.004, Math.min(dur * 0.35, 0.5), g, dur, Math.min(dur * 0.5 + 0.1, 1.1));
    o.connect(f); f.connect(gn); out(gn, send || 0);
    o.start(t); o.stop(t + dur + 1.4);
  }

  const IN = {
    kick: DR.kick, snare: DR.snare, clap: DR.clap, hat: DR.hat,
    rim: DR.rim, tom: DR.tom, crash: DR.crash, hiss: DR.hiss,

    sub(t, freq, dur, g) {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * 2, t);
      o.frequency.exponentialRampToValueAtTime(freq, t + 0.07);
      env(gn, t, 0.006, 0.2, g, dur, 0.28, g * 0.85);
      o.connect(gn); out(gn, 0.02);
      o.start(t); o.stop(t + dur + 0.5);

      const h = ctx.createOscillator();
      const hg = ctx.createGain();
      h.type = 'triangle';
      h.frequency.setValueAtTime(freq * 2, t);
      env(hg, t, 0.006, 0.12, g * 0.13, dur * 0.5, 0.2, 0.0002);
      h.connect(hg); out(hg, 0.05);
      h.start(t); h.stop(t + dur + 0.4);
    },
    bass(t, freq, dur, g, cut) {
      tone('sawtooth', freq, t, dur, g, cut || 800, 'sweep', 0.04);
      tone('square', freq, t, dur, g * 0.32, cut || 800, 'sweep', 0.02, -7);
    },
    gtr(t, freq, dur, g, cut, drive) {
      if (drive > 1.4) {
        tone('sawtooth', freq, t, dur, g, cut, 'sweep', 0.06, 6);
        tone('sawtooth', freq, t, dur, g * 0.8, cut, 'sweep', 0.06, -9);
        tone('square', freq * 0.5, t, dur, g * 0.3, cut * 0.7, 'sweep', 0.03, 4);
      } else {
        tone('triangle', freq, t, dur, g, cut, 0.006, 0.14);
        tone('sawtooth', freq, t, dur, g * 0.35, cut, 0.006, 0.08, 7);
      }
    },
    pluck(t, freq, dur, g, cut) {
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const gn = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, t);
      f.type = 'lowpass';
      f.frequency.setValueAtTime(cut || 3000, t);
      f.frequency.exponentialRampToValueAtTime(600, t + dur);
      env(gn, t, 0.002, dur * 0.7, g, 0.01, 0.35, 0.0002);
      o.connect(f); f.connect(gn); out(gn, 0.3);
      o.start(t); o.stop(t + dur + 0.5);
    },
    keys(t, freq, dur, g, bright) {
      const o1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(freq, t);
      env(g1, t, 0.004, dur * 0.55, g, dur * 0.4, 0.6, 0.0002);
      o1.connect(g1); out(g1, 0.3);
      o1.start(t); o1.stop(t + dur + 0.9);

      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(freq * (bright ? 3.01 : 2.01), t);
      env(g2, t, 0.003, Math.min(dur * 0.22, 0.5), g * 0.3, 0.01, 0.25, 0.0002);
      o2.connect(g2); out(g2, 0.34);
      o2.start(t); o2.stop(t + dur + 0.4);
    },
    pad(t, freqs, dur, g, cut) {
      freqs.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const gn = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(freq, t);
        o.detune.value = (i % 2 === 0 ? 1 : -1) * (5 + i * 2);
        f.type = 'lowpass';
        f.frequency.setValueAtTime(cut || 1500, t);
        f.frequency.linearRampToValueAtTime((cut || 1500) * 1.25, t + dur * 0.5);
        f.Q.value = 0.6;
        const peak = g / Math.max(freqs.length * 0.55, 1);
        env(gn, t, dur * 0.35, dur * 0.3, peak, dur * 0.6, dur * 0.6, peak * 0.7);
        o.connect(f); f.connect(gn); out(gn, 0.45);
        o.start(t); o.stop(t + dur * 2.2);
      });
    },
    lead(t, freq, dur, g, type, cut, vib) {
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const gn = ctx.createGain();
      o.type = type || 'sawtooth';
      o.frequency.setValueAtTime(freq, t);
      f.type = 'lowpass';
      f.frequency.setValueAtTime(cut || 3000, t);
      f.Q.value = 1.2;
      const jitter = state.mode === 'live' ? 0.006 : 0.002;
      o.detune.setValueAtTime(-jitter * 120, t);
      o.detune.linearRampToValueAtTime(jitter * 120, t + dur * 0.7);
      env(gn, t, 0.02, dur * 0.3, g, dur * 0.75, 0.28, g * 0.55);
      o.connect(f); f.connect(gn); out(gn, 0.4);
      o.start(t); o.stop(t + dur + 0.7);

      if (vib) {
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 5.2;
        lg.gain.value = vib * 8;
        lfo.connect(lg); lg.connect(o.detune);
        lfo.start(t); lfo.stop(t + dur + 0.6);
      }
    }
  };

  /* ---------- 调度 ---------- */
  function stepDur(song) { return 60 / song.bpm / 4; }

  function schedule() {
    const song = SONGS[state.id];
    if (!song || !state.playing) return;
    const sd = stepDur(song);
    const total = song.bars * 16;

    while (state.nextTime < ctx.currentTime + LOOKAHEAD) {
      const s = state.step % total;
      const bar = Math.floor(s / 16);
      const s16 = s % 16;
      try { song.render(IN, s, state.nextTime, bar, s16); } catch (e) { /* 忽略单步错误 */ }
      state.step++;
      state.nextTime += sd;
    }
  }

  /* ---------- 对外接口 ---------- */
  function start(id) {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    state.id = id;
    state.step = 0;
    state.nextTime = ctx.currentTime + 0.08;
    state.accum = 0;
    state.playStart = ctx.currentTime;
    state.playing = true;
    clearInterval(state.timer);
    state.timer = setInterval(schedule, TICK);
    schedule();
    return SONGS[id];
  }

  function stop() {
    state.playing = false;
    clearInterval(state.timer);
    state.timer = null;
    if (master && ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      setTimeout(() => {
        if (!state.playing && master) {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.setValueAtTime(0.82, ctx.currentTime);
        }
      }, 260);
    }
    state.id = null;
    state.accum = 0;
    state.step = 0;
  }

  function pause() {
    if (!state.playing) return;
    state.playing = false;
    state.accum += ctx.currentTime - state.playStart;
    clearInterval(state.timer);
    state.timer = null;
    if (master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    }
  }

  function resume() {
    if (!state.id || state.playing) return;
    if (master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.82, ctx.currentTime + 0.14);
    }
    state.playing = true;
    state.playStart = ctx.currentTime;
    state.nextTime = ctx.currentTime + 0.06;
    clearInterval(state.timer);
    state.timer = setInterval(schedule, TICK);
    schedule();
  }

  function toggle(id) {
    if (state.id === id && state.playing) { pause(); return 'paused'; }
    if (state.id === id && !state.playing && state.step > 0) { resume(); return 'resumed'; }
    start(id);
    return 'playing';
  }

  function progress() {
    if (!state.id) return { id: null, frac: 0, elapsed: 0, total: 0, song: null };
    const song = SONGS[state.id];
    const total = song.bars * 16 * stepDur(song);
    const elapsed = state.accum + (state.playing && ctx ? ctx.currentTime - state.playStart : 0);
    const frac = total > 0 ? (((elapsed % total) + total) % total) / total : 0;
    return { id: state.id, frac, elapsed, total, song };
  }

  function level() {
    if (!analyser) return null;
    const n = analyser.frequencyBinCount;
    if (!level._b) level._b = new Uint8Array(n);
    analyser.getByteFrequencyData(level._b);
    return level._b;
  }

  function setMode(m) {
    state.mode = m;
    if (revGain && ctx) {
      revGain.gain.cancelScheduledValues(ctx.currentTime);
      revGain.gain.setValueAtTime(revGain.gain.value, ctx.currentTime);
      revGain.gain.linearRampToValueAtTime(m === 'live' ? 0.52 : 0.34, ctx.currentTime + 0.4);
    }
    return m;
  }

  return {
    init, start, stop, pause, resume, toggle, progress, level, setMode,
    get song() { return state.id ? SONGS[state.id] : null; },
    get playing() { return state.playing; },
    get id() { return state.id; },
    get songs() { return SONGS; },
    get ctx() { return ctx; }
  };
})();

window.Engine = Engine;
