// Capital Street as an Android / iPhone app (Capacitor). Does nothing in a browser.
// Back button closes the open panel instead of leaving the city; the game saves when the app goes to the background.
'use strict';
(function () {
  const P = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins;
  if (!P) return;
  const $ = id => document.getElementById(id);
  if (P.StatusBar) P.StatusBar.hide().catch(() => {});
  if (!P.App) return;
  P.App.addListener('pause', () => window.Market && Market.save());
  P.App.addListener('backButton', () => {
    if (window.PC && !$('settings').hidden) { PC.closeSettings(); return; }
    if (window.PC && !$('pause').hidden) { PC.closePause(); return; }
    for (const id of ['net', 'listing', 'cityCard', 'ostaff', 'otray', 'props', 'bank', 'ex']) if ($(id) && !$(id).hidden) { $(id).hidden = true; return; }
    if (window.Office && Office.active()) { $('oDone').click(); return; }
    if (window.Market) Market.save();
    P.App.minimizeApp();
  });
})();
