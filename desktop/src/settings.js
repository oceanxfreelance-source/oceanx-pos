const $ = (id) => document.getElementById(id);
let defaults = '';
(async () => {
  const s = await window.settingsApi.load();
  defaults = s.defaultServerUrl;
  $('server').value = s.serverUrl;
  $('fullscreen').checked = s.fullscreen;
  $('msg').textContent = 'Version ' + s.version;
  const printers = await window.settingsApi.printers();
  const sel = $('printer');
  const add = (value, text) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    sel.appendChild(o);
  };
  add('', 'Ask every time (print window)');
  for (const p of printers) add(p.name, p.displayName + (p.isDefault ? ' (default)' : ''));
  sel.value = printers.some((p) => p.name === s.printer) ? s.printer : '';
})();
$('reset').onclick = (e) => {
  e.preventDefault();
  $('server').value = defaults;
};
$('test').onclick = async () => {
  $('msg').textContent = 'Printing…';
  const r = await window.settingsApi.testPrint($('printer').value);
  $('msg').textContent = r.ok ? 'Test page sent to the printer.' : 'Could not print: ' + (r.reason || 'unknown');
};
$('save').onclick = async () => {
  await window.settingsApi.save({ printer: $('printer').value, serverUrl: $('server').value.trim(), fullscreen: $('fullscreen').checked });
  window.settingsApi.close();
};
$('cancel').onclick = () => window.settingsApi.close();
