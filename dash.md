Create a fully messanger dashboard project that gets the data from a backend 
and the user is be able to send message gets delivery check status and ui update messages with animationss

## 1. Backend API (Node.js & Express)
Create a directory named `backend`, initialize a basic project, and write an `index.js` file that serves a mock JSON metrics endpoint (`/api/metrics`).
* Files to create:
  * `backend/package.json` (with express dependency setup)
  * `backend/index.js` (simple server running on port 5000 returning stats like CPU load, active users, and uptime)

## 2. Web Frontend (Vanilla JavaScript / HTML)
Create a directory named `web-frontend` containing a dashboard layout that fetches data from the Node.js backend.
* Files to create:
  * `web-frontend/index.html` (dashboard layout with grid cards)
  * `web-frontend/app.js` (fetch logic targeting `http://localhost:5000/api/metrics` and updating the DOM dynamically)

## 3. Vue Dashboard View (Vue.js / Viu)
Create a directory named `vue-dashboard` containing a single-file component layout for a Vue dashboard view.
* Files to create:
  * `vue-dashboard/DashboardView.vue` (Vue component displaying real-time metrics layout)

## 4. Mobile Dashboard (React Native Component)
Create a directory named `mobile-dashboard` containing a React Native screen component for mobile monitoring.
* Files to create:
  * `mobile-dashboard/DashboardScreen.jsx` (React Native StyleSheet and View components mapping the dashboard metrics for mobile)

## Verification
Confirm all folders and files have been successfully generated and list their absolute paths.
