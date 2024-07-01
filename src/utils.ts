export const logger = {
    log(...args: any[]) {
        console.log('[standalone]', ...args)
    },
}

export function toPosixPath(path: string): string {
    const pathPosix = path.split('\\').join('/')
    return pathPosix
}
