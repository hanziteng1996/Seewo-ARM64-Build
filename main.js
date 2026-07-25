// ===================== 粘到 main.js【最末尾】开始 =====================

// 修复1：去掉顶部多出来的菜单栏（File / Edit / View / Window / Help）
require('electron').Menu.setApplicationMenu(null);

// 修复2：把网页里的 window.close() 偷换成“后退”。
//   这样点“关闭课件”= 返回首页，而不是退出整个 app。
//   用 web-contents-created 全局拦截：主窗口 + 所有 iframe 都覆盖，
//   且【不影响】你点窗口右上角 X 正常退出。
require('electron').app.on('web-contents-created', function (event, wc) {
  wc.on('did-finish-load', function () {
    wc.executeJavaScript(`
      (function () {
        if (window.__seewoClosePatched) return;
        window.__seewoClosePatched = true;
        window.close = function () {
          try {
            var t = window.top;
            if (t && t !== window && t.history && t.history.length > 1) {
              t.history.back();   // 在 iframe 里：让顶层窗口后退
              return;
            }
          } catch (e) {}
          if (window.history && window.history.leng
