import { test, expect } from 'vitest'
import { ignoreFiles } from './analyze.js'

test('ignoreFiles', () => {
    expect(
        ignoreFiles({
            ignore: ['**/@prisma/*'],
            files: ['a', 'b', 'node_modules/@prisma/client'],
        }),
    ).toMatchInlineSnapshot(`
      [
        "a",
        "b",
      ]
    `)
})
