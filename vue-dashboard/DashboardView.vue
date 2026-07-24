<template>
  <div class="dashboard-view">
    <!-- Header -->
    <header class="dashboard-header">
      <div class="logo-area">
        <div class="logo-dot" :class="{ 'live': isConnected }"></div>
        <h1>Vue Live Dashboard & Messenger</h1>
      </div>
      <div class="status-badge" :class="{ 'connected': isConnected }">
        <span class="badge-icon"></span>
        <span>{{ connectionText }}</span>
      </div>
    </header>

    <main class="dashboard-main">
      <!-- Metrics Section -->
      <section class="metrics-grid">
        <div class="metric-card cpu">
          <div class="card-header-icon">📊</div>
          <div class="card-content">
            <div class="metric-label">CPU LOAD</div>
            <div class="metric-value">{{ metrics.cpuLoad }}</div>
            <div class="progress-bar-container">
              <div class="progress-bar" :style="{ width: metrics.cpuLoad }"></div>
            </div>
          </div>
        </div>

        <div class="metric-card users">
          <div class="card-header-icon">👥</div>
          <div class="card-content">
            <div class="metric-label">ACTIVE USERS</div>
            <div class="metric-value">{{ formatNumber(metrics.activeUsers) }}</div>
          </div>
        </div>

        <div class="metric-card uptime">
          <div class="card-header-icon">⏱️</div>
          <div class="card-content">
            <div class="metric-label">SYSTEM UPTIME</div>
            <div class="metric-value">{{ metrics.uptime }}</div>
          </div>
        </div>
      </section>

      <!-- Workspace Interface -->
      <section class="workspace-grid">
        <!-- Contacts Sidebar -->
        <aside class="sidebar">
          <div class="sidebar-title">Active Conversations</div>
          <div class="contacts-list">
            <div 
              v-for="contact in contacts" 
              :key="contact.id" 
              class="contact-item" 
              :class="{ 'active': activeContactId === contact.id }"
              @click="activeContactId = contact.id"
            >
              <div class="avatar-container">
                <div class="avatar" :style="{ background: contact.avatarColor }">
                  {{ contact.name[0] }}
                </div>
                <div class="status-dot" :class="contact.status"></div>
              </div>
              <div class="contact-info">
                <div class="contact-name">{{ contact.name }}</div>
                <div class="contact-status-msg">{{ contact.statusText }}</div>
              </div>
            </div>
          </div>
        </aside>

        <!-- Messenger Box -->
        <section class="messenger">
          <div class="chat-header">
            <div class="active-user-details" v-if="activeContact">
              <div class="avatar mini" :style="{ background: activeContact.avatarColor }">
                {{ activeContact.name[0] }}
              </div>
              <div>
                <h3>{{ activeContact.name }}</h3>
                <span class="online-status">online</span>
              </div>
            </div>
            <div class="ticket-id">Vue Component Native</div>
          </div>

          <!-- Messages Area -->
          <div class="chat-scroller" ref="chatScroller">
            <div 
              v-for="msg in messages" 
              :key="msg.id" 
              class="message-row" 
              :class="[msg.sender === 'user' ? 'me' : (msg.sender === 'system' ? 'system' : 'them')]"
            >
              <div class="message-bubble">
                <div class="message-text">{{ msg.text }}</div>
                <div class="message-meta" v-if="msg.sender !== 'system'">
                  <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
                  <span class="delivery-status" v-if="msg.sender === 'user'" v-html="getStatusIcon(msg.status)"></span>
                </div>
              </div>
            </div>

            <!-- Typing Indicator -->
            <div class="typing-indicator" v-if="isTyping">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
          </div>

          <!-- Form Area -->
          <footer class="chat-footer">
            <form @submit.prevent="sendMessage" class="input-container">
              <input 
                v-model="newMessageText" 
                type="text" 
                placeholder="Type a message to support..." 
                autocomplete="off"
              />
              <button type="submit" :disabled="!newMessageText.trim()">
                Send
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </footer>
        </section>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';

const BACKEND_URL = 'http://localhost:5000';

// Real-time states
const isConnected = ref(false);
const connectionText = ref('Connecting Stream...');
const newMessageText = ref('');
const isTyping = ref(false);
const chatScroller = ref(null);

const metrics = ref({
  cpuLoad: '0%',
  activeUsers: 0,
  uptime: '00:00:00'
});

