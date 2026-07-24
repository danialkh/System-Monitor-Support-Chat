require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 5005;
// Change this line: // const ai = new GoogleGenAI(); // To this: const ai = new GoogleGenAI({ apiKey: process.env.AQ.Ab8RN6LR9sn3c_t8IgMc4RkzdvwCTP5DoggMenlAYGIHQQXEkQ });

app.use(cors());
app.use(express.json());

// Initialize Google Gen AI client (automatically picks up process.env.GEMINI_API_KEY)
//const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY});

// In-memory data store
const startTime = Date.now();
let activeUsers = 142;
let messageIdCounter = 1;

const messages = [
  { id: 'm-init-1', sender: 'system', text: 'Welcome to Messenger Dashboard Support!', timestamp: new Date(Date.now() - 600000).toISOString(), status: 'read' },
  { id: 'm-init-2', sender: 'bot', text: 'Hi there! I am your real-time assistant powered by Gemini. Ask me anything!', timestamp: new Date(Date.now() - 300000).toISOString(), status: 'read' }
];

// Server-Sent Events clients
let clients = [];

// Helper to broadcast events to all connected clients
function broadcast(event, data) {
  clients.forEach(client => {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });
}

// Generate dynamic metrics
function getMetrics() {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const cpuLoad = Math.min(100, Math.max(0, Math.floor(25 + Math.sin(uptimeSeconds / 10) * 15 + Math.random() * 5)));
  if (Math.random() > 0.7) {
    activeUsers += Math.random() > 0.5 ? 1 : -1;
  }
  
  return {
    cpuLoad: `${cpuLoad}%`,
    activeUsers: activeUsers,
    uptime: formatUptime(uptimeSeconds),
    uptimeRaw: uptimeSeconds
  };
}

function formatUptime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [
    h.toString().padStart(2, '0'),
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0')
  ].join(':');
}

// REST Endpoints
app.get('/api/metrics', (req, res) => {
  res.json(getMetrics());
});

app.get('/api/messages', (req, res) => {
  res.json(messages);
});

app.post('/api/messages', async (req, res) => {
  const { text, sender } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  const messageId = `msg-${messageIdCounter++}`;
  const newMessage = {
    id: messageId,
    sender: sender || 'user',
    text: text,
    timestamp: new Date().toISOString(),
    status: 'sent'
  };

  messages.push(newMessage);
  broadcast('message_new', newMessage);

  // Delivery animations (sent -> delivered -> read)
  setTimeout(() => updateMessageStatus(messageId, 'delivered'), 1200);
  setTimeout(() => updateMessageStatus(messageId, 'read'), 2500);

  // Trigger automated support reply via Gemini
  if (sender !== 'bot' && sender !== 'system') {
    setTimeout(() => {
      triggerGeminiBotReply(text);
    }, 3000);
  }

  res.status(201).json(newMessage);
});

// Update status of a message and broadcast the change
function updateMessageStatus(id, status) {
  const msg = messages.find(m => m.id === id);
  if (msg) {
    msg.status = status;
    broadcast('message_status', { id, status });
  }
}

// Generate an automated reply using Google Gemini SDK
async function triggerGeminiBotReply(userPrompt) {
  const botMessageId = `msg-${messageIdCounter++}`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: userPrompt,
      config: {
        systemInstruction: "You are a helpful real-time support assistant embedded in a live dashboard. Provide thorough, detailed, and conversational answers when appropriate.",
        maxOutputTokens: 2000, // <-- Increased from 150 to allow long answers
      }
    });

    console.log("Full Gemini Response:", JSON.stringify(response, null, 2));
    
    const aiReplyText = response.text ? response.text.trim() : "I received your message!";

    const botMessage = {
      id: botMessageId,
      sender: 'bot',
      text: aiReplyText,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    messages.push(botMessage);
    broadcast('message_new', botMessage);

    setTimeout(() => updateMessageStatus(botMessageId, 'delivered'), 1000);
    setTimeout(() => updateMessageStatus(botMessageId, 'read'), 2000);

  } catch (error) {
    console.error("Detailed Gemini Error:", error);
    
    const fallbackMessage = {
      id: botMessageId,
      sender: 'bot',
      text: `Error: ${error.message}`,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    messages.push(fallbackMessage);
    broadcast('message_new', fallbackMessage);
    
    setTimeout(() => updateMessageStatus(botMessageId, 'delivered'), 1000);
    setTimeout(() => updateMessageStatus(botMessageId, 'read'), 2000);
  }
}
// SSE (Server-Sent Events) Endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  res.write(`event: init\ndata: ${JSON.stringify({ metrics: getMetrics(), messages })}\n\n`);

  req.on('close', () => {
    clients = clients.filter(client => client.id !== clientId);
  });
});

// Periodic broadcast of system metrics every 3 seconds
setInterval(() => {
  broadcast('metrics_update', getMetrics());
}, 3000);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});