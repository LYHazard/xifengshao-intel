/* 西风哨 - 进入门禁（UI 层，纯前端）
 * 作用：正确输入密码后才加载主应用，拦住未授权访客。
 * 修改密码：把 PASSWORD_HASH 换成你密码的 SHA-256 十六进制串，命令：
 *     echo -n 你的密码 | sha256sum
 * 说明：这是 UI 层门禁，仅挡住普通访客；静态数据文件仍可被技术方式直接访问。
 */
(function () {
  'use strict';

  // 默认密码 xifengshao 的 SHA-256；要改密码，替换下面这串即可。
  var PASSWORD_HASH = '04d5ebbcfa40ab8bcbf47a5b52160ef1c587a2fd1a5e4803b278254d7ec21bc8';

  function showError(msg) {
    var e = document.getElementById('gateErr');
    if (e) { e.textContent = msg; }
  }

  function unlock() {
    var overlay = document.getElementById('gate');
    if (overlay && overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
    // 动态加载主应用（数据已在 data/index.js 中就绪）
    var s = document.createElement('script');
    s.src = 'app.js';
    document.body.appendChild(s);
  }

  function hexFromBuffer(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  function tryUnlock() {
    var inp = document.getElementById('gateInput');
    var val = inp ? inp.value : '';
    if (!val) { showError('请输入密码'); return; }
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(val)).then(function (buf) {
        if (hexFromBuffer(buf) === PASSWORD_HASH) {
          try { sessionStorage.setItem('xfs_unlocked', '1'); } catch (e) {}
          unlock();
        } else {
          showError('密码错误，请重试');
          if (inp) inp.value = '';
        }
      }).catch(function () { showError('校验失败，请重试'); });
    } else if (val === 'xifengshao') {
      // 极旧环境回退
      try { sessionStorage.setItem('xfs_unlocked', '1'); } catch (e) {}
      unlock();
    } else {
      showError('密码错误，请重试');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var already = false;
    try { already = sessionStorage.getItem('xfs_unlocked') === '1'; } catch (e) {}
    if (already) { unlock(); return; }

    var btn = document.getElementById('gateBtn');
    var inp = document.getElementById('gateInput');
    if (btn) { btn.addEventListener('click', tryUnlock); }
    if (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); }
      });
      inp.focus();
    }
  });
})();
