# WhatsApp Agent Deployment Guide

## 🎯 Problem Solved
This guide fixes the Puppeteer Chrome browser issue that prevents the WhatsApp agent from running on Ubuntu servers and other environments.

## ✅ Local Development (Windows/Mac/Linux)

### What We Fixed
- ✅ Installed Chrome binary for Puppeteer
- ✅ Added automatic Chrome detection
- ✅ Fixed TypeScript configuration issues
- ✅ Agent now works locally without errors

### Setup Steps
1. **Install Chrome for Puppeteer:**
   ```bash
   npx puppeteer browsers install chrome
   ```

2. **Build and Run:**
   ```bash
   npm run build
   yarn start
   ```

3. **Verify Installation:**
   - Check console for: `✅ Found Chrome at: [path]`
   - WhatsApp agent should initialize without Chrome errors

## 🚀 Ubuntu Server Deployment

### Option 1: Install Chrome/Chromium System-Wide (Recommended)

```bash
# Update package list
sudo apt update

# Install Google Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update
sudo apt install -y google-chrome-stable

# OR Install Chromium (lighter alternative)
sudo apt install -y chromium-browser
```

### Option 2: Use Puppeteer's Bundled Chrome

```bash
# Install Chrome for Puppeteer
npx puppeteer browsers install chrome

# Set environment variable to use installed Chrome
export CHROME_PATH="$HOME/.cache/puppeteer/chrome/linux-140.0.7339.82/chrome-linux64/chrome"
```

### Option 3: Manual Chrome Installation

```bash
# Download and install Chrome manually
cd /tmp
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt-get install -f  # Fix any dependency issues
```

## 🔧 Environment Configuration

### For Ubuntu Server (.env file):
```bash
# Chrome path (choose one method)
CHROME_PATH=/usr/bin/google-chrome
# OR
CHROME_PATH=/usr/bin/chromium-browser
# OR (if using Puppeteer's bundled Chrome)
CHROME_PATH=/home/ubuntu/.cache/puppeteer/chrome/linux-140.0.7339.82/chrome-linux64/chrome

# Other required variables
NODE_ENV=production
PORT=3000
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=your-sheet-id
```

## 🐳 Docker Deployment (Alternative)

If you prefer Docker, here's a Dockerfile approach:

```dockerfile
FROM node:18-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

## 🔍 Troubleshooting

### Common Issues:

1. **"Could not find expected browser (chrome) locally"**
   - Solution: Install Chrome using one of the methods above
   - Check: `which google-chrome` or `which chromium-browser`

2. **Permission Denied Errors**
   - Solution: `sudo chmod +x /path/to/chrome`

3. **Missing Dependencies**
   - Solution: `sudo apt install -y libxss1 libgconf-2-4 libxrandr2 libasound2 libpangocairo-1.0-0 libatk1.0-0 libcairo-gobject2 libgtk-3-0 libgdk-pixbuf2.0-0`

4. **Chrome Crashes in Headless Mode**
   - Solution: Add these args to Puppeteer config:
     ```javascript
     args: [
       '--no-sandbox',
       '--disable-setuid-sandbox',
       '--disable-dev-shm-usage',
       '--disable-gpu'
     ]
     ```

## 📋 Verification Checklist

Before deploying to production:

- [ ] Chrome/Chromium is installed and accessible
- [ ] Environment variables are set correctly
- [ ] Agent starts without Chrome errors
- [ ] WhatsApp QR code is generated
- [ ] Messages are being processed
- [ ] Google Sheets integration works

## 🎉 Success Indicators

You'll know it's working when you see:
- ✅ `Found Chrome at: [path]` in console
- ✅ `WhatsApp agent initialized successfully`
- ✅ QR code displayed for WhatsApp authentication
- ✅ Messages being processed and sent to Google Sheets

## 📞 Support

If you encounter issues:
1. Check the console logs for Chrome-related errors
2. Verify Chrome installation: `google-chrome --version`
3. Test Chrome path: `ls -la /path/to/chrome`
4. Check environment variables are loaded correctly
