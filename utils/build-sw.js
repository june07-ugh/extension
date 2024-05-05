const fs = require('fs')
const { basename } = require('path')
const { minify } = require('terser')
const CleanCSS = require('clean-css')
const { rollup } = require('rollup')

const watchDir = 'dist'
const files = [
    {
        input: './src/sw.js',
        watch: `${watchDir}/sw.min.js`,
        name: 'sw'
    },
    {
        input: './src/injection.css',
        watch: `${watchDir}/injection.min.css`,
        name: 'ughcss'
    },
    {
        input: './src/utils.js',
        watch: `${watchDir}/utils.min.js`,
        name: 'utils'
    },
    {
        input: './src/settings.js',
        watch: `${watchDir}/settings.min.js`,
        name: 'settings'
    },
    {
        input: './src/google-analytics.js',
        watch: `${watchDir}/google-analytics.min.js`,
        name: 'analytics'
    },
    {
        input: './src/injection.js',
        watch: `${watchDir}/injection.min.js`,
        name: 'injection'
    }
]

async function build() {
    (() => {
        const version = require('../package.json').version
        const manifest = require('../manifest.json')

        manifest.version = version
        fs.writeFileSync('./manifest.json', JSON.stringify(manifest, null, 4))
    })()
    files.map(async (file) => {
        if (file.name === 'ughcss') {
            console.log(`minifying ${file.input} to ${file.watch}`)
            const inputCSS = fs.readFileSync(file.input, 'utf-8')
            const minifiedCSS = new CleanCSS({
                level: {
                    1: {
                        all: true,
                        normalizeUrls: false
                    }
                }
            }).minify(inputCSS).styles
            fs.writeFileSync(file.watch, minifiedCSS, 'utf-8')
        } else {
            console.log(`bundling ${file.input} to ${file.watch}`)
            try {
                const bundle = await rollup({
                    input: file.input,
                    plugins: [{
                        name: 'modify-sw-imports',
                        transform(code, id) {
                            // Check if the current file is sw.js
                            if (basename(id) === 'sw.js') {
                                // Replace '../dist' with './' in importScripts
                                code = code.replace(/\.\.\/dist/g, '.')
                                code = code.replace(/api\.dev\.june07\.com/g, 'api.june07.com')
                                code = code.replace(/\.\/(utils|settings|google-analytics|injection)\.js/g, './$1.min.js')
                                code = code.replace('node_modules/cropperjs/dist/cropper.min.js', 'dist/cropper.min.js')
                                code = code.replace('node_modules/cropperjs/dist/cropper.min.css', 'dist/cropper.min.css')
                                code = code.replace('node_modules/bootstrap/dist/js/bootstrap.bundle.min.js', 'dist/bootstrap.bundle.min.js')
                                code = code.replace('node_modules/bootstrap/dist/css/bootstrap.min.css', 'dist/bootstrap.min.css')
                                code = code.replace('node_modules/animate.css/animate.min.css', 'dist/animate.min.css')
                                code = code.replace(/src\/injection\.css/g, 'dist/injection.min.css')
                            }
                            return { code, map: null }
                        }
                    }]
                })
                const { output } = await bundle.generate({
                    compact: true,
                    format: 'iife',
                    file: file.watch,
                    name: file.name,
                })

                const code = (await minify(output[0].code)).code

                fs.writeFileSync(file.watch, code)
            } catch (error) {
                console.error(error)
            }
        }
    })
}

build()