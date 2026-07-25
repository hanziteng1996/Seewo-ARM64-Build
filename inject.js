// inject.js — 所有新窗口/新标签页改为同窗口跳转
(function () {
  'use strict';

  // 拦截 window.open → 同窗口跳转
  window.open = function (url) {
    if (url) {
      window.location.href = url;
      return window;
    }
    return null;
  };

  // 拦截 target="_blank" / "_new" 的链接 → 同窗口跳转
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[target="_blank"], a[target="_new"]');
    if (a && a.href) {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = a.href;
    }
  }, true);

  console.log('[inject.js] same-window navigation active.');
})();
