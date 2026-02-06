require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const { execSync, exec } = require('child_process');

const upload = multer({ dest: 'uploads/' });
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

// Paths for local whisper.cpp
const WHISPER_CLI = path.join(__dirname, 'whisper.cpp', 'build', 'bin', 'whisper-cli');
const WHISPER_MODEL = path.join(__dirname, 'whisper.cpp', 'models', 'ggml-large-v3.bin');

// Check if local whisper is available
const useLocalWhisper = fs.existsSync(WHISPER_CLI) && fs.existsSync(WHISPER_MODEL);
console.log('Local Whisper available:', useLocalWhisper);
if (useLocalWhisper) {
  console.log('Using local Whisper:', WHISPER_CLI);
  console.log('Model:', WHISPER_MODEL);
}

// For API fallback
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post('/transcribe', upload.single('file'), async (req, res) => {
  let wavPath = null;
  
  try {
    if (!req.file) return res.status(400).send('No file uploaded');
    
    console.log('Received file:', req.file.originalname, 'Size:', req.file.size);
    
    if (useLocalWhisper) {
      // Convert to 16kHz mono WAV using ffmpeg (required by whisper.cpp)
      wavPath = req.file.path + '.wav';
      const ffmpegCmd = `ffmpeg -i "${req.file.path}" -ar 16000 -ac 1 -f wav "${wavPath}" -y 2>&1`;
      
      console.log('Converting audio with ffmpeg...');
      try {
        execSync(ffmpegCmd, { timeout: 60000 });
      } catch (ffmpegErr) {
        console.error('FFmpeg error:', ffmpegErr.message);
        cleanup(req.file.path, wavPath);
        return res.status(400).json({ error: 'Failed to convert audio file. Make sure ffmpeg is installed.' });
      }
      
      // Run whisper-cli
      const whisperCmd = `"${WHISPER_CLI}" -m "${WHISPER_MODEL}" -f "${wavPath}" -l is --output-srt --output-txt -of "${wavPath}" 2>&1`;
      
      console.log('Running whisper transcription...');
      try {
        const output = execSync(whisperCmd, { timeout: 300000, maxBuffer: 10 * 1024 * 1024 });
        console.log('Whisper output:', output.toString().substring(0, 500));
      } catch (whisperErr) {
        console.error('Whisper error:', whisperErr.message);
        cleanup(req.file.path, wavPath);
        return res.status(500).json({ error: 'Transcription failed: ' + whisperErr.message });
      }
      
      // Read the output text file
      const srtPath = wavPath + ".srt"; const txtPath = wavPath + '.txt';
      let transcription = '';
      
      if (fs.existsSync(txtPath)) {
        transcription = fs.readFileSync(txtPath, 'utf8').trim();
        fs.unlinkSync(txtPath); // cleanup txt file
      } else {
        console.error('Transcription output file not found');
      }
      
      cleanup(req.file.path, wavPath);
      let srt = ""; if (fs.existsSync(srtPath)) { srt = fs.readFileSync(srtPath, "utf8").trim(); fs.unlinkSync(srtPath); } return res.json({ text: transcription, srt: srt || 'No transcription generated' });
      
    } else {
      // Fallback to API (OpenAI)
      if (!OPENAI_API_KEY) {
        cleanup(req.file.path);
        return res.status(500).json({ error: 'No API key configured and local Whisper not available' });
      }
      
      // Use API fallback code here (original implementation)
      const fetch = require('node-fetch');
      const FormData = require('form-data');
      
      const fileStream = fs.createReadStream(req.file.path);
      const form = new FormData();
      form.append('file', fileStream, req.file.originalname || 'audio');
      form.append('model', 'whisper-1');

      const apiUrl = 'https://api.openai.com/v1/audio/transcriptions';
      console.log('Posting to API:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: form
      });

      const upstreamText = await response.text();
      let data;
      try {
        data = upstreamText ? JSON.parse(upstreamText) : {};
      } catch (jsonErr) {
        console.error('API returned non-JSON response', response.status);
        cleanup(req.file.path);
        return res.status(502).json({ error: 'Non-JSON response from API', status: response.status });
      }

      cleanup(req.file.path);

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.json({ text: data.text || data.transcription || data });
    }
  } catch (err) {
    console.error('Error:', err);
    cleanup(req.file?.path, wavPath);
    res.status(500).json({ error: err.message });
  }
});

function cleanup(...files) {
  for (const file of files) {
    if (file && fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        console.error('Cleanup error:', e.message);
      }
    }
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Whisper transcription server listening on http://localhost:${PORT}`);
  if (useLocalWhisper) {
    console.log(' Using LOCAL Whisper (no API costs!)');
  } else {
    console.log('   Using API for transcription');
  }
});
