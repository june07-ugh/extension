importScripts(
    '../dist/uuidv5.min.js',
    '../dist/async.min.js',
    '../dist/nanoid.min.js',
    './utils.js',
    './settings.js',
    './google-analytics.js',
    './injection.js',
)

const VERSION = '0.0.0'
const INSTALL_URL = 'https://ugh.june07.com/install/?utm_source=ugh&utm_medium=chrome_extension&utm_campaign=extension_install&utm_content=1'
const UNINSTALL_URL = 'https://blog.june07.com/?utm_source=ugh&utm_medium=chrome_extension&utm_campaign=extension_install&utm_content=1'
const API_SERVER = 'https://api.dev.june07.com'
const FORUM_URL = 'https://forum-ugh.june07.com'
let cache = {
    requests: {}
}

// This function can't be async... should according to the docs but ran into issues! Worked fine on the Vue side, but not in the popup window.
async function messageHandler(request, sender, reply) {
    switch (request.command) {
        case 'authenticated':
            const update = { checkSSO: 1 }
            settings.update(update).then(() => reply(update))
            break
        case 'injectionResult':
            const extensionTab = await openOrUpdateTab(chrome.runtime.getURL('/dist/index.html') + `${settings.checkSSO ? '?checkSSO=1' : ''}`)

            await async.until(
                async () => (await chrome.tabs.get(extensionTab.id))?.status === 'complete',
                (next) => setTimeout(next)
            )

            sendMessage({ command: 'screenCapture', data: request.data })
            break
    }
    return true
}
function sendMessage(message) {
    if (cache?.messagePort?.postMessage) {
        try {
            cache.messagePort.postMessage(message)
        } catch (error) {
            if (error.message.match(/disconnected port/)) {
                delete cache.messagePort
            }
        }
    }
}
async function openOrUpdateTab(url) {
    const tabs = await chrome.tabs.query({ url })
    let tab

    if (tabs.length > 0) {
        tab = await chrome.tabs.update(tabs[0].id, { active: true, highlighted: true })
        await chrome.tabs.setZoom(tabs[0].id, 1.01)
        await new Promise(resolve => setTimeout(resolve, 100))
        await chrome.tabs.setZoom(tabs[0].id, 1.0)
    } else {
        tab = await chrome.tabs.create({ url, active: true })
    }
    return tab
}
chrome.runtime.onInstalled.addListener(details => {
    if (details.reason === 'install') {
        chrome.tabs.create({ url: INSTALL_URL })
    }
    googleAnalytics.fireEvent('install', { onInstalledReason: details.reason })
})
chrome.runtime.onConnect.addListener((port) => {
    cache.messagePort = port
})
chrome.runtime.onMessage.addListener(messageHandler)
chrome.runtime.onMessageExternal.addListener(messageHandler)
chrome.runtime.onSuspend.addListener(() => {
    googleAnalytics.fireEvent('resume', {})
})
chrome.runtime.onStartup.addListener(() => {
    googleAnalytics.fireEvent('startup', {})
})
chrome.commands.onCommand.addListener(async (command) => {
    switch (command) {
        case "rect-capture":
            const tabId = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id

            chrome.windows.getCurrent({ populate: true }, async window => {
                const activeTab = window.tabs.find(tab => tab.active)

                Promise.all([
                    chrome.scripting.executeScript({
                        target: { tabId, allFrames: false },
                        files: ["node_modules/cropperjs/dist/cropper.min.js"],
                    }),
                    chrome.scripting.insertCSS({
                        target: { tabId, allFrames: false },
                        files: ["src/injection.css", "node_modules/cropperjs/dist/cropper.min.css"]
                    })
                ]).then(async () => {
                    console.log("script injected deps in all frames")
                    const response = await chrome.scripting.executeScript({
                        target: { tabId, allFrames: false },
                        func: injection.cropFunc,
                        args: cache.canvasAsDataURL ? [activeTab.id, cache.canvasAsDataURL] : [activeTab.id]
                    })
                    cache.canvasAsDataURL = response[0].result
                }).then(() => {
                    console.log("script injected in all frames")
                })

            })
            break
        case "page-capture":
            pageCapture()
            break
    }
})
async function pageCapture() {
    const activeTab = (await chrome.tabs.query({ active: true, currentWindow: true }))?.[0]

    if (!activeTab) return

    const response = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: injection.screenshotFunc
    })
    const canvasAsObjectURL = response[0].result

    if (!canvasAsObjectURL) return
    openOrUpdateTab(chrome.runtime.getURL('/dist/index.html') + `?${canvasAsObjectURL ? `screencapture=${canvasAsObjectURL}&tabId=${activeTab.id}&` : ''}${activeTab.url ? `url=${encodeURIComponent(activeTab.url)}&` : ''}${settings.checkSSO ? 'checkSSO=1' : ''}`)
}
async function fetchSVGContent() {
    const svgFilePath = './icon/ugh.svg'

    try {
        // Fetch the SVG file
        const response = await fetch(chrome.runtime.getURL(svgFilePath))

        // Check if the fetch was successful
        if (!response.ok) {
            throw new Error('Failed to fetch SVG file')
        }

        // Return the SVG content as text
        return await response.text()
    } catch (error) {
        console.log('Error fetching SVG file:', error)
        return null
    }
}
async function markupPage(tabId, ughs) {
    const cacheKey = `injected-${tabId}-markupFunc`
    const svgIcon = await fetchSVGContent()

    // if (cache[cacheKey]) return

    Promise.all([
        chrome.scripting.executeScript({
            target: { tabId, allFrames: false },
            files: ["node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"]
        }),
        chrome.scripting.insertCSS({
            target: { tabId, allFrames: false },
            files: ["src/injection.css", "node_modules/bootstrap/dist/css/bootstrap.min.css", "node_modules/animate.css/animate.min.css"]
        })
    ]).then(async () => {
        console.log("script injected deps in all frames")
        await chrome.scripting.executeScript({
            target: { tabId, allFrames: false },
            func: injection.markupFunc,
            args: [ughs, svgIcon],
        })
        cache[cacheKey] = true
        console.log("markupFunc injected in all frames")
    })




}
async function getUsername() {
    if (cache.requests.username && cache.requests.username.timestamp > Date.now() - 5 * 60 * 1000) {
        // console.log('Using cached username', ((Date.now() - 5 * 60 * 1000) - cache.requests.username.timestamp)/1000, cache.requests.username)
        return cache.requests.username.json
    }
    const response = await fetch(`${API_SERVER}/v1/ugh/username`)

    if (!response.ok) {
        return
    }

    cache.requests.username = {
        ...await response.json(),
        timestamp: Date.now()
    }

    return cache.requests.username
}
async function updateBadgeIconIfNeeded(url, jsonData) {
    const ughed = await didUgh(url, jsonData)
    if (ughed) {
        chrome.action.setIcon({
            path: chrome.runtime.getManifest().action.ughed
        })
    }
}
async function navigationHandler(details) {
    // perform lookup based on URL, cache heavily for performance, should probably lever opt-in filtering along with common sites, vs EVERYTHING
    const tab = await chrome.tabs.get(details.tabId)

    if (tab.url !== details.url) {
        // ignore all the cruft loaded on the page and just focus on the main document
        return
    }

    try {
        const proxyUrl = details.url.match(/(.*).ugh.june07.com$/)?.[1]
        const url = proxyUrl || details.url
        const uuid = uuidv5(url.split('?')[0], uuidv5.URL)
        const nocache = new URL(url).searchParams.get('nocache')
        const result = await fetch(`${API_SERVER}/v1/ugh/${uuid}${nocache ? '?nocache=' + nocache : ''}`)

        if (!result.ok) {
            throw new Error(`Failed to fetch data: ${result.status} ${result.statusText}`)
        }

        const jsonData = await result.json() // Extract JSON data from the response

        if (!jsonData._id) {
            chrome.action.setBadgeText({ text: '0' })
            updateBadgeIconIfNeeded(url)
            return
        }
        chrome.action.setBadgeText({ text: `${jsonData.ughs.length}` })
        saveToIndexDb(jsonData)

        await async.until(
            async () => (await chrome.tabs.get(details.tabId))?.status === 'complete',
            (next) => setTimeout(next)
        )

        markupPage(details.tabId, jsonData)
        updateBadgeIconIfNeeded(url, jsonData)
    } catch (error) {
        console.log('Error:', error)
    }
}
async function didUgh(url, jsonData) {
    const uuid = uuidv5(url.split('?')[0], uuidv5.URL)

    if (jsonData) {
        // if there current response data check it first
        const username = await getUsername()

        if (username && jsonData.ughs.some(ugh => ugh.user.name === username)) {
            return true
        }
    }

    // search indexdb for an ugh with this url
    if (!cache.personalUghsObjectStore) {
        return false
    }
    return new Promise(resolve => {
        const transaction = cache.db.transaction(['personalUghs'], 'readonly')
        cache.personalUghsObjectStore = transaction.objectStore('personalUghs')

        const getRequest = cache.personalUghsObjectStore.get(uuid)

        getRequest.onsuccess = function (event) {
            resolve(Boolean(event.target.result))
        }

        getRequest.onerror = function (event) {
            console.log('Error getting data:', event.target.error)
            resolve(false)
        }
    })
}
async function openDBConnection() {
    // Open a connection to the IndexedDB database
    const openRequest = indexedDB.open('myDatabase', 1)

    openRequest.onupgradeneeded = function (event) {
        cache.db = event.target.result

        // Create or upgrade the object store
        cache.globalUghsObjectStore = cache.db.createObjectStore('globalUghs', { keyPath: '_id' })
        cache.personalUghsObjectStore = cache.db.createObjectStore('personalUghs', { keyPath: 'uuid' })

        // Optionally, define indexes or other configurations for the object store
    }

    openRequest.onsuccess = function (event) {
        cache.db = event.target.result
    }

    openRequest.onerror = function (event) {
        console.log('Error opening database:', event.target.error)
    }
}
async function saveToIndexDb(jsonData) {
    if (!cache.db) {
        openDBConnection()
        await async.until(
            async () => cache.db,
            (next) => setTimeout(next)
        )
    }
    function updatePersonalUghs() {
        try {
            const transaction = cache.db.transaction(['personalUghs'], 'readwrite')
            cache.personalUghsObjectStore = transaction.objectStore('personalUghs')

            if (jsonData.ughedId?.uuid) {
                cache.personalUghsObjectStore.put({ uuid: jsonData.ughedId.uuid, ...jsonData })
            }
        } catch (error) {
            console.log(error)
        }
    }
    function updateGlobalUghs() {
        if (!jsonData.ughedId?._id) return

        try {
            // Access the object store
            const transaction = cache.db.transaction(['globalUghs'], 'readwrite')
            cache.globalUghsObjectStore = transaction.objectStore('globalUghs')

            // Get the object by its _id
            const getRequest = cache.globalUghsObjectStore.get(jsonData.ughedId._id)

            getRequest.onsuccess = function (event) {
                const existingObject = event.target.result

                // If the object exists, update the ughs array
                if (existingObject) {
                    // Update or add new items to the ughs array
                    if (existingObject.ughs) {
                        // Merge the new ughs with the existing ones, assuming ughs is an array
                        existingObject.ughs.push(...jsonData.ughs)
                    } else {
                        // If ughs array doesn't exist, create it
                        existingObject.ughs = jsonData.ughs
                    }

                    // Update the object in IndexedDB
                    const updateRequest = cache.globalUghsObjectStore.put(existingObject)

                    updateRequest.onsuccess = function (event) {
                        console.log('Data updated successfully:', event.target.result)
                    }

                    updateRequest.onerror = function (event) {
                        console.log('Error updating data:', event.target.error)
                    }
                } else {
                    // Add the new object to IndexedDB
                    const addRequest = cache.globalUghsObjectStore.add({ _id: jsonData.ughedId._id, ...jsonData })

                    addRequest.onsuccess = function (event) {
                        console.log('Data added successfully:', event.target.result)
                    }

                    addRequest.onerror = function (event) {
                        console.log('Error adding data:', event.target.error)
                    }
                }
            }

            getRequest.onerror = function (event) {
                console.log('Error getting data:', event.target.error)
            }
        } catch (error) {
            console.log(error)
        }
    }
    updatePersonalUghs()
    updateGlobalUghs()
}
chrome.webNavigation.onBeforeNavigate.addListener(
    navigationHandler,
    { url: settings.filters }
)
chrome.action.setBadgeBackgroundColor({ color: [255, 255, 255, 255] })
chrome.action.setBadgeTextColor({ color: 'black' })
chrome.action.onClicked.addListener(async () => {
    const url = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.url.split('?')[0]

    if (!url) return

    const alreadyUghed = await didUgh(url)
    console.log('alreadyUghed', alreadyUghed)
    if (alreadyUghed) {
        await openOrUpdateTab(FORUM_URL)
        return
    }
    try {
        const response = await fetch(`${API_SERVER}/v1/ugh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url
            }),
            credentials: "include"
        })
        if (response.ok) {
            const json = await response.json()

            console.log(json)
            if (json) {
                saveToIndexDb(json)
            }
        }
    } catch (error) {
        console.log('Error:', error)
    }
})
