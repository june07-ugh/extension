const fs = require('fs')
const { rollup } = require('rollup')
const chokidar = require('chokidar')

const watchDir = 'dist'
const deps = [
    {
        input: 'node_modules/uuid/dist/esm-browser/v5.js',
        watch: `${watchDir}/uuidv5.min.js`,
        name: 'uuidv5'
    },
    {
        input: 'node_modules/cropperjs/dist/cropper.min.js',
        watch: `${watchDir}/cropper.min.js`,
        name: 'cropperjs'
    },
    {
        input: 'node_modules/cropperjs/dist/cropper.min.css',
        watch: `${watchDir}/cropper.min.css`,
        name: 'croppercss'
    },
    {
        input: 'node_modules/nanoid/index.browser.js',
        watch: `${watchDir}/nanoid.min.js`,
        name: 'nanoid'
    },
    {
        input: 'node_modules/async/dist/async.min.js',
        watch: `${watchDir}/async.min.js`,
        name: 'async'
    },
    {
        input: 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js',
        watch: `${watchDir}/bootstrap.bundle.min.js`,
        name: 'bootstrapjs'
    },
    {
        input: 'node_modules/bootstrap/dist/css/bootstrap.min.css',
        watch: `${watchDir}/bootstrap.min.css`,
        name: 'bootstrapcss'
    },
    {
        input: 'node_modules/animate.css/animate.min.css',
        watch: `${watchDir}/animate.min.css`,
        name: 'animate'
    },
]
const watchFiles = deps.map(dep => dep.watch)

console.log({ watchFiles })

if (!fs.existsSync(watchDir)) {
    fs.mkdirSync(watchDir)
}
const watcher = chokidar.watch(watchFiles, {
    persistent: process.env.NODE_ENV === 'production' ? false : true
})

watcher.on('ready', async () => {
    build()
})

watcher.on('unlink', async () => {
    build()
})

async function build() {
    watchFiles.map(async (path) => {
        if (!fs.existsSync(path)) {
            const dep = deps.find((dep) => dep.watch === path)

            if (dep.input.match(/cropper|async|bootstrap|animate/)) {
                console.log(`copying dep ${dep.input} to ${dep.watch}`)
                fs.copyFileSync(dep.input, dep.watch)
            } else {
                console.log(`rolling up ${path}...`)
                try {
                    const bundle = await rollup({
                        input: dep.input,
                    })
                    const { output } = await bundle.generate({
                        compact: true,
                        format: 'iife',
                        file: dep.watch,
                        name: dep.name,
                    })

                    const code = output[0].code

                    fs.writeFileSync(dep.watch, code)
                } catch (error) {
                    console.error(error)
                }
            }
        }
    })

}