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


let englishVoice = null;

    //  本地 ASR 模块
    let asrPipeline = null;
    let asrReady = false;
    
    // 初始化本地 Whisper 模型
    async function initLocalASR() {
      if (asrPipeline || asrReady) return;
      
      console.log(' 开始加载本地 Whisper 模型（从 CDN）...');
      
      try {
        // ✅ 使用 CDN 版本，不需要构建工具
        const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
        
        // 加载 Whisper Tiny 模型（约 75MB，首次需要下载）
        asrPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
        asrReady = true;
        
        console.log('✅ 本地 Whisper 模型加载完成！');
        
        return true;
      } catch (error) {
        console.error('❌ ASR 模型加载失败:', error);
        return false;
      }
    }
    
    // 使用本地 ASR 转录音频
    async function transcribeWithLocalASR(audioBlob) {
      if (!asrReady || !asrPipeline) {
        console.warn('⚠️ 本地 ASR 未就绪');
        return null;
      }
      
      try {
        console.log(' 开始本地转录，音频大小:', (audioBlob.size / 1024).toFixed(2), 'KB');
        
        // 1. 转换为 ArrayBuffer
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        // 2. 使用 Web Audio API 解码音频
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000 // Whisper 推荐采样率
        });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // 3. 提取单声道音频数据
        const audioData = audioBuffer.getChannelData(0);
        
        console.log(' 音频数据准备完成，长度:', audioData.length, '样本');
        console.log(' 开始 Whisper 识别...');
        
        // 4. 调用 Whisper 模型转录
        const result = await asrPipeline(audioData, {
          // ✅ 不指定 language，让 Whisper 自动检测
          task: 'transcribe',
          return_timestamps: false
        });
        
        console.log('✅ 转录完成:', result.text);
        return result.text?.trim() || null;
        
      } catch (error) {
        console.error('❌ 本地转录失败:', error);
        return null;
      }
    }

    function loadVoices() {
      const voices = window.speechSynthesis.getVoices();
      englishVoice = voices.find(v => /^en(-|_|$)/i.test(v.lang)) || null;
    }


if (window.speechSynthesis) {
  loadVoices();

  window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
}


// audio
let mediaStream = null;
let mediaRecorder = null;
let mediaChunks = [];

async function startMicRecording() {
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(mediaStream);
  mediaChunks = [];
  mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) mediaChunks.push(e.data); };
  mediaRecorder.start();
}

function stopMicTracks() {
  try { mediaStream?.getTracks()?.forEach(t => t.stop()); } catch {}
  mediaStream = null;
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(blob);
  });
}

async function stopMicRecordingToDataUrl() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return null;
  await new Promise((resolve) => {
    mediaRecorder.onstop = resolve;
    mediaRecorder.stop();
  });
  stopMicTracks();
  const blob = new Blob(mediaChunks, { type: 'audio/webm' }); // 兼容 Chrome
  return await blobToDataUrl(blob); // data:audio/webm;base64,...
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

    //  初始化本地 ASR（后台异步加载）
    console.log(' 页面加载，开始初始化本地 ASR...');
    initLocalASR().then(success => {
      if (success && elMic) {
        elMic.title = ' 使用本地 Whisper 模型进行语音识别';
        console.log(' 麦克风已就绪，可以开始录音');
      }
    });

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

    // function renderMessages(chatId) {
    //   const map = getMessagesMap();
    //   const msgs = map[chatId] || [];
    //   elMessages.innerHTML = '';
    //   for (const m of msgs) {
    //     const div = document.createElement('div');
    //     div.className = 'bubble ' + (m.role === 'user' ? 'user' : (m.role === 'error' ? 'error' : 'assistant'));
    //     div.textContent = m.text;
    //     elMessages.appendChild(div);
    //   }
    //   elMessages.scrollTop = elMessages.scrollHeight;
    // }

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

    // function addMessage(chatId, role, text) {
    //   const map = getMessagesMap();
    //   const arr = map[chatId] || [];
    //   arr.push({ id: uuid(), role, text, createdAt: nowIso() });
    //   map[chatId] = arr;
    //   setMessagesMap(map);
    //   renderMessages(chatId);
    //   refreshUsage();
    // }

   function addMessage(chatId, role, text, extra = {}) {
  const map = getMessagesMap();
  const arr = map[chatId] || [];
  arr.push({ id: uuid(), role, text, createdAt: nowIso(), ...extra }); // 支持 audioDataUrl
  map[chatId] = arr;
  setMessagesMap(map);
  renderMessages(chatId);
  refreshUsage();
}

// ask api place
function assistantRespond(cid, userText) {

  setTimeout(() => {
    if (Math.random() < 0.2) {
      addMessage(cid, 'error', 'Demo: No backend/LLM configured. This is a simulated failure.');
    } else {
      const reply = `Demo reply (mock): ${userText.toUpperCase()}`;
      addMessage(cid, 'assistant', reply);

      if (window.speechSynthesis) {
        const utter = new SpeechSynthesisUtterance(reply);
        utter.lang = 'en-US';
        if (englishVoice) utter.voice = englishVoice;
        window.speechSynthesis.speak(utter);
      }
    }
  }, 400);
}

