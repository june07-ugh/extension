const fs = require('fs').promises
const path = require('path')

const sourceDir = './src/ui/dist'
const targetDir = './dist'

async function copyFiles(source, target) {
    try {
        const files = await fs.readdir(source)
        for (const file of files) {
            const sourcePath = path.join(source, file)
            const targetPath = path.join(target, file)
            const stats = await fs.stat(sourcePath)
            if (stats.isDirectory()) {
                await fs.mkdir(targetPath, { recursive: true })
                await copyFiles(sourcePath, targetPath)
            } else {
                await fs.copyFile(sourcePath, targetPath)
            }
        }
        console.log(`Successfully copied files from ${source} to ${target}`)
    } catch (err) {
        console.error(`Error copying files: ${err}`)
    }
}

copyFiles(sourceDir, targetDir)
