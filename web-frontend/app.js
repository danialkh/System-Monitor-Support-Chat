const BACKEND_URL = 'http://localhost:5005';
let eventSource = null;
let usePollingFallback = false;
let pollingIntervals = [];

// DOM Elements
const connectionBadge = document.getElementById('connectionBadge');
const connectionText = document.getElementById('connectionText');
const cpuValue = document.getElementById('cpuValue');
const cpuBar = document.getElementById('cpuBar');
const usersValue = document.getElementById('usersValue');
const uptimeValue = document.getElementById('uptimeValue');
const chatHistory = document.getElementById('chatHistory');
const typingIndicator = document.getElementById('typingIndicator');
const inputForm = document.getElementById('inputForm');
const messageInput = document.getElementById('messageInput');

// In-Memory message status tracking
let messagesList = [];

// Delivery status check SVGs
const STATUS_ICONS = {
  sending: `
    <svg class="status-icon status-sending-icon" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.4)" stroke-width="2.5">
      <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="10"></circle>
    </svg>`,
  sent: `
    <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`,
  delivered: `
    <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 6L8.5 14.5L5 11" />
      <path d="M22 6L13.5 14.5L12 13" />
    </svg>`,
  read: `
    <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 2px rgba(96, 165, 250, 0.5));">
      <path d="M17 6L8.5 14.5L5 11" />
      <path d="M22 6L13.5 14.5L12 13" />
    </svg>`
};

// Initialize Connection
function init() {
  setupSSE();
  setupForm();
}

// Set up Server-Sent Events (SSE)
function setupSSE() {
  console.log('Connecting to SSE stream...');
  eventSource = new EventSource(`${BACKEND_URL}/api/events`);

  eventSource.onopen = () => {
    console.log('SSE connection successfully opened');
    setConnectedState(true, 'Live Stream Active');
    if (usePollingFallback) {
      stopFallbackPolling();
    }
  };

  eventSource.onerror = (err) => {
    console.warn('SSE connection failed. Switching to HTTP polling fallback...', err);
    setConnectedState(false, 'Polling Fallback');
    eventSource.close();
    startFallbackPolling();
  };

  // SSE Custom Event: init
  eventSource.addEventListener('init', (e) => {
    try {
      const data = JSON.parse(e.data);
      updateMetrics(data.metrics);
      
      // Load initial message history
      chatHistory.innerHTML = '';
      messagesList = data.messages || [];
      messagesList.forEach(msg => appendMessageDOM(msg, false));
      scrollToBottom();
    } catch (err) {
      console.error('Error parsing init event', err);
    }
  });

  // SSE Custom Event: metrics_update
  eventSource.addEventListener('metrics_update', (e) => {
    try {
      const metrics = JSON.parse(e.data);
      updateMetrics(metrics);
    } catch (err) {
      console.error('Error parsing metrics_update event', err);
    }
  });

  // SSE Custom Event: message_new
  eventSource.addEventListener('message_new', (e) => {
    try {
      const msg = JSON.parse(e.data);
      // Avoid duplicate appending
      if (!messagesList.find(m => m.id === msg.id)) {
        messagesList.push(msg);
        appendMessageDOM(msg, true);
        
        // If message is from bot, hide typing indicator
        if (msg.sender === 'bot') {
          hideTypingIndicator();
        }
      }
    } catch (err) {
      console.error('Error parsing message_new event', err);
    }
  });

  // SSE Custom Event: message_status
  eventSource.addEventListener('message_status', (e) => {
    try {
      const data = JSON.parse(e.data); // { id, status }
      updateMessageStatusDOM(data.id, data.status);
    } catch (err) {
      console.error('Error parsing message_status event', err);
    }
  });
}

