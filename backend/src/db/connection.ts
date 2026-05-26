import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.SQLITE_PATH || './transit.db';

// Ensure the directory for the SQLite database exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open Database Connection
export const db = new Database(dbPath, { verbose: console.log });

// Enable WAL mode for high performance concurrent reads and writes
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Schema Migrations Function
export function runMigrations() {
  console.log('Running database schema migrations...');

  // 1. Users Table (Lightweight JWT Authentication)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 2. Optimized Stations Table (Static Seeding & Progressive Loading)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      tariff_zone TEXT,
      stop_type TEXT NOT NULL,
      is_major INTEGER DEFAULT 0
    )
  `).run();

  // Create spatial index equivalent (B-Tree on coordinates) to support progressive bounding box searches
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_stations_coords 
    ON stations(latitude, longitude, is_major)
  `).run();

  // 3. API Tracker & Cost Analyser Logs Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL,
      cost_units INTEGER NOT NULL,
      status TEXT NOT NULL,
      cache_hit INTEGER DEFAULT 0
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp 
    ON api_logs(timestamp)
  `).run();

  console.log('Migrations completed successfully.');
}
