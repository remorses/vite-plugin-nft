import { NodeFileTraceReasons } from '@vercel/nft'
import { Sema } from 'async-sema'
import fs from 'fs'
import path, { isAbsolute } from 'path'
import { logger, toPosixPath } from './utils.js'
import { searchForWorkspaceRoot } from 'vite'
import { Minimatch, minimatch } from 'minimatch'

export async function analyze({
    outputFolder = 'standalone',
    viteOutputs,
    ignore = [] as string[],
    additionalFiles = [] as string[],
    root,
}) {
    const base = toPosixPath(searchForWorkspaceRoot(root))

    logger.log(`starting analyzing with nft ${viteOutputs}, `)
    const { nodeFileTrace } = await import('@vercel/nft')

    // https://github.com/vercel/next.js/blob/78dc2db916e93ddcffb7418972b40e8d6006fb06/packages/next/src/build/collect-build-traces.ts#L426
    const result = await nodeFileTrace(viteOutputs, {
        base,
        mixedModules: true,

    })

    if (!result.fileList.size) {
        logger.log(`no nft files to copy`)
        return
    }

    const fileList = result.fileList
    for (const file of result.esmFileList) {
        fileList.add(file)
    }
    result.warnings.forEach((warning) => {
        logger.log('warning: ', warning.message)
    })

    const copiedFiles = new Set<string>()

    for (const file of additionalFiles) {
        fileList.add(isAbsolute(file) ? path.relative(base, file) : file)
    }

    const copySema = new Sema(10, { capacity: fileList.size })

    const outputPath = path.resolve(root, outputFolder)
    await fs.promises
        .rm(outputPath, { recursive: true, force: true })
        .catch(() => null)

    const filtered = ignoreFiles({ files: [...fileList], ignore })
    await Promise.all(
        filtered.map(async (relativeFile) => {
            await copySema.acquire()
            // console.log(relativeFile)
            const absFile = path.join(base, relativeFile)

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
                    .readlink(absFile)
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
                    await fs.promises.copyFile(absFile, fileOutputPath)
                }
            }

            await copySema.release()
        }),
    )
    logger.log(`finished copying nft files`)
}

export function ignoreFiles({ files, ignore }) {
    let excludeGlobs = ignore.map(
        (pattern) =>
            new Minimatch(pattern, {
                dot: true,
                // matchBase: true,
                magicalBraces: true,
                // partial: true,
                // debug: true,
                // nobrace: true,
                // partial: true,
            }),
    )
    return files.filter((file) => {
        if (excludeGlobs.some((glob) => glob.match(file))) {
            logger.log(`ignoring ${file}`)
            return false
        }
        return true
    })
}
