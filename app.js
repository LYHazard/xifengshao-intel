/* 西风哨 - 前端渲染（情报系统版） */
(function () {
  'use strict';

  var DATA = window.__XFS_DATA__;
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var IMP_TEXT = { high: '高', medium: '中', low: '低' };
  var SENT_TEXT = { negative: '负面', neutral: '中性', positive: '正面' };

  if (!DATA) {
    $('main').innerHTML = '<div class="empty">未能加载数据文件 data/index.js<br>请先运行 scripts/build_site.py 生成索引。</div>';
    return;
  }

  var DAYS = Object.keys(DATA.days || {});            // 已按倒序
  var ARCHIVE = DATA.archive || {};
  var state = {
    view: 'day',
    day: DAYS[0] || null,
    q: '',
    collapse: false,
  };

  /* ===================== 报头 ===================== */
  function renderTop() {
    var s = DATA.stats || {};
    var arc = ARCHIVE.penetration || {};
    $('topMeta').innerHTML =
      '<div><b>' + (arc['累计报道'] || s.total || 0) + '</b>累计报道</div>' +
      '<div><b>' + (arc['运行天数'] || s.days || 0) + '</b>运行天数</div>' +
      '<div><b>' + (arc['负面累计'] || s.negatives || 0) + '</b>负面累计</div>' +
      '<div style="text-align:right"><b>' + esc((DATA.generated_at || '').replace('T', ' ').slice(0, 16)) + '</b>索引生成</div>';

    // 折叠详情：展示最近一日的采集覆盖
    var latest = DAYS[0] ? DATA.days[DAYS[0]] : null;
    var html = '';
    if (latest) {
      var cov = latest.coverage || {};
      function block(key, name) {
        var c = cov[key]; if (!c) return '';
        var tag, cls;
        if (c.captured === 0) { tag = '未采集到'; cls = 'cov-none'; }
        else if (c.with_fulltext < c.captured) { tag = '部分完整'; cls = 'cov-warn'; }
        else { tag = '完整'; cls = 'cov-ok'; }
        return '<div class="cov-item"><span class="cov-tag ' + cls + '">' + tag + '</span>' +
          '<strong>' + name + '</strong>：登记 ' + c.captured + ' 篇' +
          (c.captured ? '，含署名 ' + c.with_author + ' 篇、含正文 ' + c.with_fulltext + ' 篇' : '') +
          '。<br>' + esc(c.note) + '</div>';
      }
      html += block('reuters', '路透社') + block('bloomberg', '彭博社');
      var win = latest.window || {};
      if (win.note) html += '<div class="cov-item" style="margin-top:8px"><strong>采集窗口</strong>：' + esc(win.note) + '</div>';
    }
    $('topDetail').innerHTML = html;
    $('topDetail').classList.toggle('hide', state.collapse);
    $('collapseBtn').classList.toggle('up', state.collapse);

    $('footerMeta').textContent = '索引生成于 ' + (DATA.generated_at || '').replace('T', ' ').slice(0, 19);
  }

  /* ===================== 侧栏导航 ===================== */
  function renderSidebar() {
    $('navDays').innerHTML = DAYS.map(function (d) {
      var cnt = DATA.days[d].articles.length;
      var qn = (DATA.days[d].questions || []).length;
      var qmark = qn ? '<span class="qmark" title="含情报谋题 ' + qn + ' 题">★' + qn + '</span>' : '';
      return '<button class="nav-day' + (state.view === 'day' && state.day === d ? ' on' : '') +
        '" data-day="' + esc(d) + '">' + esc(d) + qmark + '<span class="cnt">' + cnt + ' 篇</span></button>';
    }).join('');

    $('navDays').querySelectorAll('.nav-day').forEach(function (b) {
      b.addEventListener('click', function () {
        state.view = 'day';
        state.day = b.dataset.day;
        if (b.dataset.day === DAYS[0]) state.collapse = false;
        renderAll();
      });
    });

    $('navArchive').classList.toggle('on', state.view === 'archive');
    $('navSearch').classList.toggle('on', state.view === 'search');

    var daysTxt = DAYS.length ? (DAYS[DAYS.length - 1] + ' → ' + DAYS[0]) : '-';
    $('sidebarFoot').innerHTML = '数据窗口：' + esc(daysTxt) + '<br>本机存档 · 离线可用';
  }

  /* ===================== 每日文档 ===================== */
  function renderDay(day) {
    var d = DATA.days[day];
    if (!d) { $('main').innerHTML = '<div class="empty">未找到该日文档</div>'; return; }
    var da = d.daily_analysis || {};
    var arts = d.articles || [];
    var scan = (d.scan_time || '').replace('T', ' ').slice(0, 16);
    var win = (d.window && d.window.note) ? d.window.note : '';

    var html = '';
    html += '<section class="doc-head"><h1>每日涉华舆情文档 · ' + esc(day) + '</h1>' +
      '<div class="doc-sub">扫描于 ' + esc(scan) + (win ? ' · ' + esc(win) : '') + '</div></section>';

    // —— 每日情报谋题（最显眼位置，置于一切之前）——
    html += questionsSection(d.questions || [], day);

    // —— 当日研判 ——
    var ss = da.sentiment_split || { negative: 0, neutral: 0, positive: 0 };
    var negLinks = (da.negatives || []).map(function (id) {
      var a = byId(arts, id); if (!a) return '';
      return '<a data-id="' + esc(id) + '"><span class="when">' + esc(a.published_at || '') + '</span>' +
        esc(a.title_zh || a.title_en) + '</a>';
    }).join('');
    html += '<section class="daily-analysis">' +
      '<div class="da-take"><b>当日要览：</b>' + esc(da.key_takeaway || '') + '</div>' +
      '<div class="da-row">' +
        '<div class="da-block"><span class="lab">情感分布</span><div>' +
          '<span class="sent-chip sent-neg">负面 ' + ss.negative + '</span>' +
          '<span class="sent-chip sent-neu">中性 ' + ss.neutral + '</span>' +
          '<span class="sent-chip sent-pos">正面 ' + ss.positive + '</span></div></div>' +
        '<div class="da-block"><span class="lab">热门议题</span><div class="tags">' +
          (da.top_topics || []).map(function (t) { return '<span class="tag">' + esc(t[0]) + ' ' + t[1] + '</span>'; }).join('') +
        '</div></div>' +
      '</div>' +
      (negLinks ? '<div class="da-neg"><div class="lab">⚠ 重要负面报道（点击查看深度研判）</div>' + negLinks + '</div>' : '') +
      '</section>';

    // —— 文章列表 ——
    html += '<section class="list">' + arts.map(articleCard).join('') + '</section>';
    $('main').innerHTML = html;
    bindCards();
  }

  /* ===================== 每日情报谋题 ===================== */
  var CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];

  function questionsSection(qs, day) {
    if (!qs || !qs.length) {
      return '<section class="q-wrap q-empty"><div class="q-head">' +
        '<span class="q-badge">情报谋题</span><h2>当日未出题</h2></div>' +
        '<div class="q-note">该日无谋题记录（每日应出 3 题；' + esc(day) +
        ' 早于谋题机制上线或未执行）。</div></section>';
    }
    var cards = qs.map(function (q, i) {
      var num = CIRCLED[i] || String(i + 1);
      var ev = (q.evidence || []).map(function (e) {
        var meta = [e.media, e.date].filter(Boolean).join(' · ');
        return '<li><a href="' + esc(e.url || '#') + '" target="_blank" rel="noopener">' +
          esc(e.title || '原文') + '</a>' + (meta ? '<span class="q-ev-meta">' + esc(meta) + '</span>' : '') +
          (e.note ? '<span class="q-ev-note">' + esc(e.note) + '</span>' : '') + '</li>';
      }).join('');
      var chips = '';
      if (q.urgency) chips += '<span class="q-chip q-u-' + esc(q.urgency) + '">紧要度 ' + esc(q.urgency) + '</span>';
      if (q.type) chips += '<span class="q-chip">' + esc(q.type) + '</span>';
      if (q.source_type) chips += '<span class="q-chip q-src">题源 ' + esc(q.source_type) + '</span>';
      return '<article class="q-card">' +
        '<div class="q-num">' + num + '</div>' +
        '<h3 class="q-title">' + esc(q.title || '') + '</h3>' +
        '<div class="q-chips">' + chips + '</div>' +
        (q.trigger ? '<p class="q-trigger"><b>触发动态</b>' + esc(q.trigger) + '</p>' : '') +
        (ev ? '<div class="q-sec"><span class="q-lab">依据</span><ol class="q-ev">' + ev + '</ol></div>' : '') +
        (q.background ? '<div class="q-sec"><span class="q-lab">背景</span><p>' + esc(q.background) + '</p></div>' : '') +
        (q.value ? '<div class="q-sec q-val"><span class="q-lab">价值</span><p>' + esc(q.value) + '</p></div>' : '') +
        ((q.angles && q.angles.length) ? '<div class="q-sec"><span class="q-lab">建议切入</span><p>' +
          esc(q.angles.join('；')) + '</p></div>' : '') +
        ((q.watch && q.watch.length) ? '<div class="q-sec"><span class="q-lab">下一步取证</span><p>' +
          esc(q.watch.join('；')) + '</p></div>' : '') +
        ((q.tags && q.tags.length) ? '<div class="q-tags">' + q.tags.map(function (t) {
          return '<span class="tag">' + esc(t) + '</span>';
        }).join('') + '</div>' : '') +
        '</article>';
    }).join('');

    return '<section class="q-wrap">' +
      '<div class="q-head"><span class="q-badge">情报谋题</span>' +
      '<h2>今日三题 · ' + esc(day) + '</h2>' +
      '<span class="q-count">' + qs.length + ' 题</span></div>' +
      '<div class="q-note">依据当日及近期国际涉我负面动态选题（资料库跨日存档 + 网络检索），' +
      '每题给出依据、背景、价值。<b>本栏为当日最高优先级。</b></div>' +
      '<div class="q-grid">' + cards + '</div>' +
      '</section>';
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function articleCard(a) {
    var mediaCls = a.media === 'Reuters' ? 'b-reuters' : 'b-bloomberg';
    var sent = a.sentiment || 'neutral';
    var byline = (a.authors && a.authors.length)
      ? esc(a.authors.join('、')) + (a.author_locations ? '（' + esc(a.author_locations) + '）' : '')
      : '<em>署名未取得</em>';
    var sources = (a.cited_sources && a.cited_sources.length)
      ? a.cited_sources.map(function (s) { return esc(s); }).join('、')
      : '<em>信源未标注（转载源采集）</em>';

    return '<article class="item" data-id="' + esc(a.id) + '">' +
      '<div class="item-top">' +
        '<span class="badge ' + mediaCls + '">' + esc(a.media_zh || a.media) + '</span>' +
        '<span class="imp imp-' + esc(a.importance) + '">重要性 ' + (IMP_TEXT[a.importance] || '中') + '</span>' +
        (a.is_negative ? '<span class="sent-badge negative">负面</span>' : (sent === 'positive' ? '<span class="sent-badge positive">正面</span>' : '')) +
        (a.body_available ? '<span class="flag">含正文</span>' : '<span class="flag flag-warn">仅标题级</span>') +
        '<span class="date">' + esc(a.published_at || '') + '</span>' +
      '</div>' +
      '<h2>' + esc(a.title_zh || '') + '</h2>' +
      '<div class="title-en">' + esc(a.title_en || '') + '</div>' +
      '<div class="abs">' + esc(a.summary_zh || '') + '</div>' +
      '<div class="item-foot">' +
        '<div class="trace"><span class="k">记者（追溯）</span><span class="v">' + byline + '</span></div>' +
        '<div class="trace"><span class="k">信源（追溯）</span><span class="v">' + sources + '</span></div>' +
        '<div class="trace"><span class="k">原文（追溯）</span><span class="v"><a href="' + esc(a.source_url || '#') + '" target="_blank" rel="noopener">打开原始链接</a></span></div>' +
      '</div>' +
    '</article>';
  }

  /* ===================== 全档案情报 ===================== */
  function renderArchive() {
    var p = ARCHIVE.penetration || {};
    var html = '<section class="doc-head"><h1>全档案情报</h1>' +
      '<div class="doc-sub">读取 ' + (ARCHIVE.first_day || '-') + ' 至 ' + (ARCHIVE.last_day || '-') +
      ' 全部历史存档 · 系统运行越久，分析穿透力越强</div></section>';

    html += '<div class="pen">' +
      penCard('运行天数', p['运行天数'] || 0, '扫描日累计') +
      penCard('累计报道', p['累计报道'] || 0, '逐篇建档') +
      penCard('覆盖议题', p['覆盖议题'] || 0, '去重后议题数') +
      penCard('覆盖信源', p['覆盖信源'] || 0, '被引用信源类') +
      penCard('负面累计', p['负面累计'] || 0, '需研判负面') +
      '</div>';

    // 情感趋势
    var trend = ARCHIVE.sentiment_trend || [];
    html += '<div class="arc-block"><h4>情感趋势（按扫描日）</h4>';
    if (trend.length) {
      trend.forEach(function (t) {
        var tot = (t.negative || 0) + (t.neutral || 0) + (t.positive || 0) || 1;
        html += '<div class="trend-row"><span class="d">' + esc(t.date) + '</span>' +
          '<span class="trend-bar">' +
            '<i class="tb-neg" style="width:' + (t.negative / tot * 100) + '%"></i>' +
            '<i class="tb-neu" style="width:' + (t.neutral / tot * 100) + '%"></i>' +
            '<i class="tb-pos" style="width:' + (t.positive / tot * 100) + '%"></i>' +
          '</span>' +
          '<span class="n">负' + t.negative + ' 中' + t.neutral + ' 正' + t.positive + '</span></div>';
      });
    } else {
      html += '<div class="empty" style="padding:20px">暂无跨日数据</div>';
    }
    html += '</div>';

    // 信源频次
    var freq = ARCHIVE.cited_source_freq || [];
    var maxf = freq.length ? freq[0][1] : 1;
    html += '<div class="arc-block"><h4>信源被引用频次（全档案）</h4>';
    if (freq.length) {
      html += '<div class="src-list">' + freq.map(function (f) {
        return '<div class="row"><span class="nm">' + esc(f[0]) + '</span>' +
          '<span class="bar" style="width:' + Math.max(8, f[1] / maxf * 180) + 'px"></span>' +
          '<span class="n">' + f[1] + ' 次</span></div>';
      }).join('') + '</div>';
    } else {
      html += '<div class="empty" style="padding:20px">暂无信源标注</div>';
    }
    html += '</div>';

    // 反复出现的议题
    var rec = ARCHIVE.recurring_topics || [];
    html += '<div class="arc-block"><h4>反复出现的议题（≥2 个扫描日）</h4>';
    if (rec.length) {
      html += '<div class="tags">' + rec.map(function (r) {
        return '<span class="tag">' + esc(r.topic) + ' · ' + r.count + '日</span>';
      }).join('') + '</div>';
    } else {
      html += '<div class="empty" style="padding:16px">目前仅单一扫描日，随系统运行将自动浮现跨日议题</div>';
    }
    html += '</div>';

    // 重要负面时间线
    var neg = ARCHIVE.important_negatives || [];
    html += '<div class="arc-block"><h4>重要负面报道时间线</h4>';
    if (neg.length) {
      html += '<div class="neg-timeline">' + neg.map(function (n) {
        return '<div class="ev" data-id="' + esc(n.id) + '"><span class="imp-dot"></span>' +
          '<span class="when">' + esc(n.date || '') + '<br>' + esc(n.media || '') + '</span>' +
          '<span class="t">' + esc(n.title_zh || '') + '</span></div>';
      }).join('') + '</div>';
    } else {
      html += '<div class="empty" style="padding:16px">暂无标记负面</div>';
    }
    html += '</div>';

    $('main').innerHTML = html;
    $('main').querySelectorAll('.neg-timeline .ev').forEach(function (el) {
      el.addEventListener('click', function () { openModal(el.dataset.id); });
    });
  }

  function penCard(k, v, sub) {
    return '<div class="pen-card"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="sub">' + sub + '</div></div>';
  }

  /* ===================== 搜索 ===================== */
  function renderSearch() {
    $('main').innerHTML = '<section class="doc-head"><h1>检索</h1>' +
      '<div class="doc-sub">跨全部历史存档检索；在左侧搜索框输入关键词</div></section>' +
      '<section class="list" id="searchResults"></section>';
    var box = $('searchInput');
    runSearch();
    box.focus();
  }

  function runSearch() {
    var q = state.q.trim().toLowerCase();
    var box = $('searchResults');
    if (!box) return;
    var pool = DATA.articles || [];
    var out = pool.filter(function (a) {
      if (!q) return true;
      var hay = [a.title_zh, a.title_en, a.summary_zh, a.china_angle, a.stance,
        (a.authors || []).join(' '), (a.topics || []).join(' '),
        (a.cited_sources || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    out.sort(function (a, b) { return (b.published_at || '').localeCompare(a.published_at || ''); });
    $('searchScope').textContent = q
      ? '命中 ' + out.length + ' / ' + pool.length + ' 篇'
      : '请输入关键词（标题 / 摘要 / 记者 / 信源 / 议题）';
    if (!out.length) { box.innerHTML = '<div class="empty">没有匹配的报道</div>'; return; }
    box.innerHTML = out.map(articleCard).join('');
    box.querySelectorAll('.item').forEach(function (el) {
      el.addEventListener('click', function () { openModal(el.dataset.id); });
    });
  }

  /* ===================== 详情弹层 ===================== */
  function openModal(id) {
    var a = byId(DATA.articles || [], id);
    if (!a) return;
    var p = a.provenance || {};
    var authorTxt = (a.authors && a.authors.length)
      ? esc(a.authors.join('、')) + (a.author_locations ? '　<span style="color:var(--ink-3)">' + esc(a.author_locations) + '</span>' : '')
      : '<span style="color:var(--ink-3)">署名未取得（转载源采集，原始 byline 未保留）</span>';
    var srcTxt = (a.cited_sources && a.cited_sources.length)
      ? a.cited_sources.map(function (s) { return esc(s); }).join('、')
      : '<span style="color:var(--ink-3)">信源未标注（转载源采集，原始引用未保留）</span>';

    var html =
      '<button class="modal-close" id="mClose">&times;</button>' +
      '<div class="item-top">' +
        '<span class="badge ' + (a.media === 'Reuters' ? 'b-reuters' : 'b-bloomberg') + '">' + esc(a.media_zh || a.media) + '</span>' +
        '<span class="imp imp-' + esc(a.importance) + '">重要性 ' + (IMP_TEXT[a.importance] || '中') + '</span>' +
        (a.is_negative ? '<span class="sent-badge negative">负面</span>' : '') +
        (a.body_available ? '<span class="flag">含正文</span>' : '<span class="flag flag-warn">仅标题级</span>') +
      '</div>' +
      '<h2>' + esc(a.title_zh || '') + '</h2>' +
      '<div class="m-en">' + esc(a.title_en || '') + '</div>' +
      '<dl class="m-meta">' +
        '<dt>发布日期</dt><dd>' + esc(a.published_at || '') + '</dd>' +
        '<dt>记者署名</dt><dd>' + authorTxt + '</dd>' +
        '<dt>引用信源</dt><dd>' + srcTxt + '</dd>' +
        '<dt>信息来源</dt><dd>' + esc(a.media_zh || a.media) + '　<a class="m-link" href="' + esc(a.source_url || '#') + '" target="_blank" rel="noopener">原文链接</a></dd>' +
        '<dt>涉华角度</dt><dd>' + esc(a.china_angle || '-') + '</dd>' +
        '<dt>倾向初判</dt><dd>' + esc(a.stance || '-') + '</dd>' +
        '<dt>议题分类</dt><dd>' + (a.topics || []).join('、') + '</dd>' +
      '</dl>' +
      '<div class="m-sec"><h4>中文摘要</h4><p>' + esc(a.summary_zh || '') + '</p></div>' +
      (a.body_zh ? '<div class="m-sec"><h4>正文（中文翻译）</h4><div class="m-body">' +
        esc(a.body_zh).split('\n').map(function (t) { return '<p>' + t + '</p>'; }).join('') + '</div></div>' : '') +
      (a.deep_analysis ? '<div class="m-sec"><h4>深度研判</h4><div class="m-deep"><p>' + esc(a.deep_analysis) + '</p></div></div>' : '') +
      '<div class="m-sec"><h4>采集溯源</h4><div class="m-prov">' +
        '<b>采集方式：</b>' + esc(p.retrieved_via || '-') + '<br>' +
        '<b>证据来源：</b><a href="' + esc(p.evidence_url || '#') + '" target="_blank" rel="noopener">' + esc(p.evidence_url || '-') + '</a><br>' +
        '<b>核验说明：</b>' + esc(p.evidence_note || '-') + (a.scan_batch ? '<br><b>登记批次：</b>' + esc(a.scan_batch) : '') +
      '</div></div>';

    $('modal').innerHTML = html;
    $('modalBackdrop').classList.add('on');
    document.body.style.overflow = 'hidden';
    $('mClose').addEventListener('click', closeModal);
  }

  function closeModal() {
    $('modalBackdrop').classList.remove('on');
    document.body.style.overflow = '';
  }

  /* ===================== 绑定 ===================== */
  function bindCards() {
    document.querySelectorAll('#main .item').forEach(function (el) {
      el.addEventListener('click', function () { openModal(el.dataset.id); });
    });
    document.querySelectorAll('#main .da-neg a').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); openModal(el.dataset.id); });
    });
  }

  function renderMain() {
    if (state.view === 'archive') renderArchive();
    else if (state.view === 'search') renderSearch();
    else renderDay(state.day);
  }

  function renderAll() {
    renderTop();
    renderSidebar();
    renderMain();
  }

  /* 事件 */
  $('brandBtn').addEventListener('click', function () { state.view = 'day'; state.day = DAYS[0]; renderAll(); });
  $('collapseBtn').addEventListener('click', function () { state.collapse = !state.collapse; renderTop(); });
  $('navArchive').addEventListener('click', function () {
    state.view = (state.view === 'archive') ? 'day' : 'archive';
    if (state.view === 'archive') $('searchPanel').hidden = true;
    renderAll();
  });
  $('navSearch').addEventListener('click', function () {
    var toSearch = (state.view !== 'search');
    state.view = toSearch ? 'search' : 'day';
    $('searchPanel').hidden = !toSearch;
    if (toSearch) { renderAll(); } else { renderAll(); }
  });
  $('searchInput').addEventListener('input', function (e) {
    state.q = e.target.value; runSearch();
  });
  $('modalBackdrop').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  renderAll();
})();
