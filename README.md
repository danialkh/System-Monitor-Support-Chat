# 🖥️ System Monitor Support Chat

> A real-time monitoring and support dashboard backend built with **Node.js**, **Express**, **Server-Sent Events (SSE)**, and the **Google Gen AI SDK** (`@google/genai`).

---

## 🚀 Features

* **🤖 AI-Powered Support Chat:** Seamlessly integrated with Google's Gemini model to provide intelligent, contextual support responses.
* **📊 Live System Metrics:** Continuously streams real-time CPU load fluctuations, active user counts, and server uptime.
* **⚡ Server-Sent Events (SSE):** Low-latency live updates for new messages, message status lifecycles (`sent` ➔ `delivered` ➔ `read`), and periodic metric broadcasts.
* **🔄 Dynamic Event Broadcasting:** Instant client synchronization for chat histories and telemetry data.

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express
* **Real-Time Comm:** Server-Sent Events (SSE)
* **AI Integration:** `@google/genai` (Gemini SDK)
* **Utilities:** `dotenv`, `cors`

---

## ⚙️ Getting Started

### Prerequisites

Ensure you have the following installed:
* **Node.js** (v18+ recommended)
* **npm** 

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/danialkh/System-Monitor-Support-Chat.git](https://github.com/danialkh/System-Monitor-Support-Chat.git)
   cd System-Monitor-Support-Chat/backend

Install dependencies:
Bash npm install
Configure Environment Variables:Create a .env file in your **backend** directory and add your 
**Gemini API key**: and **PORT=5005**
   
   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=5005


Run the Application:Bashnode index.js

The server will start up on http://localhost:5005.🔌 API EndpointsMethodEndpointDescriptionGET/api/metricsFetches current server uptime, CPU load, and active user count.GET/api/messagesRetrieves the complete message history.POST/api/messagesSubmits a new chat message and triggers the automated Gemini response pipeline.GET/api/eventsEstablishes the real-time SSE stream for metrics and chat updates.
