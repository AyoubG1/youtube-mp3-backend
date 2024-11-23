const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(bodyParser.json());

let progressClients = [];

// Handle the root route with a basic message
app.get('/', (req, res) => {
  res.send('Welcome to the YouTube MP3 Downloader API!');
});

// Endpoint to send real-time progress updates
app.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  progressClients.push(res);

  req.on('close', () => {
    progressClients = progressClients.filter((client) => client !== res);
  });
});

// Endpoint to download the video as MP3
app.post('/download', (req, res) => {
  const videoUrl = req.body.videoUrl;

  if (!videoUrl) {
    return res.status(400).json({ error: 'You must provide a video URL.' });
  }

  // Output file path in the server's local downloads folder
  const outputFilePath = path.join(__dirname, 'downloads', `audio-${Date.now()}.mp3`);

  // Ensure the downloads folder exists
  if (!fs.existsSync(path.join(__dirname, 'downloads'))) {
    fs.mkdirSync(path.join(__dirname, 'downloads'));
  }

  // Spawn yt-dlp to download and convert the video
  const ytDlp = spawn('yt-dlp', [
    '-x', '--audio-format', 'mp3',
    '--progress-template', '%(progress._percent_str)s',
    '-o', outputFilePath,
    videoUrl
  ]);

  // Track progress and send updates to clients
  ytDlp.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output.includes('%')) {
      const percent = output.match(/(\d+(\.\d+)?)%/)[1];
      console.log(`Progress: ${percent}%`);
      progressClients.forEach((client) => {
        client.write(`data: ${percent}\n\n`);
      });
    }
  });

  ytDlp.stderr.on('data', (data) => {
    console.error('Error:', data.toString());
  });

  ytDlp.on('close', (code) => {
    console.log(`yt-dlp process exited with code ${code}`);

    // Trigger file download on completion
    res.download(outputFilePath, 'audio.mp3', (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }

      // Clean up after sending the file
      fs.unlink(outputFilePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting file:', unlinkErr);
        }
      });
    });

    // Notify clients of completion
    progressClients.forEach((client) => {
      client.write('data: complete\n\n');
    });

    progressClients = [];
  });
});

// Start the server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