const messages = ref([]);
const activeContactId = ref(1);

// Static Mock Contacts
const contacts = ref([
  { id: 1, name: 'Support Assistant', status: 'online', statusText: 'Ready to help', avatarColor: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  { id: 2, name: 'System Bot', status: 'online', statusText: 'Performance alerts OK', avatarColor: 'linear-gradient(135deg, #10b981, #047857)' },
  { id: 3, name: 'Network Admin', status: 'away', statusText: 'Away (On Call)', avatarColor: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }
]);

const activeContact = computed(() => {
  return contacts.value.find(c => c.id === activeContactId.value);
});

// SSE Source
let eventSource = null;

// Ticks asset mapping
const STATUS_ICONS = {
  sending: `<svg class="status-icon loading-spin" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="10"></circle></svg>`,
  sent: `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  delivered: `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 6L8.5 14.5L5 11" /><path d="M22 6L13.5 14.5L12 13" /></svg>`,
  read: `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 6L8.5 14.5L5 11" /><path d="M22 6L13.5 14.5L12 13" /></svg>`
};

function getStatusIcon(status) {
  return STATUS_ICONS[status] || '';
}

// Lifecycle Init
onMounted(() => {
  connectSSE();
});

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
});

// Auto-Scroll to bottom when new messages come
watch(messages, () => {
  nextTick(() => {
    scrollToBottom();
  });
}, { deep: true });

function connectSSE() {
  eventSource = new EventSource(`${BACKEND_URL}/api/events`);

  eventSource.onopen = () => {
    isConnected.value = true;
    connectionText.value = 'Stream Connected';
  };

  eventSource.onerror = () => {
    isConnected.value = false;
    connectionText.value = 'Disconnected (Retrying)';
  };

  eventSource.addEventListener('init', (e) => {
    const data = JSON.parse(e.data);
    metrics.value = data.metrics;
    messages.value = data.messages || [];
  });

  eventSource.addEventListener('metrics_update', (e) => {
    metrics.value = JSON.parse(e.data);
  });

  eventSource.addEventListener('message_new', (e) => {
    const msg = JSON.parse(e.data);
    if (!messages.value.find(m => m.id === msg.id)) {
      messages.value.push(msg);
      if (msg.sender === 'bot') {
        isTyping.value = false;
      }
    }
  });

  eventSource.addEventListener('message_status', (e) => {
    const data = JSON.parse(e.data);
    const msg = messages.value.find(m => m.id === data.id);
    if (msg) {
      msg.status = data.status;
    }
  });
}

