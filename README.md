# jojoCRM Frontend

Responsive web application for jojoCRM (Vite + React + Tailwind CSS).

## Starting the app against the API

1. Start the Django API server on port `8000` from `/home/demiz/Projects/jojo_crm_venv/jojoCRM`:
   ```bash
   python manage.py runserver 127.0.0.1:8000
   ```
2. Install dependencies and start the Vite dev server on `http://localhost:5173`:
   ```bash
   npm install
   npm run dev
   ```

Vite proxies `/api` requests from `http://localhost:5173` to `http://127.0.0.1:8000`.

## Shared UI Components

- [`src/components/Checkbox.jsx`](src/components/Checkbox.jsx): Custom frosted checkbox (`.crm-checkbox`, `.crm-checkbox-box`, `.crm-checkbox-icon` in [`src/index.css`](src/index.css)) used across forms, activity timelines, and role permission matrices instead of browser-default checkboxes. Supports `checked`, `indeterminate`, `disabled`, optional `label`/`children`, and standard `onChange` events.
