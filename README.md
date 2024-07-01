<div align='center'>
    <br/>
    <br/>
    <h3>vite-plugin-nft</h3>
    <p>Create a folder with all your ssr vite dependencies using @vercel/nft, same as the Next.js standalone option</p>
    <br/>
    <br/>
</div>

## Usage in Remix

```ts
import { nft } from 'vite-plugin-nft'

import {
    vitePlugin as remix,
    cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
} from '@remix-run/dev'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [nft({ outputFolder: 'standalone' }), remix()],
})
```

Update your start script to use the standalone directory instead of build

```diff
  "scripts": {
    "build": "remix vite:build",
    "dev": "remix vite:dev",
-    "start": "remix-serve ./build/server/index.js",
+    "start": "remix-serve ./standalone/build/server/index.js",
    "typecheck": "tsc"
  },
```

If you are inside a workspace, the standalone folder will mirror your package structure, so you will have to change the server index.js path.

For example if there is a pnpm workspace and your remix website is in `packages/website`, the start script will look like this:

```diff
  "scripts": {
    "build": "remix vite:build",
    "dev": "remix vite:dev",
-    "start": "remix-serve ./build/server/index.js",
+    "start": "remix-serve ./standalone/packages/website/build/server/index.js",
    "typecheck": "tsc"
  },
```
