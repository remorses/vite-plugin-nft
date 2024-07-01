import { Sema } from 'async-sema'
import fs from 'fs'
import path from 'path'
import { Plugin, searchForWorkspaceRoot } from 'vite'

import { NodeFileTraceReasons } from '@vercel/nft'

const logger = {
    log(...args: any[]) {
        console.log('[standalone]', ...args)
    },
}

export const standalone = (): Plugin => {
    let root = ''
    let outDir = ''

    let viteOutputs: string[] = []

    return {
        name: 'vite-plugin-standalone',
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
            await analyze({ viteOutputs, root })
        },
    }
}

export async function analyze({ viteOutputs, root }) {
    const base = toPosixPath(searchForWorkspaceRoot(root))

    logger.log(`starting analyzing with nft ${viteOutputs}, `)
    const { nodeFileTrace } = await import('@vercel/nft')

    // https://github.com/vercel/next.js/blob/78dc2db916e93ddcffb7418972b40e8d6006fb06/packages/next/src/build/collect-build-traces.ts#L426
    const result = await nodeFileTrace(viteOutputs, {
        base,
        mixedModules: true,
        ts: false,
        // readFile(path) {
        //     console.log(path)
        //     return fs.readFileSync(path, 'utf8')
        // },
    })

    // We are done, no native dependencies need to be copied
    if (!result.fileList.size) {
        logger.log(`no standalone files to copy`)
        return
    }

    if (result.warnings.size && isYarnPnP()) {
        throw new Error(
            'Standalone build is not supported when using Yarn PnP and native dependencies.',
        )
    }

    const fileList = result.fileList
    for (const file of result.esmFileList) {
        fileList.add(file)
    }

    const copiedFiles = new Set<string>()

    const files = [...result.fileList]
    const copySema = new Sema(10, { capacity: files.length })

    const outputPath = path.resolve(root, 'standalone')
    await fs.promises
        .rm(outputPath, { recursive: true, force: true })
        .catch(() => null)
    await Promise.all(
        files.map(async (relativeFile) => {
            await copySema.acquire()
            // console.log(relativeFile)
            const tracedFilePath = path.join(base, relativeFile)
            const fileOutputPath = path.join(outputPath, relativeFile)
            if (!fileOutputPath.startsWith(outputPath)) {
                logger.log(
                    `Error: fileOutputPath is not under outputPath: ${fileOutputPath}`,
                )
                return
            }

            if (!copiedFiles.has(fileOutputPath)) {
                copiedFiles.add(fileOutputPath)

                const dir = path.dirname(fileOutputPath)
                // logger.log(`mkdir ${dir}`)
                await fs.promises.mkdir(dir, {
                    recursive: true,
                })
                const symlink = await fs.promises
                    .readlink(tracedFilePath)
                    .catch(() => null)

                if (symlink) {
                    try {
                        // logger.log(`symlinking ${symlink} to ${fileOutputPath}`)
                        await fs.promises.symlink(symlink, fileOutputPath)
                    } catch (e: any) {
                        if (e.code !== 'EEXIST') {
                            throw e
                        }
                    }
                } else {
                    // logger.log(`copying ${tracedFilePath} to ${fileOutputPath}`)
                    await fs.promises.copyFile(tracedFilePath, fileOutputPath)
                }
            }

            await copySema.release()
        }),
    )
    logger.log(`finished copying standalone files`)
}

function toPosixPath(path: string): string {
    const pathPosix = path.split('\\').join('/')
    return pathPosix
}

function isYarnPnP(): boolean {
    try {
        require('pnpapi')
        return true
    } catch {
        return false
    }
}

export function getFilesMapFromReasons(
    fileList: Set<string>,
    reasons: NodeFileTraceReasons,
    ignoreFn?: (file: string, parent?: string) => Boolean,
) {
    // this uses the reasons tree to collect files specific to a
    // certain parent allowing us to not have to trace each parent
    // separately
    const parentFilesMap = new Map<string, Map<string, { ignored: boolean }>>()

    function propagateToParents(
        parents: Set<string>,
        file: string,
        seen = new Set<string>(),
    ) {
        for (const parent of parents || []) {
            if (!seen.has(parent)) {
                seen.add(parent)
                let parentFiles = parentFilesMap.get(parent)

                if (!parentFiles) {
                    parentFiles = new Map()
                    parentFilesMap.set(parent, parentFiles)
                }
                const ignored = Boolean(ignoreFn?.(file, parent))
                parentFiles.set(file, { ignored })

                const parentReason = reasons.get(parent)

                if (parentReason?.parents) {
                    propagateToParents(parentReason.parents, file, seen)
                }
            }
        }
    }

    for (const file of fileList!) {
        const reason = reasons!.get(file)
        const isInitial =
            reason?.type.length === 1 && reason.type.includes('initial')

        if (
            !reason ||
            !reason.parents ||
            (isInitial && reason.parents.size === 0)
        ) {
            continue
        }
        propagateToParents(reason.parents, file)
    }
    return parentFilesMap
}
