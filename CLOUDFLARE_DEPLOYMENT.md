# Cloudflare Pages Deployment Guide

This guide explains how to deploy LumiNote to Cloudflare Pages with Functions.

## 🎯 Architecture Overview

### What Changed for Cloudflare:

**Before (Node.js/Express)**:
```
Browser → http://localhost:8000/token → Express server.js → JWT token
```

**After (Cloudflare Pages + Functions)**:
```
Browser → https://your-site.pages.dev/api/token → Cloudflare Function → JWT token
```

### Key Differences:
1. ✅ **Frontend**: Static files served by Cloudflare Pages
2. ✅ **Backend**: Cloudflare Function replaces Express server
3. ✅ **API URL**: Changed from `http://localhost:8000/token` → `/api/token` (relative URL)

---

## 📁 Project Structure for Cloudflare

```
LumiNote/
├── public/              # Static files (served by Cloudflare Pages)
│   ├── index.html
│   ├── index.js        # Updated with /api/token
│   ├── audio-processor.js
│   └── styles.css
├── functions/          # Cloudflare Functions
│   └── api/
│       └── token.js    # JWT token generation (replaces server.js)
├── wrangler.toml       # Cloudflare configuration
└── README.md
```

---

## 🚀 Deployment Steps

### Method 1: GitHub Integration (Recommended)

#### Step 1: Push to GitHub
```bash
# Already on cloudflare branch
git status
git add functions/ wrangler.toml public/index.js CLOUDFLARE_DEPLOYMENT.md
git commit -m "feat: Add Cloudflare Pages support with Functions

- Create Cloudflare Function for token generation
- Update API endpoint to /api/token (relative URL)
- Add wrangler.toml configuration
- Works on both localhost and Cloudflare"
git push -u origin cloudflare
```

#### Step 2: Connect to Cloudflare
1. Go to https://dash.cloudflare.com/
2. Navigate to **Workers & Pages** → **Pages**
3. Click **"Create Application"**
4. Select **"Connect to Git"**
5. Choose **GitHub** as provider
6. Authorize Cloudflare access
7. Select repository: **rakxdev/LumiNote**
8. Select branch: **cloudflare**

#### Step 3: Configure Build Settings
```
Project name: luminote (or your choice)
Production branch: cloudflare
Build command: (leave empty)
Build output directory: public
```

#### Step 4: Add Environment Variable
Click **"Environment variables"** → **"Add variable"**:
```
Variable name: ASSEMBLYAI_API_KEY
Value: [Paste your AssemblyAI API Key]
Environment: Production (and Preview if needed)
```

#### Step 5: Deploy
1. Click **"Save and Deploy"**
2. Wait 1-2 minutes for deployment
3. Get your URL: `https://luminote.pages.dev`

---

### Method 2: Direct Upload (Alternative)

If you prefer not to use GitHub:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler pages deploy public --project-name=luminote

# Set environment variable
wrangler pages secret put ASSEMBLYAI_API_KEY
# Paste your API key when prompted
```

---

## 🔧 How It Works

### 1. Cloudflare Functions
The `functions/api/token.js` file becomes an API endpoint at `/api/token`.

**File**: `functions/api/token.js`
- Creates JWT tokens using Web Crypto API
- Replaces the Express server.js
- Automatically deployed with your Pages site

### 2. Frontend Changes
The frontend now uses a relative URL:

**Before**:
```javascript
const response = await fetch("http://localhost:8000/token");
```

**After**:
```javascript
const response = await fetch("/api/token");
```

This works on:
- ✅ `http://localhost:8000` (local development with Pages)
- ✅ `https://your-site.pages.dev` (production)
- ✅ `https://your-custom-domain.com` (custom domain)

### 3. Environment Variables
- Stored securely in Cloudflare dashboard
- Accessed via `context.env.ASSEMBLYAI_API_KEY`
- Never exposed to the client

---

## 🧪 Testing

### After Deployment:

