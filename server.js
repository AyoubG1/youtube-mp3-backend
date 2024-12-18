const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

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

// Function to export cookies using Puppeteer
async function getCookies() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
    ],
    defaultViewport: { width: 800, height: 600 },
  });

  const page = await browser.newPage();

  // Block unnecessary requests to save resources
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (
      ['image', 'stylesheet', 'font', 'media', 'script', 'xhr', 'other'].includes(
        req.resourceType()
      )
    ) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2', timeout: 90000 });

    console.log('Please log in to YouTube in the opened browser window if required.');

    // Wait for a short duration to allow login or other page setups
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const cookies = await page.cookies();
    await browser.close();

    const cookiesFilePath = path.join(__dirname, 'cookies.txt');
    fs.writeFileSync(
      cookiesFilePath,
      cookies
        .map(
          (cookie) =>
            `${cookie.domain}\tTRUE\t${cookie.path}\t${cookie.secure}\t0\t${cookie.name}\t${cookie.value}`
        )
        .join('\n')
    );

    return cookiesFilePath;
  } catch (error) {
    console.error('Error fetching cookies:', error);
    await browser.close();
    throw error;
  }
}

// Endpoint to download the video as MP3
app.post('/download', async (req, res) => {
  const videoUrl = req.body.videoUrl;

  if (!videoUrl) {
    return res.status(400).json({ error: 'You must provide a video URL.' });
  }

  // Get cookies file
  let cookiesFilePath;
  try {
    cookiesFilePath = await getCookies();
  } catch (error) {
    console.error('Error fetching cookies:', error);
    return res.status(500).json({ error: 'Failed to retrieve YouTube cookies. Please try again later.' });
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
    '--cookies', cookiesFilePath, // Use cookies file
    '--progress-template', '%(progress._percent_str)s',
    '-o', outputFilePath,
    videoUrl,
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
    const errorOutput = data.toString();
    console.error('yt-dlp Error:', errorOutput);

    if (errorOutput.includes('cookies')) {
      res.status(400).json({
        error: 'Invalid or expired cookies. Please try again.',
      });
    } else {
      res.status(500).json({
        error: 'An error occurred while processing your request.',
      });
    }
  });

  ytDlp.on('close', (code) => {
    console.log(`yt-dlp process exited with code ${code}`);

    if (code !== 0) {
      return res.status(500).json({ error: 'Failed to download the video. Please try again later.' });
    }

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

// Periodic cleanup of the downloads folder
setInterval(() => {
  const downloadsPath = path.join(__dirname, 'downloads');
  fs.readdir(downloadsPath, (err, files) => {
    if (err) return console.error('Error reading downloads directory:', err);

    files.forEach((file) => {
      const filePath = path.join(downloadsPath, file);
      const stats = fs.statSync(filePath);
      const now = Date.now();
      const age = now - stats.mtimeMs;

      if (age > 86400000) {
        fs.unlink(filePath, (err) => {
          if (err) console.error('Error deleting old file:', err);
        });
      }
    });
  });
}, 3600000); // Run every hour

// Start the server
const PORT = process.env.PORT || 3000;

app.timeout = 120000; // Increase server timeout
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

