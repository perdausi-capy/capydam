This `README.md` accurately reflects your **"Zero-Latency" Architecture**, the move to **Self-Hosted Infrastructure** (MinIO/Postgres), and the new **Apps Hub** we just built.

You can create a file named `README.md` in your project root and paste this content.

---

# 🦦 Capydam

> **Intelligent Digital Asset Management (DAM) for Instructional Designers**

CapyDam is a fully self-hosted, AI-powered asset management system designed to centralize media resources, streamline instructional design workflows, and provide ultra-low latency access to creative assets.

Unlike traditional cloud DAMs, CapyDam operates on a **"Zero-Latency" local infrastructure**, combining the power of **PostgreSQL + pgvector** for AI search and **MinIO** for high-performance S3-compatible object storage.

---

## 🚀 Key Features

### 🧠 **AI-Powered Discovery**

* **Semantic Search:** Find images based on *concept* (e.g., "happy team meeting") rather than just filenames, powered by OpenAI embeddings and `pgvector`.
* **Auto-Tagging:** Automatically generates descriptive tags for uploaded assets.

### 🏢 **Centralized Apps Hub**

A unified dashboard integrating specialized tools for CapyTech workflows:

* **SCORM Extractor:** Unpack and inspect e-learning packages directly in the browser.
* **JRD Assets:** Specialized view for project-specific resource management.
* **Google DDL Generator:** Generate direct download links for Google Drive files (bypassing previews).

### ⚡ **High-Performance Infrastructure**

* **Self-Hosted Storage:** Uses MinIO (S3-compatible) running locally via Docker to eliminate cloud egress fees and latency.
* **Real-Time Collaboration:** Built-in chat and asset commenting system powered by Socket.io.
* **Role-Based Access:** Granular permissions for **Admins** (System & Stats), **Editors** (Upload & Manage), and **Users** (View & Download).

---

## 🛠️ Technology Stack

| Component | Technology | Description |
| --- | --- | --- |
| **Frontend** | React (Vite) | Fast, modern UI with TailwindCSS & Lucide Icons. |
| **Backend** | Node.js (Express) | REST API handling auth, uploads, and AI logic. |
| **Database** | PostgreSQL 16 | Relational data + `pgvector` extension for AI. |
| **Storage** | MinIO | Self-hosted S3-compatible object storage. |
| **ORM** | Prisma | Type-safe database client and schema management. |
| **Real-Time** | Socket.io | Live chat, notifications, and online status. |
| **Infrastructure** | Docker & Nginx | Containerized services served via Nginx reverse proxy. |

---

## ⚙️ Installation (Local Development)

### Prerequisites

* **Node.js** (v18+)
* **Docker & Docker Compose** (Required for DB & Storage)
* **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/capydam.git
cd capydam

```

### 2. Start Infrastructure (DB & MinIO)

We use Docker to spin up PostgreSQL and MinIO without polluting your local OS.

```bash
# This creates a local Postgres DB on port 5432 and MinIO on 9000
docker compose up -d

```

* **DB URL:** `postgresql://postgres:password@localhost:5432/capydam`
* **MinIO Console:** `http://localhost:9001` (User: `admin` / Pass: `CAPYDAM2025`)

### 3. Backend Setup

```bash
cd server
npm install

# Create a .env file (Ask team for full keys or use the template below)
cp .env.example .env 

# Initialize Database Schema
npx prisma db push

# Seed the Database (Creates default Admin)
npx prisma db seed

```

> **Default Login:**
> * **Email:** `capytech@dam.admin`
> * **Password:** `capytech2025!`
> 
> 

### 4. Frontend Setup

Open a new terminal:

```bash
cd client
npm install
npm run dev

```

Your app is now running at **`http://localhost:5173`**! 🚀

---

## 📂 Project Structure

```bash
capydam/
├── client/                 # React Frontend (Vite)
│   ├── src/
│   │   ├── components/     # Reusable UI (Layout, AssetCard, etc.)
│   │   ├── pages/          # Application Routes (Apps.tsx, Library, Chat)
│   │   ├── context/        # Global State (Auth, Socket, Theme)
│   │   └── api/            # Axios setup & Interceptors
│
├── server/                 # Node.js Backend
│   ├── src/
│   │   ├── controllers/    # Route Logic (Assets, Auth, Admin)
│   │   ├── routes/         # API Endpoints
│   │   └── lib/            # Utilities (Prisma, Storage, OpenAI)
│   ├── prisma/             # DB Schema & Seed Scripts
│   └── scripts/            # Maintenance scripts (Categorization, File Checks)
│
└── docker-compose.yml      # Local Infrastructure Definition

```

---

## 🔌 API & Integration

### Embedded Apps Architecture

The **Apps Hub** (`/apps`) supports two types of integrations:

1. **Internal Apps:** React components routed directly within the app (e.g., `SCORM Extractor`).
2. **External Apps:** Third-party tools (e.g., Google Sites tools) handled via the `isExternal` flag.
* *Note:* Apps blocking iframe embedding (like Google Sites) are configured to automatically launch in a new tab for seamless UX.



### Infrastructure Context

* **Production Environment:** Runs on a localized VPS (`cs6`) using Nginx as a reverse proxy.
* **Storage Migration:** Successfully migrated from Supabase Cloud Storage to local MinIO in Jan 2026, reducing latency from ~800ms to <40ms.

---

## 🛡️ Security Notes

* **Authentication:** JWT-based session management.
* **RBAC:** Strict separation of concerns. *Editors* can manage assets but are restricted from System Analytics (handled via `Layout.tsx` checks).
* **Environment:** Never commit `.env` or `docker-compose.yml` to the repository.

---
