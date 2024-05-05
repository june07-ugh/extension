const fs = require('fs')
const path = require('path')
const os = require('os')
const archiver = require('archiver')

// Define paths
const originalManifestPath = './manifest.json'
const tempManifestPath = path.join(os.tmpdir(), 'temp_manifest.json')

// Read the manifest file
fs.readFile(originalManifestPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading manifest file:', err)
        return
    }

    // Parse JSON
    let manifest
    try {
        manifest = JSON.parse(data)
    } catch (error) {
        console.error('Error parsing manifest JSON:', error)
        return
    }

    // Update service worker path
    if (manifest.background && manifest.background.service_worker) {
        manifest.background.service_worker = "/dist/sw.min.js"
    } else {
        console.error('Service worker path not found in manifest.')
        return
    }

    // Write back updated manifest
    fs.writeFile(tempManifestPath, JSON.stringify(manifest, null, 4), 'utf8', (err) => {
        if (err) {
            console.error('Error writing updated manifest:', err)
            return
        }
        console.log('Manifest updated successfully.')

        // Zip files
        const output = fs.createWriteStream('ugh.zip')
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        })

        output.on('close', () => {
            console.log('Zip file created successfully.')
        })

        archive.on('error', (err) => {
            console.error('Error creating zip file:', err)
        })

        archive.pipe(output)
        archive.directory('./dist', 'dist')
        archive.directory('./icon', 'icon')
        archive.file(tempManifestPath, { name: 'manifest.json' })
        archive.directory('./_locales', '_locales')
        archive.directory('./rules', 'rules')

        archive.finalize()
    })
})
