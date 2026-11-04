/* Postpartum Fathers site search. Runs only in the browser, sends nothing anywhere.
   The word list it searches is /search-index.js (English) or /es/search-index.js (Spanish),
   made by tools/build_search.py. With JavaScript off the search box stays hidden. */
(function () {
  var D = window.PF_SEARCH, box = document.querySelector('.site-search');
  if (!D || !box) return;
  var input = box.querySelector('input'), out = box.querySelector('.search-out'), form = box.querySelector('form');

  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  var STOP = {}, WEAK = {};
  D.stop.split(' ').forEach(function (w) { STOP[w] = 1; });
  D.weak.split(' ').forEach(function (w) { WEAK[w] = 1; });

  // Each page gets a map of word -> weight (title 3, plain-word list 2.5, description 1)
  var items = D.items.map(function (it) {
    var words = {}, phrases = it.k.split('|').map(norm).filter(Boolean);
    function add(text, w) { norm(text).split(' ').forEach(function (x) { if (x && !(words[x] >= w)) words[x] = w; }); }
    add(it.h + ' ' + it.g, 1); add(phrases.join(' '), 2.5); add(it.t, 3);
    return { it: it, words: words, phrases: phrases, title: norm(it.t) };
  });

  // Edit distance that counts a swapped pair of letters as one typo
  function dist(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) { d[0][j] = j; }
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      var c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  function wordMatch(q, w) {
    if (q === w) return 1;
    if (q.length >= 3 && w.indexOf(q) === 0) return 0.85;          // still typing: "slee" -> sleep
    if (w.length >= 4 && q.indexOf(w) === 0) return 0.75;          // "sleeping" -> sleep
    if (q.length >= 4 && Math.abs(q.length - w.length) <= 2) {      // typos: "insomnai", "anxeity"
      var t = dist(q, w);
      if (t <= (q.length >= 7 ? 2 : 1)) return 0.6;
    }
    return 0;
  }
  function has(hay, needle) { return (' ' + hay + ' ').indexOf(' ' + needle + ' ') >= 0; }

  function score(x, qn, toks) {
    var s = 0, hit = 0;
    x.phrases.forEach(function (p) {
      if (p.length >= 3 && has(qn, p)) s += 10 + p.split(' ').length * 2;     // "i cant sleep at night" holds "cant sleep"
      else if (qn.length >= 3 && p.indexOf(qn) === 0) s += 7;                  // typing the start of a phrase
      else if (qn.length >= 4 && (' ' + p).indexOf(' ' + qn) > 0) s += 4;   // a later word in the phrase starts with it
    });
    if (qn.length >= 3 && x.title.indexOf(qn) >= 0) s += 8;
    toks.forEach(function (q) {
      var best = 0;
      for (var w in x.words) { var m = wordMatch(q, w) * x.words[w]; if (m > best) best = m; }
      if (best) { hit++; s += best * (WEAK[q] ? 0.3 : 1); }
    });
    if (toks.length > 1) s += 4 * hit / toks.length;
    return s;
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function html(s) { var d = el('div'); d.innerHTML = s; return d; }

  var hits = [];
  function run() {
    var qn = norm(input.value);
    out.innerHTML = ''; hits = [];
    if (qn.length < 2) return;
    var all = qn.split(' '), toks = all.filter(function (t) { return !STOP[t]; });
    if (!toks.length) toks = all;
    if (new RegExp(D.crisisWords).test(qn)) out.appendChild(html(D.crisis));
    var ranked = items.map(function (x) { return { x: x, s: score(x, qn, toks) }; })
      .filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; });
    var top = ranked.length ? ranked[0].s : 0;
    hits = ranked.filter(function (r) { return r.s >= Math.max(0.95, top * 0.4); }).slice(0, 6);
    if (!hits.length) { out.appendChild(html(D.fallback)); return; }
    var list = el('ul', 'search-hits');
    hits.forEach(function (r) {
      var li = el('li'), a = el('a', 'search-hit');
      a.href = r.x.it.u; a.appendChild(el('strong', '', r.x.it.t)); a.appendChild(el('span', '', r.x.it.h));
      li.appendChild(a); list.appendChild(li);
    });
    out.appendChild(el('p', 'search-count', hits.length === 1 ? D.one : D.many.replace('N', hits.length)));
    out.appendChild(list);
    out.appendChild(html(D.more));
  }

  var timer;
  input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 120); });
  form.addEventListener('submit', function (ev) {
    ev.preventDefault(); clearTimeout(timer); run();
    if (hits.length) window.location.href = hits[0].x.it.u;
  });
  box.hidden = false;
})();
