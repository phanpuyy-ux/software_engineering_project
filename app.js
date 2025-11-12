// front_test/app.js
// Self-contained demo logic: auth, chat, history, limits, voice (no backend).

(function () {
  const KEYS = {
    users: 'ft_users', // array of { email, passwordHash }
    currentUser: 'ft_current_user', // email | null
    chats: 'ft_chats', // array of { id, title, createdAt, userEmail|null }
    messages: 'ft_messages', // map chatId -> array of { id, role, text, createdAt }
  };

  // Simple hash substitute for demo (NOT secure)
  const hash = (s) => btoa(unescape(encodeURIComponent(s)));
  const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const nowIso = () => new Date().toISOString();

  const load = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const getUsers = () => load(KEYS.users, []);
  const setUsers = (arr) => { save(KEYS.users, arr); remoteSave(KEYS.users, arr); };
  const getCurrentEmail = () => load(KEYS.currentUser, null);
  const setCurrentEmail = (emailOrNull) => save(KEYS.currentUser, emailOrNull);

  const getChats = () => load(KEYS.chats, []);
  const setChats = (arr) => { save(KEYS.chats, arr); remoteSave(KEYS.chats, arr); };
  const getMessagesMap = () => load(KEYS.messages, {});
  const setMessagesMap = (obj) => { save(KEYS.messages, obj); remoteSave(KEYS.messages, obj); };

  // Remote persistence via Vercel Blob (API) with local fallback
  async function remoteLoad(key, fallback) {
    try {
      const res = await fetch(`/api/storage?key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error('remote read failed');
      const json = await res.json();
      if (json && 'value' in json && json.value != null) {
        save(key, json.value);
        return json.value;
      }
    } catch {}
    return fallback;
  }

  async function remoteSave(key, value) {
    try {
      await fetch('/api/storage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
    } catch {}
  }

  const getUserType = () => (getCurrentEmail() ? 'regular' : 'guest');
  const entitlements = { guest: { maxMessagesPerDay: 20 }, regular: { maxMessagesPerDay: 100 } };

  const withinLastHours = (iso, hours) => (Date.now() - new Date(iso).getTime()) <= hours * 3600 * 1000;

  function getDailyUserMessageCount(emailOrNull) {
    const allChats = getChats().filter(c => c.userEmail === emailOrNull);
    const map = getMessagesMap();
    let count = 0;
    for (const c of allChats) {
      const msgs = map[c.id] || [];
      for (const m of msgs) {
        if (m.role === 'user' && withinLastHours(m.createdAt, 24)) count++;
      }
    }
    return count;
  }

  // AUTH PAGES
  function initRegisterPage() {
    const form = document.getElementById('register-form');
    const info = document.getElementById('register-info');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = form.email.value.trim().toLowerCase();
      const password = form.password.value;
      if (!email || !password) return alert('Email and password are required.');
      const users = getUsers();
      if (users.some(u => u.email === email)) return alert('Account already exists.');
      const verifyToken = uuid();
      users.push({ email, passwordHash: hash(password), isVerified: false, verifyToken, resetToken: null });
      setUsers(users);
      // Simulate sending confirmation email
      const confirmLink = `${location.origin}${location.pathname.replace(/\/[^/]*$/, '/') }confirm.html?token=${encodeURIComponent(verifyToken)}`;
      if (info) {
        info.innerHTML = `We sent a confirmation email to <b>${email}</b>. (Demo) Use this link to confirm: <a class="link" href="${confirmLink}">${confirmLink}</a>`;
      }
      // Try to send a real confirmation email via API (Resend)
      (async () => {
        try {
          const confirmLink = `${location.origin}${location.pathname.replace(/\/[^/]*$/, '/') }confirm.html?token=${encodeURIComponent(verifyToken)}`;
          await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: email, subject: 'Confirm your account', html: `<p>Click to confirm: <a href=\"${confirmLink}\">${confirmLink}</a></p>` })
          });
        } catch {}
      })();
      form.reset();
      // Attempt to send a real reset email via API
      (async () => {
        try {
          const u = (getUsers() || []).find(x => x.email === email);
          if (!u || !u.resetToken) return;
          const resetLink = `${location.origin}${location.pathname.replace(/\/[^/]*$/, '/') }reset.html?token=${encodeURIComponent(u.resetToken)}`;
          await fetch('/api/email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: email, subject: 'Reset your password', html: `<p>Reset password: <a href=\"${resetLink}\">${resetLink}</a></p>` })
          });
        } catch {}
      })();
    });
  }

  function initLoginPage() {
    const form = document.getElementById('login-form');
    const info = document.getElementById('login-info');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = form.email.value.trim().toLowerCase();
      const password = form.password.value;
      const users = getUsers();
      const user = users.find(u => u.email === email);
      if (!user) return alert('Invalid credentials.');
      if (user.passwordHash !== hash(password)) return alert('Invalid credentials.');
      if (!user.isVerified) {
        // Allow resend
        const newToken = uuid();
        user.verifyToken = newToken;
        setUsers(users);
        // Re-send real email if API is configured
        (async () => {
          try {
            const confirmLink = `${location.origin}${location.pathname.replace(/\/[^/]*$/, '/') }confirm.html?token=${encodeURIComponent(newToken)}`;
            await fetch('/api/email', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: email, subject: 'Confirm your account', html: `<p>Click to confirm: <a href=\"${confirmLink}\">${confirmLink}</a></p>` })
            });
          } catch {}
        })();
        const confirmLink = `${location.origin}${location.pathname.replace(/\/[^/]*$/, '/') }confirm.html?token=${encodeURIComponent(newToken)}`;
        if (info) info.innerHTML = `Your account is not verified. (Demo) Use this link to confirm: <a class="link" href="${confirmLink}">${confirmLink}</a>`;
        return;
      }
      setCurrentEmail(email);
      window.location.href = 'index.html';
    });
  }

  // CHAT PAGE
  function initChatPage() {
    const elUser = document.getElementById('user-label');
    const elLimit = document.getElementById('limit-label');
    const elLogout = document.getElementById('logout');
    const elNewChat = document.getElementById('new-chat');
    const elHistory = document.getElementById('history');
    const elMessages = document.getElementById('messages');
    const elInput = document.getElementById('composer-input');
    const elSend = document.getElementById('send');
    const elMic = document.getElementById('mic');

    if (!elMessages) return; // Not the chat page

    // State
    let currentChatId = null;
    const userEmail = getCurrentEmail();
    const userType = getUserType();

    // Header info
    elUser.textContent = userEmail ? `Signed in as ${userEmail}` : 'Guest';
    elLogout.style.display = userEmail ? 'inline-flex' : 'none';
    elLogout.addEventListener('click', () => { setCurrentEmail(null); window.location.reload(); });

    function usageTextAndClass() {
      const used = getDailyUserMessageCount(userEmail);
      const max = entitlements[userType].maxMessagesPerDay;
      let cls = 'usage ok';
      if (used >= max) cls = 'usage limit';
      else if (used >= Math.floor(max * 0.8)) cls = 'usage warn';
      return { text: `Daily messages: ${used}/${max} (${userType})`, cls };
    }

    function refreshUsage() {
      const u = usageTextAndClass();
      elLimit.className = u.cls;
      elLimit.textContent = u.text;
    }
    refreshUsage();

    function listChats() {
      const chats = getChats().filter(c => c.userEmail === userEmail);
      // sort newest first
      chats.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      elHistory.innerHTML = '';
      if (chats.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'history-empty';
        empty.textContent = 'No conversations yet. Start a new one!';
        elHistory.appendChild(empty);
        return;
      }
      for (const c of chats) {
        const item = document.createElement('div');
        item.className = 'history-item' + (c.id === currentChatId ? ' active' : '');
        item.textContent = c.title || '(untitled)';
        item.onclick = () => { openChat(c.id); };
        elHistory.appendChild(item);
      }
    }

    function ensureChat() {
      if (currentChatId) return currentChatId;
      const chats = getChats();
      const id = uuid();
      const title = 'New chat ' + new Date().toLocaleTimeString();
      const chat = { id, title, createdAt: nowIso(), userEmail: userEmail };
      chats.push(chat);
      setChats(chats);
      currentChatId = id;
      listChats();
      return id;
    }

    function renderMessages(chatId) {
      const map = getMessagesMap();
      const msgs = map[chatId] || [];
      elMessages.innerHTML = '';
      for (const m of msgs) {
        const div = document.createElement('div');
        div.className = 'bubble ' + (m.role === 'user' ? 'user' : (m.role === 'error' ? 'error' : 'assistant'));
        div.textContent = m.text;
        elMessages.appendChild(div);
      }
      elMessages.scrollTop = elMessages.scrollHeight;
    }

    function openChat(id) {
      currentChatId = id;
      listChats();
      renderMessages(id);
    }

    elNewChat.addEventListener('click', () => {
      currentChatId = null;
      ensureChat();
      openChat(currentChatId);
    });

    function addMessage(chatId, role, text) {
      const map = getMessagesMap();
      const arr = map[chatId] || [];
      arr.push({ id: uuid(), role, text, createdAt: nowIso() });
      map[chatId] = arr;
      setMessagesMap(map);
      renderMessages(chatId);
      refreshUsage();
    }

    function sendMessage(text) {
      const trimmed = text.trim();
      if (!trimmed) return;
      const used = getDailyUserMessageCount(userEmail);
      const max = entitlements[userType].maxMessagesPerDay;
      if (used >= max) {
        addMessage(currentChatId || ensureChat(), 'error', 'Rate limit reached for your user type.');
        return;
      }
      const cid = currentChatId || ensureChat();
      addMessage(cid, 'user', trimmed);
      elInput.value = '';
      // Mock assistant: sometimes fail, otherwise echo with slight transform
      setTimeout(() => {
        if (Math.random() < 0.2) {
          addMessage(cid, 'error', 'Demo: No backend/LLM configured. This is a simulated failure.');
        } else {
          const reply = `Demo reply (mock): ${trimmed.toUpperCase()}`;
          addMessage(cid, 'assistant', reply);
          // Optional: speak the reply
          if (window.speechSynthesis) {
            const utter = new SpeechSynthesisUtterance(reply);
            window.speechSynthesis.speak(utter);
          }
        }
      }, 400);
    }

    elSend.addEventListener('click', () => sendMessage(elInput.value));
    elInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(elInput.value); }
    });

    // Voice input via Web Speech API
    let recognizing = false;
    let recognition = null;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      elMic.disabled = true;
      elMic.title = 'Voice not supported by this browser.';
    } else {
      recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (evt) => {
        const transcript = Array.from(evt.results).map(r => r[0].transcript).join(' ');
        elInput.value = (elInput.value + ' ' + transcript).trim();
      };
      recognition.onend = () => { recognizing = false; elMic.textContent = '🎤'; };
      recognition.onerror = () => { recognizing = false; elMic.textContent = '🎤'; };
      elMic.addEventListener('click', () => {
        if (!recognition) return;
        if (recognizing) { recognition.stop(); return; }
        try { recognizing = true; elMic.textContent = '⏺'; recognition.start(); } catch {}
      });
    }

    // Bootstrap: open the latest chat for this user
    const existing = getChats().filter(c => c.userEmail === userEmail)
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (existing[0]) { openChat(existing[0].id); } else { ensureChat(); openChat(currentChatId); }
  }

  // FORGOT PASSWORD PAGE
  function initForgotPage() {
    const form = document.getElementById('forgot-form');
    const info = document.getElementById('forgot-info');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = form.email.value.trim().toLowerCase();
      const users = getUsers();
      const user = users.find(u => u.email === email);
      if (user) {
        user.resetToken = uuid();
        setUsers(users);
        const resetLink = `${location.origin}${location.pathname.replace(/\/[^/]*$/, '/') }reset.html?token=${encodeURIComponent(user.resetToken)}`;
        if (info) info.innerHTML = `If the email exists, a reset link has been sent. (Demo) Use this link: <a class="link" href="${resetLink}">${resetLink}</a>`;
      } else {
        if (info) info.textContent = 'If the email exists, a reset link has been sent.';
      }
      form.reset();
    });
  }

  // RESET PASSWORD PAGE
  function initResetPage() {
    const form = document.getElementById('reset-form');
    const info = document.getElementById('reset-info');
    if (!form) return;
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const users = getUsers();
    const user = users.find(u => u.resetToken && u.resetToken === token);
    if (!token || !user) {
      if (info) info.textContent = 'Invalid or expired reset link.';
      form.style.display = 'none';
      return;
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const password = form.password.value;
      if (!password || password.length < 6) return alert('Password must be at least 6 characters.');
      user.passwordHash = hash(password);
      user.resetToken = null;
      setUsers(users);
      if (info) info.textContent = 'Password updated. You can now log in.';
      form.reset();
    });
  }

  // CONFIRM EMAIL PAGE
  function initConfirmPage() {
    const el = document.getElementById('confirm-result');
    if (!el) return;
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const users = getUsers();
    const user = users.find(u => u.verifyToken && u.verifyToken === token);
    if (!token || !user) {
      el.textContent = 'Invalid or expired confirmation link.';
      return;
    }
    user.isVerified = true;
    user.verifyToken = null;
    setUsers(users);
    el.textContent = `Email confirmed for ${user.email}. You can log in now.`;
  }

  async function hydrateFromRemote() {
    const users = await remoteLoad(KEYS.users, getUsers());
    save(KEYS.users, users ?? []);
    const chats = await remoteLoad(KEYS.chats, getChats());
    save(KEYS.chats, chats ?? []);
    const msgs = await remoteLoad(KEYS.messages, getMessagesMap());
    save(KEYS.messages, msgs ?? {});
  }

  // Wire per-page init (await remote hydration)
  document.addEventListener('DOMContentLoaded', () => {
    (async () => {
      await hydrateFromRemote();
      initRegisterPage();
      initLoginPage();
      initChatPage();
      initForgotPage();
      initResetPage();
      initConfirmPage();
    })();
  });
})();
