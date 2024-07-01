import path from 'path'
import { Plugin } from 'vite'

import { analyze } from './analyze'
import { logger, toPosixPath } from './utils'

export const nft = ({ outputFolder = 'standalone' } = {}): Plugin => {
    let root = ''
    let outDir = ''

    let viteOutputs: string[] = []

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
                    'Warning: config.ssr.noExternal is true, this will make vite-plugin-nft trace much slower and unnecessary',
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
            viteOutputs.push(file)
        },
        async closeBundle() {
            await analyze({ viteOutputs, outputFolder, root })
        },
    }
}
