/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly REACT_APP_API_URL: string
  readonly VITE_REGION: string
  readonly VITE_API_ENDPOINT: string
  readonly VITE_USER_POOL_ID: string
  readonly VITE_USER_POOL_CLIENT_ID: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}