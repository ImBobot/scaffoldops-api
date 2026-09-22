require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();
// helmet's default CSP is meant for an app with no inline scripts of its
// own; our dashboard is a single static HTML file with inline <script>/
// <style>, so this relaxes just enough for that page to render and still
// load its two external assets (Google Fonts, the QR-code library).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
    },
  },
}));
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', routes);

// Serves public/index.html (the dashboard) at the site root, and any other
// static assets you drop in public/. Express falls back to index.html for
// the bare "/" automatically.
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`ScaffoldOps API listening on :${PORT}`));
