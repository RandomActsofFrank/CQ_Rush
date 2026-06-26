# 🚀 Ham Radio Contest Logger - Startup Guide

## After Reboot Instructions

### 1. Start Backend Server
```bash
cd server
npm start
```

### 2. Start Frontend Server (in new terminal)
```bash
cd client
npm start
```

### 3. Test Popup Positioning
- Open browser to `http://localhost:3000`
- Open console (F12 → Console tab)
- Hover over ARRL sections (like "CT")
- Look for:
  - **Red border** around popup (visual test)
  - **Console logs** showing mouse coordinates
  - **Popup positioned directly at cursor**

## 🎯 Current Features
- ✅ Popup positioning at cursor coordinates
- ✅ Red border test for visual confirmation
- ✅ Console logging for debugging
- ✅ Single popup (no double popup issue)
- ✅ All form improvements and validation

## 📁 File Locations
- Frontend: `client/src/App.js` (popup positioning code)
- Styles: `client/src/index.css`
- Backend: `server/index.js`

## 🔧 Troubleshooting
If servers don't start:
1. Check if ports 3000 and 3002 are free
2. Kill any existing Node processes: `pkill -f "node"`
3. Restart servers in order (backend first, then frontend)

---
*Last updated: Aug 1, 2025 - Popup positioning debugging session* 