1. **Visit your URL**: `https://luminote.pages.dev`
2. **Open Console**: Press F12
3. **Start Recording**: Click the button
4. **Check Console**:
   ```
   🚀 Initializing token system...
   ✅ Token refreshed successfully
   ✅ Token system ready!
   🎵 AudioContext created
   🎵 Audio system ready!
   ```
5. **Test Multiple Recordings**: Should all be fast!

---

## 🌐 Custom Domain (Optional)

### Add Your Own Domain:

1. Go to **Pages** → **Your Project** → **Custom domains**
2. Click **"Set up a custom domain"**
3. Enter your domain: `luminote.yourdomain.com`
4. Follow DNS instructions:
   ```
   Type: CNAME
   Name: luminote
   Content: luminote.pages.dev
   ```
5. Wait for DNS propagation (5-60 minutes)
6. ✅ Access at: `https://luminote.yourdomain.com`

---

## 🔄 Local Development

### Option 1: Cloudflare Pages (Wrangler)
```bash
# Install dependencies
npm install -g wrangler

# Set environment variable locally
export ASSEMBLYAI_API_KEY=your_key_here

# Run local dev server
wrangler pages dev public
# Opens at: http://localhost:8788
```

### Option 2: Original Node.js (server.js)
```bash
# Use the master branch
git checkout master

# Set environment variable
echo "ASSEMBLYAI_API_KEY=your_key_here" > .env

# Run server
npm start
# Opens at: http://localhost:8000
```

---

## 📊 Comparison

| Feature | Master Branch (Node.js) | Cloudflare Branch |
|---------|------------------------|-------------------|
| Frontend | ✅ Same | ✅ Same |
| Backend | Express (server.js) | Cloudflare Function |
| API URL | `http://localhost:8000/token` | `/api/token` |
| Deployment | Node.js platforms | Cloudflare Pages |
| Local Dev | `npm start` | `wrangler pages dev` |
| Performance | Good | ⚡ Better (Edge) |
| Scaling | Manual | ♾️ Automatic |
| Cost | Varies | 🆓 Free tier |

---

## ✅ Advantages of Cloudflare

1. **Edge Computing**: Runs on 300+ data centers worldwide
2. **Auto-Scaling**: Handles traffic spikes automatically
3. **Free Tier**: Generous limits for most projects
4. **HTTPS**: Automatic SSL certificates
5. **Speed**: Lower latency globally
6. **Simple**: No server management

---

## 🐛 Troubleshooting

### Issue: "Failed to generate token"
**Solution**: Check environment variable is set in Cloudflare dashboard

### Issue: "CORS error"
**Solution**: Already handled in `functions/api/token.js` with CORS headers

### Issue: "404 on /api/token"
**Solution**: Ensure `functions/api/token.js` exists and is deployed

### Issue: "Microphone not working"
**Solution**: Cloudflare Pages provides HTTPS automatically - should work!

---

## 🎉 Success Checklist

After deployment, verify:
- [ ] Site loads at `https://your-site.pages.dev`
- [ ] Console shows token system initialized
- [ ] "Start Recording" button appears
- [ ] Microphone permission prompt appears
- [ ] Recording starts quickly (~200-300ms)
- [ ] Transcription appears in real-time
- [ ] Multiple recordings work consistently
- [ ] No console errors

---

## 📝 Next Steps

After successful deployment:

1. ✅ **Test thoroughly** on different devices/browsers
2. ✅ **Add custom domain** (optional)
3. ✅ **Monitor usage** in Cloudflare dashboard
4. ✅ **Share your app** - it's live! 🚀

---

## 🔗 Useful Links

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Functions](https://developers.cloudflare.com/pages/platform/functions/)
- [AssemblyAI API](https://www.assemblyai.com/docs)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

---

**Need Help?** Check the Cloudflare dashboard for deployment logs and errors.

**Ready to Deploy?** Follow the steps above and your app will be live in 5 minutes! 🚀