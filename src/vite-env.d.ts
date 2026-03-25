// This file ensures TypeScript understands `import.meta.env` (Vite).
interface ImportMetaEnv {
  readonly VITE_FMP_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

