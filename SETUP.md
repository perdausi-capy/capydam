# Capydam Setup & Run Guide

Follow these straightforward steps to set up and run the Capydam system locally.

## 📌 Prerequisites

Before starting, ensure you have the following installed on your machine:
- **[Node.js](https://nodejs.org/)** (v18 or higher)
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** or Docker Engine + Docker Compose

---

## 🚀 1. Start the Infrastructure (Database & Storage)

The system relies on **PostgreSQL** (Database) and **MinIO** (Storage). We use Docker to run these instantly.

1. Open a terminal in the root `capydam` directory.
2. Run the following command:
   ```bash
   docker compose up -d
   ```
*(This starts the database on port `5432` and MinIO on ports `9000` & `9001` in the background).*

---

## ⚙️ 2. Set Up the Server (Backend)

1. Open a terminal and navigate to the `server` folder:
   ```bash
   cd server
   ```
2. Install the backend dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables by creating a `.env` file in the `server` directory:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://postgres:password@localhost:5432/capydam"
   DIRECT_URL="postgresql://postgres:password@localhost:5432/capydam"
   JWT_SECRET="fallback_secret"
   CLIENT_URL="http://localhost:5173"
   MINIO_ENDPOINT="http://localhost:9000"
   MINIO_ACCESS_KEY="admin"
   MINIO_SECRET_KEY="CAPYDAM2025"
   OPENAI_API_KEY="sk-dummy-key"
   ```
   *(Note: Overwrite the dummy keys with real ones if OpenAI functionality is necessary).*

4. Initialize the database schema:
   ```bash
   npx prisma db push
   ```
5. Seed the database with default data (like the pre-configured admin account):
   ```bash
   npx prisma db seed
   ```

---

## 🖥️ 3. Set Up the Client (Frontend)

1. Open a **new** terminal and navigate to the `client` folder:
   ```bash
   cd client
   ```
2. Install the frontend dependencies:
   ```bash
   npm install
   ```

---

## 🔥 4. Run the Application (Development Mode)

Start both the server and the client in separate terminal windows.

**Terminal 1 (Server):**
```bash
cd server
npm run dev
```
*(The backend logic will run on http://localhost:5000).*

**Terminal 2 (Client):**
```bash
cd client
npm run dev
```
*(The React UI will run on http://localhost:5173).*

---

## 🎉 5. Login and Access

Open your browser and navigate to **[http://localhost:5173](http://localhost:5173)**.

You can log in with the seeded default admin credentials:
> - **Email:** `capytech@dam.admin`
> - **Password:** `capytech2025!`

---

## 📦 How to Build for Production

If you are preparing for a deployment:

1. **Build the Server:**
   ```bash
   cd server
   npm run build
   ```
   *To run the production build:* `npm start` *(starts `node dist/index.js`)*

2. **Build the Client:**
   ```bash
   cd client
   npm run build
   ```
   *The built frontend assets will be output to the `client/dist` directory.*