async function sendMessage() {
  const text = newMessageText.value.trim();
  if (!text) return;

  newMessageText.value = '';

  // Optimistic UI Append
  const tempId = `vue-temp-${Date.now()}`;
  const tempMsg = {
    id: tempId,
    sender: 'user',
    text: text,
    timestamp: new Date().toISOString(),
    status: 'sending'
  };

  messages.value.push(tempMsg);

  // Trigger simulated support response typing after 2 seconds
  setTimeout(() => {
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg && lastMsg.sender !== 'bot') {
      isTyping.value = true;
      nextTick(scrollToBottom);
    }
  }, 2000);

  try {
    const response = await fetch(`${BACKEND_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sender: 'user' })
    });

    if (response.ok) {
      const realMsg = await response.json();
      messages.value = messages.value.filter(m => m.id !== tempId);
      messages.value.push(realMsg);
    } else {
      const msg = messages.value.find(m => m.id === tempId);
      if (msg) msg.status = 'sent';
    }
  } catch (err) {
    console.error('Error posting Vue message:', err);
    const msg = messages.value.find(m => m.id === tempId);
    if (msg) msg.status = 'sent';
  }
}

function scrollToBottom() {
  if (chatScroller.value) {
    chatScroller.value.scrollTop = chatScroller.value.scrollHeight;
  }
}

// Format Helpers
function formatNumber(num) {
  return num ? num.toLocaleString() : '0';
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.dashboard-view {
  background-color: #0b0f19;
  background: radial-gradient(circle at top left, #111827, #0b0f19);
  color: #f3f4f6;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: inherit;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 2rem;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ef4444;
  transition: all 0.3s;
}

.logo-dot.live {
  background: #3b82f6;
  box-shadow: 0 0 12px #3b82f6;
  animation: pulse 2s infinite alternate;
}

@keyframes pulse {
  to { transform: scale(1.15); box-shadow: 0 0 18px #3b82f6; }
}

h1 {
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(90deg, #fff, #9ca3af);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(31, 41, 55, 0.6);
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.85rem;
}

.status-badge .badge-icon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

.status-badge.connected .badge-icon {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.dashboard-main {
  flex: 1;
  padding: 1.5rem;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 1.5rem;
  height: calc(100vh - 75px);
}

/* Metrics styles */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
}

.metric-card {
  background: rgba(22, 30, 49, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  position: relative;
  overflow: hidden;
}

.metric-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
}

.metric-card.cpu::before { background: #3b82f6; }
.metric-card.users::before { background: #10b981; }
.metric-card.uptime::before { background: #8b5cf6; }

.card-header-icon {
  font-size: 1.5rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-content {
  flex: 1;
}

.metric-label {
  font-size: 0.8rem;
  color: #9ca3af;
  margin-bottom: 4px;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #fff;
}

.progress-bar-container {
  height: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
  margin-top: 8px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #3b82f6;
  border-radius: 3px;
  transition: width 0.8s ease;
}

/* Workspace Grid */
.workspace-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  background: rgba(22, 30, 49, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  overflow: hidden;
  height: 100%;
  min-height: 0;
}

/* Sidebar */
.sidebar {
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(15, 23, 42, 0.3);
  display: flex;
  flex-direction: column;
}

.sidebar-title {
  padding: 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.95rem;
  font-weight: 600;
}

.contacts-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  margin-bottom: 6px;
  transition: all 0.2s;
}

.contact-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.contact-item.active {
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.avatar-container {
  position: relative;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.08);
}

.avatar.mini {
  width: 32px;
  height: 32px;
  font-size: 0.8rem;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  position: absolute;
  bottom: 0;
  right: 0;
  border: 2px solid #0f172a;
}

.status-dot.online { background-color: #10b981; }
.status-dot.away { background-color: #f59e0b; }

.contact-info {
  flex: 1;
  overflow: hidden;
}

.contact-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
}

.contact-status-msg {
  font-size: 0.75rem;
  color: #9ca3af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Messenger container */
.messenger {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.chat-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(15, 23, 42, 0.2);
}

.active-user-details {
  display: flex;
  align-items: center;
  gap: 12px;
}

.active-user-details h3 {
  font-size: 0.95rem;
  color: #fff;
}

.online-status {
  font-size: 0.8rem;
  color: #10b981;
}

.ticket-id {
  font-size: 0.8rem;
  color: #9ca3af;
}

.chat-scroller {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Messages */
.message-row {
  display: flex;
  width: 100%;
  opacity: 0;
  transform: translateY(15px);
  animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUp {
  to { opacity: 1; transform: translateY(0); }
}

.message-row.me { justify-content: flex-end; }
.message-row.them { justify-content: flex-start; }
.message-row.system { justify-content: center; }

.message-bubble {
  max-width: 65%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 0.95rem;
  line-height: 1.45;
  position: relative;
}

.me .message-bubble {
  background: #2563eb;
  color: #fff;
  border-bottom-right-radius: 4px;
  box-shadow: 0 4px 15px rgba(37, 99, 235, 0.25);
}

.them .message-bubble {
  background: #1f2937;
  color: #f3f4f6;
  border-bottom-left-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.system .message-bubble {
  background: rgba(31, 41, 55, 0.5);
  color: #9ca3af;
  font-size: 0.8rem;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.message-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 5px;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.6);
}

.them .message-meta {
  color: #9ca3af;
  justify-content: flex-start;
}

.delivery-status {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
}

:deep(.status-icon) {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

:deep(.loading-spin) {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* Typing indicator */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  background: #1f2937;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  width: fit-content;
  margin-top: 4px;
  animation: slideUp 0.25s ease forwards;
}

.typing-indicator .dot {
  width: 6px;
  height: 6px;
  background: #9ca3af;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out both;
}

.typing-indicator .dot:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator .dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Footer layout */
.chat-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(15, 23, 42, 0.3);
}

.input-container {
  display: flex;
  gap: 12px;
}

.input-container input {
  flex: 1;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px 16px;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s;
}

.input-container input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
}

.input-container button {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 0 20px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.input-container button:hover:not(:disabled) {
  background: #2563eb;
}

.input-container button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

@media (max-width: 768px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
  .sidebar {
    display: none;
  }
}
</style>
