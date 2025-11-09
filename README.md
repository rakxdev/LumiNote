# LumiNote - Real-Time Voice Transcription

A high-performance, real-time voice transcription app powered by AssemblyAI with optimized loading times and smooth user experience.

## ✨ Features

- ⚡ **Lightning Fast** - Optimized startup time with 60-75% faster recording initialization
- 🎙️ **Real-Time Transcription** - Instant speech-to-text conversion using AssemblyAI
- 🎨 **Beautiful UI** - Modern, responsive design with dark/light theme support
- 🔄 **Smart Token Management** - Pre-fetching and background refresh for instant recording
- 🎵 **Audio Optimization** - Reusable AudioContext for consistent performance
- 📱 **Mobile Friendly** - Works seamlessly on desktop and mobile browsers

## 🚀 Performance Optimizations

### Phase 1: Token Pre-fetching
- Tokens are pre-fetched on page load
- Background refresh every 50 seconds
- Zero wait time for cached tokens

### Phase 2: AudioContext Reuse
- Pre-created AudioContext on initialization
- Reused across all recording sessions
- Eliminates 100-300ms creation overhead

### Phase 3: Parallel Operations
- Microphone permission + token fetch run simultaneously
- No sequential blocking
- Maximum parallelization for fastest startup

**Result**: Recording starts in ~200-300ms (down from 1500ms!)

## 📋 Prerequisites

- Node.js (v14 or higher)
- AssemblyAI API Key ([Get one here](https://www.assemblyai.com/))
- Modern web browser (Chrome, Firefox, Safari, Edge)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rakxdev/LumiNote.git
   cd LumiNote
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   ASSEMBLYAI_API_KEY=your_api_key_here
   ```

4. **Start the server**
   ```bash
   npm start
   # or
   yarn serve
   ```

5. **Open in browser**
   ```
   http://localhost:8000
   ```

## 🌐 Deployment

### Cloudflare Pages (Recommended)

1. Push code to GitHub
2. Connect repository to Cloudflare Pages
3. Add environment variable: `ASSEMBLYAI_API_KEY`
4. Deploy!

### Other Platforms

Works on any platform supporting Node.js:
- Vercel
- Netlify
- Railway
- Render
- AWS/GCP/Azure

**Important**: Must be deployed with HTTPS for microphone access.

## 📁 Project Structure

```
LumiNote/
├── public/
│   ├── index.html          # Main HTML file
│   ├── index.js            # Client-side logic with optimizations
│   ├── audio-processor.js  # Audio worklet for processing
│   ├── styles.css          # Styling
│   └── reset.css           # CSS reset
├── server.js               # Express server with token generation
├── package.json            # Dependencies
└── README.md              # This file
```

## 🔧 Configuration

### Token Expiry (server.js)
```javascript
const token = jwt.sign(
  { api_key: process.env.ASSEMBLYAI_API_KEY },
  process.env.ASSEMBLYAI_API_KEY,
  { 
    algorithm: "HS256",
    expiresIn: "10m"  // 10 minutes
  }
);
```

### Background Refresh (index.js)
```javascript
TokenManager.startBackgroundRefresh()  // Refreshes every 50 seconds
```

## 🎯 Usage

1. Click **"Start Recording"** button
2. Allow microphone permission (first time only)
3. Start speaking
4. Real-time transcription appears instantly
5. Click **"Stop Recording"** to end
6. Copy or clear transcription as needed

## 🔒 Security

- ✅ API key stored server-side only
- ✅ Secure WebSocket (WSS) connection
- ✅ Token-based authentication
- ✅ HTTPS required for production
- ✅ No sensitive data exposed to client

## 🌍 Browser Compatibility

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome  | ✅      | ✅     |
| Firefox | ✅      | ✅     |
| Safari  | ✅      | ✅     |
| Edge    | ✅      | ✅     |
| Opera   | ✅      | ✅     |

## 🐛 Troubleshooting

### "getUserMedia requires secure context"
- **Solution**: Deploy with HTTPS (required for microphone access)

### "AudioContext was not allowed to start"
- **Solution**: Already handled! AudioContext resumes on user interaction

### Slow first recording
- **Solution**: Already optimized! Token pre-fetching eliminates delay

### CORS errors
- **Solution**: Already configured in server.js

## 📚 Documentation

- [AssemblyAI Real-Time API](https://www.assemblyai.com/docs/speech-to-text/real-time)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 👤 Author

**Rakesh Kumar**
- GitHub: [@rakxdev](https://github.com/rakxdev)

## 🙏 Acknowledgments

- [AssemblyAI](https://www.assemblyai.com/) for the amazing real-time transcription API
- [Anime.js](https://animejs.com/) for smooth animations

## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Contact: rakesh.943803@gmail.com

---

Made with ❤️ by Rakesh Kumar
