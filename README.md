# Travel Statement Dashboard

Small local web app that ingests a SimplyGo transit statement PDF and turns it into a dashboard.

## Run

```powershell
npm start
```

Then open `http://localhost:3000`.

## Vercel

- Static pages are served from `public/`.
- API endpoints for hosted deployments live in `api/`.
- For local Vercel-style development, run:

```powershell
npm run dev
```

## Notes

- Drop a `.pdf` or `.txt` statement onto the index page to generate the dashboard.
- In this workspace, the sample button loads a bundled text snapshot extracted from the provided PDF.
- PDF parsing currently relies on a local `pdftotext` installation. On hosted Vercel deployments, the sample statement and plain-text statement exports work now; fully hosted PDF parsing would need a bundled JavaScript PDF parser.
