# Icelandic Whisper Transcription

<î<ø **Local Whisper transcription server for Icelandic audio with SRT subtitle export.**

## Features

-  **Icelandic language** support with `-l is` flag
-  **SRT export** with timecodes for subtitles
-  **Large-v3 model** (best accuracy for Icelandic)
-  **100% local** - no API costs
-  **Simple web UI** for uploading and transcribing

## Quick Setup

### 1. Install Dependencies

```bash
# Install Homebrew packages
brew install ffmpeg cmake

# Install Node.js dependencies
npm install
```

### 2. Build whisper.cpp

```bash
# Clone whisper.cpp (if not present)
git clone https://github.com/ggerganov/whisper.cpp.git

# Build
cd whisper.cpp
cmake -B build
cmake --build build --config Release

# Download the large-v3 model (3GB - best for Icelandic)
bash ./models/download-ggml-model.sh large-v3
cd ..
```

### 3. Start the Server

```bash
node server.js
```

### 4. Open the Transcription Page

Go to: http://localhost:3000/whisper.html

## API Usage

```bash
curl -X POST http://localhost:3000/transcribe \
  -F "file=@your_icelandic_audio.mp3"
```

**Response:**
```json
{
  "text": "Halló og velkomin...",
  "srt": "1\n00:00:00,000 --> 00:00:03,500\nHalló og velkomin..."
}
```

## Whisper Models

| Model | Size | Quality | Speed |
|-------|------|---------|-------|
| tiny | 39MB | P | ¡¡¡¡ |
| base | 142MB | PP | ¡¡¡ |
| medium | 1.5GB | PPP | ¡¡ |
| **large-v3** | **3GB** | **PPPPP** | ¡ |

For Icelandic, use **large-v3** for best accuracy.

## Credits

- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - C++ port of OpenAI's Whisper
- [OpenAI Whisper](https://github.com/openai/whisper) - Original Whisper model