function renderMessages(chatId) {
  const map = getMessagesMap();
  const msgs = map[chatId] || [];
  elMessages.innerHTML = '';
  for (const m of msgs) {
    const div = document.createElement('div');
    // voice 消息沿用用户 or 助手样式，这里仍按 role 渲染
    div.className = 'bubble ' + (m.role === 'user' ? 'user' : (m.role === 'error' ? 'error' : 'assistant'));

    if (m.audioDataUrl) {

      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = m.audioDataUrl;
      audio.style.display = 'block';
      audio.style.marginBottom = '8px';

      const caption = document.createElement('div');
      caption.style.fontSize = '12px';
      caption.style.color = '#666';
      caption.style.fontStyle = 'italic';
      caption.style.marginTop = '4px';
      caption.style.padding = '4px 8px';
      caption.style.background = 'rgba(0,0,0,0.05)';
      caption.style.borderRadius = '4px';
      
      //  显示识别方式标记
      let methodBadge = '';
      if (m.asrMethod === 'whisper-local') {
        methodBadge = '<span style="color: #28a745; font-weight: bold;"> ASR result</span>';
      } else if (m.asrMethod === 'browser-api') {
        methodBadge = '<span style="color: #007bff;"> 浏览器 API</span>';
      }
      
      caption.innerHTML = `${methodBadge}: ${m.text || '(no transcript)'}`;

      div.appendChild(audio);
      div.appendChild(caption);
    } else {

      div.textContent = m.text;
    }

    elMessages.appendChild(div);
  }
  elMessages.scrollTop = elMessages.scrollHeight;
}

    // function sendMessage(text) {
    //   const trimmed = text.trim();
    //   if (!trimmed) return;
    //   const used = getDailyUserMessageCount(userEmail);
    //   const max = entitlements[userType].maxMessagesPerDay;
    //   if (used >= max) {
    //     addMessage(currentChatId || ensureChat(), 'error', 'Rate limit reached for your user type.');
    //     return;
    //   }
    //   const cid = currentChatId || ensureChat();
    //   addMessage(cid, 'user', trimmed);
    //   elInput.value = '';
    //   // Mock assistant: sometimes fail, otherwise echo with slight transform
    //   setTimeout(() => {
    //     if (Math.random() < 0.2) {
    //       addMessage(cid, 'error', 'Demo: No backend/LLM configured. This is a simulated failure.');
    //     } else {
    //       const reply = `Demo reply (mock): ${trimmed.toUpperCase()}`;
    //       addMessage(cid, 'assistant', reply);
    //       // Optional: speak the reply
    //       if (window.speechSynthesis) {
    //         const utter = new SpeechSynthesisUtterance(reply);
    //         utter.lang = 'en-US';
    //         if (englishVoice) utter.voice = englishVoice;
    //         window.speechSynthesis.speak(utter);
    //
    //       }
    //
    //
    //
    //     }
    //   }, 400);
    // }

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
  assistantRespond(cid, trimmed);
}

    elSend.addEventListener('click', () => sendMessage(elInput.value));
    elInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(elInput.value); }
    });

    // Voice input via Web Speech API
        //  纯本地语音识别（不使用 Google API）
    let recognizing = false;

    // 检查是否支持录音
    if (!navigator.mediaDevices?.getUserMedia) {
      elMic.disabled = true;
      elMic.title = '浏览器不支持录音功能';
    } else {
      elMic.title = ' 点击录音（使用本地 Whisper 识别）';
      
      elMic.addEventListener('click', async () => {
        if (recognizing) {
          // 停止录音
          recognizing = false;
          elMic.textContent = '🎤';
          
          console.log(' 停止录音，开始处理...');
          
          // 获取录音数据
          const audioDataUrl = await stopMicRecordingToDataUrl();
          
          if (mediaChunks.length === 0) {
            console.warn('⚠️ 没有录音数据');
            return;
          }
          
          const audioBlob = new Blob(mediaChunks, { type: 'audio/webm' });
          console.log(' 录音大小:', (audioBlob.size / 1024).toFixed(2), 'KB');
          
          //  使用本地 Whisper 识别
          console.log(' 开始本地 Whisper 识别...');
          const transcriptText = await transcribeWithLocalASR(audioBlob);
          
          if (!transcriptText || transcriptText.length === 0) {
            console.error('❌ 识别失败');
            alert('语音识别失败，请重试');
            return;
          }
          
          console.log('✅ 识别成功:', transcriptText);
          
          // 保存消息
          const cid = currentChatId || ensureChat();
          addMessage(cid, 'user', transcriptText, { 
            audioDataUrl,
            asrMethod: 'whisper-local'
          });
          
          // 触发助手回复
          assistantRespond(cid, transcriptText);
          
        } else {
          // 开始录音
          try {
            recognizing = true;
            elMic.textContent = '⏺';
            console.log(' 开始录音...');
            await startMicRecording();
          } catch (error) {
            console.error('❌ 录音失败:', error);
            recognizing = false;
            elMic.textContent = '🎤';
            alert('无法访问麦克风，请检查权限设置');
          }
        }
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
