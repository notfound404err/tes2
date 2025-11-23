(function () {
  // Primary server endpoint. Can be overridden by setting window.__CHAT_SERVER_URL__
  const SERVER_URL = window.__CHAT_SERVER_URL__ || 'http://localhost:3000/send-message';

  function createPopup() {
    const container = document.createElement('div');
    container.id = 'chat-popup';
    container.innerHTML = `
      <div id="chat-toggle-wrap">
        <button id="chat-toggle" aria-label="Open chat">💬</button>
      </div>
      <div id="chat-panel" aria-hidden="true">
        <div id="chat-header">Kirim pesan kepada Fahri</div>
        <textarea id="chat-input" placeholder="Tulis pesan untuk Fahri..." rows="4"></textarea>
        <div id="chat-actions">
          <button id="chat-send">Kirim</button>
          <button id="chat-close">Tutup</button>
        </div>
        <div id="chat-status" aria-live="polite"></div>
      </div>
    `;
    document.body.appendChild(container);

    // event handlers
    const toggle = document.getElementById('chat-toggle');
    const panel = document.getElementById('chat-panel');
    const close = document.getElementById('chat-close');
    const send = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');
    const status = document.getElementById('chat-status');

    function openPanel() {
      panel.setAttribute('aria-hidden', 'false');
      panel.style.display = 'flex';
      input.focus();
    }
    function closePanel() {
      panel.setAttribute('aria-hidden', 'true');
      panel.style.display = 'none';
    }

    toggle.addEventListener('click', () => {
      if (panel.style.display === 'flex') closePanel();
      else openPanel();
    });
    close.addEventListener('click', closePanel);

    async function sendMessage() {
      const msg = input.value && input.value.trim();
      if (!msg) {
        status.textContent = 'Isi pesan dulu ya.';
        return;
      }
      status.textContent = 'Mengirim...';
      // Try primary URL, if network error try fallback to relative path
      async function doPost(url) {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // send anonymous flag so server can omit identifying info
          body: JSON.stringify({ message: msg, anonymous: true })
        });
        return resp;
      }

      try {
        let resp;
        try {
          resp = await doPost(SERVER_URL);
        } catch (e) {
          console.warn('Primary server failed, trying fallback /send-message', e);
          // fallback to same-origin endpoint
          resp = await doPost('/send-message');
        }

        if (!resp) throw new Error('no-response');

        let json;
        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          json = await resp.json();
        } else {
          const txt = await resp.text();
          // try parse, else wrap
          try { json = JSON.parse(txt); } catch { json = { ok: resp.ok, text: txt }; }
        }

        // Treat any HTTP 2xx as success; prefer JSON.ok when available
        if (resp.ok) {
          // if server returned JSON with ok:false, treat as error
          if (json && Object.prototype.hasOwnProperty.call(json, 'ok') && !json.ok) {
            const errMsg = json.error || json.text || `status ${resp.status}`;
            status.textContent = 'Gagal mengirim: ' + errMsg;
            console.error('Send failed', { resp, json });
          } else {
            status.textContent = 'Terkirim! Pesan telah dikirim ke Fahri.';
            input.value = '';
          }
        } else {
          const errMsg = json && (json.error || json.text) ? (json.error || json.text) : `status ${resp.status}`;
          status.textContent = 'Gagal mengirim: ' + errMsg;
          console.error('Send failed', { resp, json });
        }
      } catch (err) {
        status.textContent = 'Gagal menghubungi server: ' + (err.message || err);
        console.error('SendMessage error', err);
      }
    }

    send.addEventListener('click', sendMessage);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        sendMessage();
      }
    });

    // start closed
    closePanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createPopup);
  } else createPopup();
})();
