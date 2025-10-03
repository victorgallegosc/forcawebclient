# 🏆 Forca Cliente

A modern, responsive client for consuming tournament data from `consola.zione.com.mx` without relying on HAR files. Built with Node.js + TypeScript + Express + React, featuring session management, HTML parsing, and dark mode support.

## 📁 Project Structure

```
forca_cliente/
├── server/          # Express + TypeScript (proxy, cookie jar, parsers)
├── sdk/             # TypeScript SDK for consuming server endpoints
├── web/             # React + Vite + TypeScript (responsive UI)
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Internet connection to access `consola.zione.com.mx`

### Installation & Running

1. **Clone/setup the project:**
   ```bash
   cd forca_cliente
   ```

2. **Start the server:**
   ```bash
   cd server
   npm install
   npm run dev
   ```
   The API server listens on port `5174` by default. Set `ZIONE_API_BASE_URL` if you need a different public URL.

3. **Start the web client (in a new terminal):**
   ```bash
   cd web
   npm install
   npm run dev
   ```
   The Vite dev server runs on port `5173` by default.
4. **Open your browser and navigate to the URL shown by Vite**

## 🔧 Server Endpoints

The server provides three main endpoints that mirror the real flow from `consola.zione.com.mx`:

### `GET /api/torneos?dts={DTS}`

Fetches available tournaments from the tournament selection page.

**Example:**
```bash
curl 'https://your-backend.example.com/api/torneos?dts=DTS094'
```

**Response:**
```json
{
  "source": "https://consola.zione.com.mx/tab.posiciones.asp?dts=DTS094&m=1",
  "selectName": "fTorneo",
  "torneos": [
    { "torID": "31357", "nombre": "Torneo Ejemplo", "selected": false }
  ]
}
```

### `GET /api/horarios?dts={DTS}&torID={torID}`

Fetches available schedules/divisions for a specific tournament. Maintains session state with cookie jar.

**Example:**
```bash
curl 'https://your-backend.example.com/api/horarios?dts=DTS094&torID=31357'
```

**Response:**
```json
{
  "source": "https://consola.zione.com.mx/tab.posiciones.asp?dts=DTS094&m=2&smodo=0&torID=31357",
  "horarios": [
    { "divID": "8555", "label": "Sábado Vespertino" }
  ],
  "gpoCandidates": ["7410", "16960"],
  "grupoSelectName": "beSelGrupo"
}
```

### `GET /api/datos?dts={DTS}&torID={torID}&divID={divID}[&gpoID={gpoID}]`

Fetches all tournament data from all modules (positions, schedule, results, scoring, etc.).

**Example:**
```bash
curl 'https://your-backend.example.com/api/datos?dts=DTS094&torID=31357&divID=8555&gpoID=7410'
```

**Response:**
```json
{
  "params": { "dts": "DTS094", "torID": "31357", "divID": "8555", "gpoID": "7410" },
  "modules": {
    "posiciones": { "url": "...", "tablesCount": 2, "tables": [...] },
    "rol": { "url": "...", "tablesCount": 1, "tables": [...] },
    "resultados": { "url": "...", "tablesCount": 1, "tables": [...] },
    "goleo": { "url": "...", "tablesCount": 1, "tables": [...] },
    "defofe": { "url": "...", "tablesCount": 1, "tables": [...] },
    "tarjetas": { "url": "...", "tablesCount": 1, "tables": [...] },
    "castigados": { "url": "...", "tablesCount": 1, "tables": [...] },
    "concentrado": { "url": "...", "tablesCount": 1, "tables": [...] }
  }
}
```

## 💻 Web Interface

The web client provides:

1. **Configuration Panel**: Set server URL and DTS code
2. **Tournament Selection**: Load and select from available tournaments
3. **Schedule Selection**: Choose division/schedule with optional group ID
4. **Data Display**: Collapsible panels for each module with tables
5. **Responsive Design**: Works on desktop and mobile
6. **Dark Mode**: Toggle between light and dark themes

### Flow

1. Enter DTS code (default: `DTS094`) → Click "Cargar Torneos"
2. Select tournament → Click "Cargar Horarios"  
3. Select schedule/division → Click "Cargar Datos"
4. View all tournament data organized by modules

## 🔨 SDK Usage

The TypeScript SDK can be used programmatically:

```typescript
import { ZioneClientFlow } from './sdk/src';

