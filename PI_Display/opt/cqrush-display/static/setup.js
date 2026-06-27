(() => {
  const wifiList = document.getElementById('wifi-list');
  const wifiStatus = document.getElementById('wifi-status');
  const scanBtn = document.getElementById('scan-btn');
  const form = document.getElementById('setup-form');
  const formMessage = document.getElementById('form-message');
  const saveBtn = document.getElementById('save-btn');

  let selectedSsid = '';

  function setStatus(el, text, kind) {
    el.textContent = text || '';
    el.classList.remove('error', 'success');
    if (kind) {
      el.classList.add(kind);
    }
  }

  function renderNetworks(networks) {
    wifiList.innerHTML = '';
    if (!networks.length) {
      setStatus(wifiStatus, 'No networks found. Move closer to your router and scan again.', 'error');
      return;
    }

    setStatus(wifiStatus, `${networks.length} network(s) found. Select one below.`, 'success');

    networks.forEach((network) => {
      const label = document.createElement('label');
      label.className = 'wifi-item';
      label.innerHTML = `
        <input type="radio" name="wifi_ssid" value="${escapeHtml(network.ssid)}">
        <span>${escapeHtml(network.ssid)}</span>
        <span class="wifi-meta">${network.signal}% · ${escapeHtml(network.security)}</span>
      `;

      const input = label.querySelector('input');
      input.addEventListener('change', () => {
        selectedSsid = network.ssid;
        wifiList.querySelectorAll('.wifi-item').forEach((item) => item.classList.remove('selected'));
        label.classList.add('selected');
      });

      if (network.in_use) {
        selectedSsid = network.ssid;
        input.checked = true;
        label.classList.add('selected');
      }

      wifiList.appendChild(label);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function scanWifi() {
    scanBtn.disabled = true;
    setStatus(wifiStatus, 'Scanning…', null);
    try {
      const response = await fetch('/api/wifi/scan');
      const data = await response.json();
      renderNetworks(data.networks || []);
    } catch (error) {
      setStatus(wifiStatus, 'Scan failed. Try again.', 'error');
    } finally {
      scanBtn.disabled = false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const displayUrl = document.getElementById('display_url').value.trim();
    const password = document.getElementById('wifi_password').value;
    const checked = wifiList.querySelector('input[name="wifi_ssid"]:checked');
    const ssid = checked ? checked.value : selectedSsid;

    if (!ssid) {
      setStatus(formMessage, 'Select a Wi‑Fi network first.', 'error');
      return;
    }

    saveBtn.disabled = true;
    setStatus(formMessage, 'Saving settings and connecting…', null);

    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid,
          password,
          display_url: displayUrl,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Setup failed');
      }
      setStatus(formMessage, data.message, 'success');
      setTimeout(async () => {
        await fetch('/api/reboot', { method: 'POST' });
      }, 1500);
    } catch (error) {
      setStatus(formMessage, error.message || 'Setup failed', 'error');
      saveBtn.disabled = false;
    }
  });

  scanBtn.addEventListener('click', scanWifi);
  scanWifi();
})();
