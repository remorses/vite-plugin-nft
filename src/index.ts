import path from 'path'
import { Plugin } from 'vite'

import { analyze } from './analyze.js'
import { logger, toPosixPath } from './utils.js'

export const nft = ({
    outputFolder = 'standalone',
    ignore = [] as string[],
} = {}): Plugin => {
    let root = ''
    let outDir = ''

    return {
        name: 'vite-plugin-nft',
        apply(_, env) {
            return !!env.isSsrBuild
        },
        enforce: 'post',

        buildStart() {
            // rollupResolve = this.resolve.bind(this)
        },
        async configResolved(config) {
            root = toPosixPath(config.root)
            outDir = toPosixPath(config.build.outDir)
        },
        config(config) {
            // if config.ssr.noExternal is true, alert the user it should not be, because this way nft trace will take ages
            if (config.ssr?.noExternal) {
                logger.log(
                    'Warning: config.ssr.noExternal is true, this makes vite-plugin-nft useless and nft tracing becomes much slower',
                )
            }
            return {}
        },
        async writeBundle(x, bundle) {
            if (!x.dir) {
                logger.log(`no dir ${JSON.stringify({ x }, null, 2)}`)
                return
            }
            if (typeof x.entryFileNames !== 'string') {
                logger.log(
                    `entryFileNames is not a string: ${typeof x.entryFileNames}: ${JSON.stringify({ x }, null, 2)}`,
                )
                return
            }
            const file = path.resolve(x.dir, x.entryFileNames)
            logger.log(`found bundle ${file}`)
            await analyze({ viteOutputs: [file], outputFolder, ignore, root })
        },
    }
}
