# Family Finance Management

Family Finance Management is a small internal family finance application.

## Project Structure

- `frontend/` - Angular 21 standalone frontend
- `backend/` - ASP.NET Core backend (planned)
- `docs/` - Product requirements, design, development specifications, and test artifacts

## Frontend

The frontend uses Angular `21.2.24`, TypeScript `5.9`, and npm. It is configured with
standalone components, strict TypeScript settings, CSS, and Angular routing.

### Prerequisites

- Node.js 22+
- npm 10+

### Run Locally

```bash
cd frontend
npm start
```

Open `http://localhost:4200/` after the development server starts.

### Build

```bash
cd frontend
npm run build
```

Build output is written to `frontend/dist/family-finance/`.

## Development Rules

This project follows spec-driven development. Before implementing business features,
read the relevant product brief, requirements, design, and development specification
under `docs/`. Financial calculations remain authoritative in the backend and use VND.