const client = new ZioneClientFlow('https://your-backend.example.com');

// Load tournaments
const torneos = await client.getTorneos('DTS094');

// Load schedules for a tournament
const horarios = await client.getHorarios('DTS094', '31357');

// Load all data
const datos = await client.getDatos('DTS094', '31357', '8555', '7410');
```

## ⚙️ Technical Details

### Server Features

- **Session Management**: Maintains cookie jar across requests
- **HTML Parsing**: Extracts tables and metadata using Cheerio
- **Robust Extraction**: Multiple fallback strategies for finding schedules
- **Error Handling**: Comprehensive error reporting
- **CORS Enabled**: Ready for frontend consumption

### Key Components

- **Cookie Jar**: Manual cookie management using `undici` `Set-Cookie` headers
- **Table Parser**: Converts HTML tables to structured JSON with metadata
- **Schedule Extractor**: Finds divisions via select elements, links, or regex
- **User-Agent**: Uses proper browser UA for compatibility
- **Referer Tracking**: Maintains proper referer chain

### Data Structure

Each table includes:
- **Metadata**: Index, ID, className, title (from caption/headings)
- **Headers**: Column names from `<thead>` or first row
- **Rows**: Normalized data rows as key-value objects

## 🐛 Troubleshooting

### Common Issues

1. **Connection Errors**: Check if `consola.zione.com.mx` is accessible
2. **No Tournaments**: Verify DTS code is valid
3. **Empty Schedules**: Tournament might not have active schedules
4. **Parse Errors**: Site structure may have changed

### Debugging

Server logs show:
- URLs being fetched
- Cookie management
- Parsing results
- Error details

Check browser dev tools for frontend issues.

### Environment Variables

Server supports these environment variables in `.env`:

```env
BASE_URL=https://consola.zione.com.mx
PORT=5174
```

## 🔄 Development

### Server Development
```bash
cd server
npm run dev    # Auto-restart on changes
npm run build  # Compile to dist/
npm start      # Run compiled version
```

### SDK Development  
```bash
cd sdk
npm run build  # Compile TypeScript
npm run dev    # Watch mode
```

### Web Development
```bash
cd web
npm run dev     # Development server with HMR
npm run build   # Production build  
npm run preview # Preview production build
```

## 🌟 Features

- ✅ **No HAR Dependencies**: Direct HTTP requests to live site
- ✅ **Session Management**: Proper cookie jar handling
- ✅ **Robust Parsing**: Multiple fallback strategies
- ✅ **Complete Data**: All 8 tournament modules
- ✅ **Responsive UI**: Mobile-friendly interface
- ✅ **Dark Mode**: Built-in theme support
- ✅ **TypeScript**: Full type safety
- ✅ **Error Handling**: Comprehensive error reporting
- ✅ **CORS Ready**: Backend ready for any frontend

## 📋 API Testing

Test the server endpoints directly:

```bash
# Test tournaments
curl 'https://your-backend.example.com/api/torneos?dts=DTS094'

# Test schedules (replace torID with actual value from above)
curl 'https://your-backend.example.com/api/horarios?dts=DTS094&torID=31357'

# Test full data (replace IDs with actual values)
curl 'https://your-backend.example.com/api/datos?dts=DTS094&torID=31357&divID=8555&gpoID=7410'
```

The responses will show the live data structure and available options for your specific tournament system.

---

Built with ❤️ for tournament data enthusiasts. No HARs required! 🎯