// Fallback HTTP Polling
function startFallbackPolling() {
  if (usePollingFallback) return; // Already polling
  usePollingFallback = true;
  console.log('Starting HTTP Polling...');

  // Fetch initial messages history
  fetchMessages();

  // Metrics Polling every 3s
  const metricsPoll = setInterval(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/metrics`);
      if (res.ok) {
        const metrics = await res.json();
        updateMetrics(metrics);
        setConnectedState(true, 'Polling (OK)');
      }
    } catch (e) {
      setConnectedState(false, 'Polling Offline');
    }
  }, 3000);

  // Messages/Status Polling every 1.5s
  const messagesPoll = setInterval(fetchMessages, 1500);

  pollingIntervals.push(metricsPoll, messagesPoll);
}

function stopFallbackPolling() {
  console.log('Stopping HTTP Polling...');
  usePollingFallback = false;
  pollingIntervals.forEach(clearInterval);
  pollingIntervals = [];
}

async function fetchMessages() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/messages`);
    if (res.ok) {
      const msgs = await res.json();
      
      // Update statuses and check for new ones
      msgs.forEach(msg => {
        const existing = messagesList.find(m => m.id === msg.id);
        if (!existing) {
          messagesList.push(msg);
          appendMessageDOM(msg, true);
          if (msg.sender === 'bot') {
            hideTypingIndicator();
          }
        } else if (existing.status !== msg.status) {
          existing.status = msg.status;
          updateMessageStatusDOM(msg.id, msg.status);
        }
      });
    }
  } catch (err) {
    console.error('Error polling messages:', err);
  }
}

// UI Updaters
function setConnectedState(isConnected, text) {
  if (isConnected) {
    connectionBadge.classList.add('connected');
  } else {
    connectionBadge.classList.remove('connected');
  }
  connectionText.textContent = text;
}

function updateMetrics(metrics) {
  if (!metrics) return;
  cpuValue.textContent = metrics.cpuLoad;
  cpuBar.style.width = metrics.cpuLoad;
  usersValue.textContent = metrics.activeUsers.toLocaleString();
  uptimeValue.textContent = metrics.uptime;
}

function appendMessageDOM(msg, animate = true) {
  const isMe = msg.sender === 'user';
  const isSystem = msg.sender === 'system';
  
  const row = document.createElement('div');
  row.className = `message-row ${isSystem ? 'system' : (isMe ? 'me' : 'them')}`;
  row.dataset.messageId = msg.id;

  if (!animate) {
    row.style.opacity = '1';
    row.style.transform = 'translateY(0)';
  }

  const timeString = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let bubbleHTML = `
    <div class="message-bubble">
      <div class="message-text">${escapeHTML(msg.text)}</div>
  `;

  if (!isSystem) {
    bubbleHTML += `
      <div class="message-meta">
        <span class="message-time">${timeString}</span>
        ${isMe ? `<span class="delivery-status" id="status-${msg.id}">${STATUS_ICONS[msg.status] || ''}</span>` : ''}
      </div>
    `;
  }

  bubbleHTML += `</div>`;
  row.innerHTML = bubbleHTML;

  chatHistory.appendChild(row);
  scrollToBottom();
}

function updateMessageStatusDOM(id, status) {
  // Update local model
  const localMsg = messagesList.find(m => m.id === id);
  if (localMsg) {
    localMsg.status = status;
  }

  const statusContainer = document.getElementById(`status-${id}`);
  if (statusContainer) {
    statusContainer.innerHTML = STATUS_ICONS[status] || '';
  }
}
// Form Submission (Sending Message)
function setupForm() {
  inputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    // Clear input immediately
    messageInput.value = '';

    // Simulate typing indicator trigger for bot reply coming in 4s
    setTimeout(() => {
      showTypingIndicator();
    }, 2000);

    try {
      // Send message to backend (the backend will broadcast it back to us via SSE)
      const response = await fetch(`${BACKEND_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sender: 'user' })
      });

      if (!response.ok) {
        console.error('Failed to send message to backend');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  });
}

// Typing Indicator Actions
function showTypingIndicator() {
  // Only show if the bot hasn't already responded
  const lastMsg = messagesList[messagesList.length - 1];
  if (lastMsg && lastMsg.sender !== 'bot') {
    typingIndicator.style.display = 'flex';
    scrollToBottom();
  }
}

function hideTypingIndicator() {
  typingIndicator.style.display = 'none';
}

// Helper Utilities
function scrollToBottom() {
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Run initializer on load
window.addEventListener('DOMContentLoaded', init);
