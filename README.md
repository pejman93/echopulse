# 🔊 EchoPulse – Real-Time Voice Sentiment & Emotion Visualizer

**EchoPulse** is a creative, AI-powered web application that listens to your voice and transforms it into dynamic emotional visualizations. Speak naturally, and EchoPulse will detect emotions, analyze sentiment, and render vibrant emotion particles that move with physics-based behavior — right in your browser.

---

## 🎯 Key Features

- 🎤 **Voice Recording**: Record up to 44 seconds of voice input directly in the browser  
- 🧠 **AI-Powered Sentiment Analysis**: Uses advanced transformer models and LLMs for emotion detection  
- 🎨 **Live Visualization**: Emotional blobs interact, float, and respond to emotional tone  
- 📊 **Emotion Categories**: Uplifted, Downcast, Breakthrough, Mixed State, and Introspective  
- 👥 **Speaker Detection**: Tracks multiple speakers using AssemblyAI’s diarization  
- 📈 **Analytics Dashboard**: Review past sessions and emotional trends  
- 🌐 **No Setup Needed**: Web-based UI, just run the app and start analyzing  
- 💾 **Data Storage**: All sessions saved in a local SQLite database  

---

## 🔬 Emotion & Sentiment Modeling

### Emotion Categories

| Category        | Description                                  |
|----------------|----------------------------------------------|
| 💚 Uplifted     | Joy, hope, excitement, gratitude             |
| 💙 Downcast     | Sadness, grief, fatigue, loneliness          |
| 🟡 Breakthrough | Anger, courage, growth moments               |
| 🟠 Mixed State  | Complex, layered emotional tones             |
| ⚪ Introspective| Calm, thoughtful, reflective feelings        |

### Emotion Scores

- **Sentiment Score**: from -1.0 (sorrow) to +1.0 (hope)  
- **Intensity**: How strong the emotion is (0.0 to 1.0)  
- **Confidence**: How sure the model is (0.0 to 1.0)  

---

## 🧠 Blob Physics & Social Dynamics

Emotion blobs interact using physics-based rules:

- 🌊 **Floating Movement**: Emotions float based on energy  
- ⚖️ **Gravity Effects**: Sorrow blobs sink, hope blobs rise  
- 🤝 **Social Forces**: Attraction or repulsion based on emotion type  
- 💥 **Collision Physics**: Elastic blob-to-blob interactions  
- 🎯 **Mouse Nudges**: Click to shift blobs gently  
- 🛡️ **Edge Reactions**: Blobs respond to walls and corners  

---

## 🚀 Getting Started

### 🔧 Prerequisites

- Python 3.8+
- AssemblyAI API key (free account)
- OpenAI API key (optional, for deeper analysis)
- Any modern browser with microphone permissions

---

### 🔁 Install & Setup

```bash
git clone https://github.com/your_username/echopulse.git
cd echopulse
```

```bash
# Install Python dependencies
pip install -r requirements.txt

# Copy and configure your .env file
cp env.template .env
# Edit .env with your API keys

# Initialize local database
python scripts/setup_db.py
```

---

### 🚦 Run the App

```bash
# Start the app
python main.py web

# Then visit:
http://localhost:8080
```

---

### 🧪 Test & Debug

```bash
# Run CLI sentiment tester
python main.py cli

# Analyze audio from file
python scripts/analyze_audio.py --file recordings/sample.wav
```

---

## 🔑 .env Variables

Create a `.env` file like this:

```env
ASSEMBLYAI_API_KEY=your_assemblyai_key
OPENAI_API_KEY=your_openai_key
DATABASE_URL=sqlite:///data/databases/sentiment_analysis.db
FLASK_ENV=development
FLASK_HOST=0.0.0.0
FLASK_PORT=8080
SECRET_KEY=echopulse-secret-key
```

---

## 📁 Project Structure

```
echopulse/
├── src/
│   └── hopes_sorrows/
│       ├── analysis/
│       ├── audio/
│       ├── web/
│       ├── core/
│       └── data/
├── scripts/
├── data/
│   └── databases/
│   └── recordings/
├── main.py
├── README.md
├── requirements.txt
```

---

## 🌐 Technologies Used

- **Flask + Flask-SocketIO** – Web framework + real-time support  
- **AssemblyAI** – Speech-to-text + speaker diarization  
- **HuggingFace Transformers** – Sentiment modeling  
- **OpenAI GPT** – Optional: contextual explanation  
- **p5.js + Canvas** – Blob visualization  
- **Anime.js** – Smooth animation  
- **SQLite + SQLAlchemy** – Local DB storage  
- **Vanilla JavaScript** – Frontend logic  

---

## 🛠️ Development Tips

- Frontend files: `src/hopes_sorrows/web/`  
- API endpoints: `src/hopes_sorrows/web/api/`  
- Sentiment logic: `src/hopes_sorrows/analysis/`  
- CLI tools: `scripts/`  
- Database schema: auto-created with `setup_db.py`  

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Credits

- AssemblyAI  
- HuggingFace  
- OpenAI  
- Anime.js + p5.js  
- Flask Community  

---

**Speak. Feel. See Your Emotions Come Alive.** 🎭✨
