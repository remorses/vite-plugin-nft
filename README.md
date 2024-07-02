<div align='center'>
    <br/>
    <br/>
    <h3>vite-plugin-nft</h3>
    <p>Next.js standalone implementation for Vite</p>
    <br/>
    <br/>
</div>

## Installation

```bash
npm install vite-plugin-nft
```

## What does `vite-plugin-nft` do?

vite-plugin-nft is similar to [Next.js standalone](https://nextjs.org/docs/pages/api-reference/next-config-js/output#automatically-copying-traced-files) option: it automatically creates a standalone folder that copies only the necessary files for a production deployment including select files in node_modules.

This is useful when you want to create a Docker image for a monorepo without having to install the whole monorepo inside the Dockerfile. Instead you can just copy the standalone directory.

The vite plugin basically waits for the ssr build to finish and then copies the necessary files to the output folder. It uses the @vercel/nft package to do the file tracing.

## Usage in Remix

```ts
import { nft } from 'vite-plugin-nft'
import { vitePlugin as remix } from '@remix-run/dev'
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

Your Dockerfile now becomes a simple COPY operation:

```dockerfile
# Dockerfile
# ...

WORKDIR /app

RUN echo "{\"type\":\"module\"}" > package.json

# install any required native dependencies
RUN npm install canvas

RUN npm install -g @remix-run/serve

COPY ./standalone /app/standalone
# required for remix-serve to serve client files
COPY ./build /app/build

CMD ["remix-serve", "./standalone/packages/website/build/server/index.js"]

```

If you use native dependencies with this approach, you will need to install them inside the Dockerfile and add them to your .dockerfile, so the wrong binaries are not copied from the standalone directory


```
# .dockerignore
**/node_modules/canvas
**/node_modules/@prisma
```