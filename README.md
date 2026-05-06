# StreamVault

**v1.2** — A full-stack video streaming platform with HLS adaptive bitrate delivery, FFmpeg encoding, AWS S3 storage, and a rich feature set built from scratch.

![Version](https://img.shields.io/badge/version-1.2-brand) ![Tech Stack](https://img.shields.io/badge/React-18-blue) ![Node](https://img.shields.io/badge/Node.js-18+-green) ![FFmpeg](https://img.shields.io/badge/FFmpeg-HLS-orange) ![AWS S3](https://img.shields.io/badge/AWS-S3-yellow) ![PostgreSQL](https://img.shields.io/badge/NeonDB-PostgreSQL-teal)

---

## Changelog

| Version | Changes |
|---|---|
| **v1.2** | Direct browser→S3 upload via presigned PUT URLs (fixes Render 30-second timeout); background worker runs inline in the web process (`RUN_WORKER=true`); video deletion now cleans up all S3 assets including unprocessed originals; S3 CORS updated to include `ETag` header |
| **v1.1** | Redesigned frontend — dark/light mode toggle, new design system, improved LandingPage, interactive components, accessibility improvements |
| **v1.0** | Full-stack HLS platform — channel system, video privacy, presigned S3, admin panel, user suspension, audit log, video likes, channel search, NeonDB, shareable links, channel moderation, deletion permissions, AI transcript search (Groq), bulk management, A-B loop, playback speed, watch history, video analytics, engagement heatmap, custom thumbnail |

---

## Features

### Video
- Upload any MP4 / MOV / MKV / AVI / WebM file (up to 2 GB)
- Direct browser→S3 upload via presigned URLs — bypasses the backend server entirely
- FFmpeg pipeline: probe → thumbnail → encode 360p / 720p / 1080p HLS
- Adaptive bitrate streaming via HLS.js — quality switches automatically
- Private S3 bucket with presigned URLs and an authenticated HLS proxy
- Video privacy: **Public**, **Unlisted** (link-only), **Private** (owner + admin)
- Custom thumbnail upload (owner can replace the auto-generated frame)
- Shareable public links for public/unlisted videos

### Player
- Custom-built HLS video player
- Playback speed control: 0.5× → 2×
- A-B loop — set two timestamps and loop between them (keyboard: `A`, `B`, `L`)
- Quality selector (360p / 720p / 1080p / Auto)
- Keyboard shortcuts: `Space`/`K` play-pause, `F` fullscreen, `M` mute, `←`/`→` seek 10s, `<`/`>` speed
- Fullscreen and Picture-in-Picture ready
- Watch history with cross-session resume playback
- Engagement heatmap on scrubber (red = most replayed seconds)

### Channels & Social
- YouTube-style channel pages — avatar, bio, video grid
- First-upload prompts channel creation (mandatory)
- Like/react to videos
- Channel search across the platform
- "Continue Watching" row on the library page
- View counts, like counts per video

### AI Transcript Search
- Whisper-powered transcription via **Groq API** (free tier — no OpenAI key needed)
- Full-text search across spoken words in every video using PostgreSQL `tsvector`
- Transcript panel on the watch page — click any line to jump to that timestamp
- Search-in-transcript on the library page highlights matching spoken snippets on cards

### Admin Panel
- 5-tab dashboard: **Dashboard · Videos · Users · Channels · Audit Log**
- Bulk delete failed videos
- Suspend users (timed or permanent, with reason)
- Lift suspensions
- Channel moderation: edit/delete any channel
- Paginated audit log of every admin action
- Uploader details (avatar + channel name) on every video row

### Bulk Management
- Select multiple videos in the library
- Batch: make public, make private, or delete
- Floating action bar with live selection count

### Video Analytics (owner only)
- Total views, unique viewers, like ratio
- Average completion % with visual ring
- Engagement heatmap bar chart (5-second buckets)
- Views per day — last 14 days

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, HLS.js |
| Backend | Node.js 18, Express, pg-boss (job queue) |
| Auth | Clerk (JWT + session cookies) |
| Database | NeonDB (PostgreSQL 15) via `pg` |
| Video encoding | FFmpeg — fluent-ffmpeg |
| Storage | AWS S3 (private bucket, presigned URLs, direct browser upload) |
| Image processing | Sharp (thumbnail resize) |
| Transcription | Groq API — `whisper-large-v3-turbo` |
| Logging | Winston |

---

## Prerequisites

- **Node.js** ≥ 18
- **FFmpeg** on PATH — `ffmpeg -version` should work
- **AWS account** with an S3 bucket (set to **private**)
- **Clerk account** — [clerk.com](https://clerk.com)
- **NeonDB account** — [neon.tech](https://neon.tech) (free tier is fine)
- **Groq API key** (optional, for transcription) — [console.groq.com](https://console.groq.com)

### Install FFmpeg

```bash
# Windows
winget install ffmpeg

# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt update && sudo apt install ffmpeg
```

---

## Installation

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/streamvault.git
cd streamvault

# 2. Backend dependencies
cd backend && npm install

# 3. Frontend dependencies
cd ../frontend && npm install
```

---

## Environment Variables

### `backend/.env`

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Clerk
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# NeonDB (PostgreSQL)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-private-bucket-name

# Groq (optional — enables AI transcription)
GROQ_API_KEY=gsk_...

# FFmpeg (optional — only needed if not on PATH)
# FFMPEG_PATH=C:/ffmpeg/bin/ffmpeg.exe
# FFPROBE_PATH=C:/ffmpeg/bin/ffprobe.exe

# Set to "true" to run the video processing worker inside the web process.
# Required on Render free tier (no separate worker dyno available).
RUN_WORKER=true
```

### `frontend/.env`

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:5000/api
```

---

## AWS S3 Setup

1. Create a bucket and set it to **Block all public access** (private).
2. Attach the following CORS policy (**S3 → Permissions → Cross-origin resource sharing**):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://your-production-domain.com"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

> `ETag` must be exposed — the browser upload uses it to confirm the S3 PUT succeeded.

3. Create an IAM user with **AmazonS3FullAccess** (or a scoped policy) and copy the access keys into your `.env`.

---

## Running Locally

```bash
# Terminal 1 — Backend API + worker (auto-runs DB migration on startup)
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

The database schema (all 8 tables + indexes) is created automatically on the first backend startup. No manual migrations needed.

> When `RUN_WORKER=true`, the video processing worker starts inside the same process as the API server. For local development you can also run the worker separately in a third terminal with `npm run dev:worker`.

---

## Admin Access

1. Sign up for an account
2. Open your **Clerk dashboard → Users → (your account) → Public Metadata**
3. Set:

```json
{ "role": "admin" }
```

The Admin panel link appears in the navbar immediately after the next sign-in.

---

## How It Works

### Upload pipeline

```
Browser ──POST /api/videos/prepare──▶ Backend
                                       │  Creates DB record (status: pending_upload)
                                       │  Returns presigned S3 PUT URL
                                       ▼
Browser ──PUT {presigned S3 URL}──────▶ S3 (direct — backend not involved)
         (progress bar tracks this)

Browser ──POST /api/videos/:id/finalize──▶ Backend
                                            │  Queues processing job via pg-boss
                                            ▼
                                       Worker (inline or separate process):
                                         S3       → download original
                                         FFprobe  → probe metadata
                                         FFmpeg   → thumbnail.jpg
                                         FFmpeg   → 360p HLS (6s segments)
                                         FFmpeg   → 720p HLS
                                         FFmpeg   → 1080p HLS
                                         FFmpeg   → audio.mp3 (for Whisper)
                                         Groq     → transcript + segments
                                         S3       → upload all HLS assets
                                         S3       → delete original
                                         DB       → status = "ready"
```

The browser uploads directly to S3, so the backend's HTTP request timeout is never a bottleneck regardless of file size.

### Playback pipeline

```
Browser  ──GET /api/videos/:id──▶  Backend (auth check, presigned thumbnail URL)
HLS.js   ──GET /api/hls/:id/master.m3u8──▶  HLS proxy (fetches from private S3)
HLS.js   ──GET /api/hls/:id/360p/playlist.m3u8──▶  HLS proxy
HLS.js   ──GET /api/hls/:id/360p/segment_00001.ts──▶  302 → presigned S3 URL (5 min TTL)
```

### Privacy model

| Privacy | Library | Direct link | HLS proxy |
|---|---|---|---|
| Public | ✅ visible | ✅ | ✅ no auth required |
| Unlisted | ❌ hidden | ✅ | ✅ no auth required |
| Private | ❌ hidden | owner + admin only | owner + admin only |

---

## Project Structure

```
streamvault/
├── backend/
│   └── src/
│       ├── server.js             # Express app + optional inline worker
│       ├── worker.js             # pg-boss worker (can run standalone or inline)
│       ├── routes/
│       │   ├── videos.js        # video CRUD, progress, heatmap, analytics
│       │   ├── admin.js         # admin-only endpoints
│       │   ├── profiles.js      # channel pages
│       │   ├── hls.js           # authenticated HLS proxy
│       │   ├── share.js         # public share page (no auth)
│       │   └── history.js       # watch history
│       ├── controllers/
│       │   ├── videoController.js
│       │   ├── adminController.js
│       │   ├── profileController.js
│       │   ├── hlsController.js
│       │   ├── likesController.js
│       │   ├── transcriptController.js
│       │   ├── progressController.js
│       │   ├── heatmapController.js
│       │   └── analyticsController.js
│       ├── middleware/
│       │   ├── auth.js          # Clerk JWT verification + suspension check
│       │   └── upload.js        # Multer config (used by admin upload)
│       ├── services/
│       │   ├── ffmpegService.js  # HLS encoding pipeline
│       │   ├── s3Service.js      # S3 upload / download / presigned URLs
│       │   ├── queue.js          # pg-boss queue client
│       │   └── whisperService.js # Groq transcription
│       └── utils/
│           ├── db.js            # video DB queries (PostgreSQL)
│           ├── profileDb.js     # channel DB queries
│           ├── database.js      # pg Pool connection
│           ├── migrate.js       # auto-migration on startup
│           ├── audit.js         # audit log helper
│           └── logger.js        # Winston logger
│
└── frontend/
    └── src/
        ├── App.jsx
        ├── pages/
        │   ├── LandingPage.jsx
        │   ├── Home.jsx          # library + bulk management + continue watching
        │   ├── Upload.jsx
        │   ├── Watch.jsx         # player + transcript + analytics link
        │   ├── Channel.jsx       # channel page
        │   ├── Analytics.jsx     # video analytics (owner only)
        │   ├── Share.jsx         # public share page
        │   ├── Admin.jsx         # 5-tab admin panel
        │   └── AuthPage.jsx
        ├── components/
        │   ├── VideoPlayer.jsx   # HLS player with speed, A-B loop, heatmap
        │   ├── VideoCard.jsx     # card with transcript snippet + selection mode
        │   ├── VideoGallery.jsx  # paginated grid with bulk selection
        │   ├── TranscriptPanel.jsx
        │   ├── LikeButton.jsx
        │   ├── Navbar.jsx
        │   ├── SearchBar.jsx
        │   └── ProfileSetupModal.jsx
        ├── hooks/
        │   ├── useVideos.js
        │   └── useProfile.js
        └── services/
            └── api.js            # Axios client (auto-attaches Clerk JWT)
```

---

## API Reference

### Videos
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/videos/prepare` | Step 1 of upload — creates DB record, returns presigned S3 PUT URL |
| `POST` | `/api/videos/:id/finalize` | Step 2 of upload — queues processing after browser finishes S3 PUT |
| `GET` | `/api/videos` | List videos (`?search=&sortBy=&order=&page=&limit=`) |
| `GET` | `/api/videos/:id` | Get video by ID |
| `GET` | `/api/videos/:id/status` | Poll processing status (owner/admin only) |
| `PATCH` | `/api/videos/:id` | Update title / description / privacy |
| `PATCH` | `/api/videos/:id/thumbnail` | Upload custom thumbnail |
| `DELETE` | `/api/videos/:id` | Delete video + all S3 assets (HLS files + original) |
| `GET` | `/api/videos/:id/transcript` | Get AI transcript segments |
| `GET` | `/api/videos/:id/like` | Get like status |
| `POST` | `/api/videos/:id/like` | Toggle like |
| `GET` | `/api/videos/:id/progress` | Get watch progress (resume) |
| `POST` | `/api/videos/:id/progress` | Save watch progress |
| `GET` | `/api/videos/:id/heatmap` | Get engagement heatmap |
| `POST` | `/api/videos/:id/heatmap` | Record playback event |
| `GET` | `/api/videos/:id/analytics` | Full analytics (owner/admin) |

### HLS Proxy
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/hls/:videoId/*` | Proxy HLS playlists and segments from private S3 |

### Channels
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/profile/me` | Get own profile |
| `POST` | `/api/profile` | Create channel |
| `PATCH` | `/api/profile` | Update channel |
| `DELETE` | `/api/profile` | Delete own channel |
| `GET` | `/api/profile/:userId` | Get channel by user ID |
| `GET` | `/api/profile/search?q=` | Search channels |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/stats` | Dashboard stats |
| `GET` | `/api/admin/videos` | All videos (ignores privacy) |
| `DELETE` | `/api/admin/videos/failed/all` | Bulk delete failed videos |
| `GET` | `/api/admin/users` | All Clerk users |
| `POST` | `/api/admin/users/:id/suspend` | Suspend user |
| `DELETE` | `/api/admin/users/:id/suspend` | Lift suspension |
| `GET` | `/api/admin/audit` | Paginated audit log |
| `GET` | `/api/admin/profiles` | All channels |
| `PATCH` | `/api/admin/profiles/:userId` | Edit channel |
| `DELETE` | `/api/admin/profiles/:userId` | Delete channel |

---

## Deployment

### Backend → Render

1. Push to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
3. Set **Root Directory** to `backend`, **Build Command** to `npm install`, **Start Command** to `npm start`
4. Add all backend env vars in the Render dashboard — including `RUN_WORKER=true`

A `render.yaml` is included at the repo root for one-click deploy configuration.

> **Render free tier note:** The free tier has a 30-second HTTP request timeout and no support for separate background worker dynos. Both issues are handled: uploads go directly from the browser to S3 (no backend timeout risk), and the worker runs inside the web process via `RUN_WORKER=true`.

### Frontend → Vercel

1. Import the repo on [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Add env vars:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_API_URL` → your Render backend URL (e.g. `https://streamvault-api.onrender.com/api`)

After deploying both:
- Add the Vercel domain to **Clerk → Allowed Origins**
- Add the Vercel domain to your **S3 CORS** policy (`AllowedOrigins`)
- Set `CLIENT_URL` in Render to your Vercel URL

---

## License

MIT
