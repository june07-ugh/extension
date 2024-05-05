(async function (injection) {
    injection.cropFunc = async (tabId, dataURL) => {
        async function cropper(canvas) {
            const topOffset = window.scrollY
            const wrapper = document.createElement('div')

            wrapper.id = 'ugh-cropper-wrapper'
            wrapper.style.position = 'fixed'
            // wrapper.style.opacity = '0.5'

            wrapper.style.width = '100vw'
            wrapper.style.height = '100vh'
            wrapper.style.zIndex = 99999 // Ensure the image is above other content
            // Append the canvas to the wrapper
            wrapper.appendChild(canvas)

            // Prepend the wrapper to the body
            document.body.prepend(wrapper)

            // strange... not sure why this prevents a blurred overlay...
            await new Promise(resolve => setTimeout(resolve, 500))

            const cropper = new Cropper(canvas, {
                background: false,
                aspectRatio: NaN, // Allow users to freely select the area,
                autoCrop: false
            })
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    // Capture the cropped canvas and return it
                    const croppedCanvas = cropper.getCroppedCanvas({
                        imageSmoothingQuality: 'high',
                    })
                    const imageData = croppedCanvas.toDataURL()
                    const crop = cropper.getCropBoxData()
                    const cropWithTopOffset = {
                        ...crop,
                        top: crop.top + topOffset
                    }

                    chrome.runtime.sendMessage({
                        command: 'injectionResult', data: {
                            image: imageData,
                            width: croppedCanvas.width,
                            height: croppedCanvas.height,
                            //
                            crop: Object.values(cropWithTopOffset).join(','),
                            url: document.location.href.split('?')[0],
                            tabId
                        }
                    })

                    // cleanup by removing the injected code
                    wrapper.parentNode?.removeChild(wrapper)
                } else if (event.key === 'Escape') {
                    wrapper.parentNode?.removeChild(wrapper)
                    cropper.destroy()

                }
            })
        }

        // html2canvas(document.body).then(canvas => cropper(canvas))
        const screenshotViaMediaDevices = async (selector = 'body') => {
            let canvas

            if (!dataURL) {
                const mainContentArea = document.querySelector(selector)
                // const cropTarget = await CropTarget.fromElement(mainContentArea)

                // Prompt user to share the tab's content.
                const stream = await navigator.mediaDevices.getDisplayMedia({ preferCurrentTab: true })
                // const [track] = stream.getVideoTracks()

                // Start cropping the self-capture video track using the CropTarget <-- Magic!
                // await track.cropTo(cropTarget)

                canvas = await drawToCanvas(stream)
                stream.getTracks().forEach(track => track.stop())
            } else {
                canvas = await deserializeCanvas(dataURL)
            }

            cropper(canvas)

            return canvas.toDataURL()

            async function drawToCanvas(stream) {
                const canvas = document.createElement("canvas")
                const video = document.createElement("video")
                video.srcObject = stream

                // Play it.
                await video.play()

                // Draw one video frame to canvas.
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight
                canvas.id = 'ugh-cropper-canvas'
                canvas.getContext("2d").drawImage(video, 0, 0)

                return canvas
            }
            function deserializeCanvas(base64Data) {
                const canvas = document.createElement('canvas')
                const context = canvas.getContext('2d')
                const image = new Image()

                return new Promise((resolve) => {
                    image.onload = function () {
                        canvas.width = image.width
                        canvas.height = image.height
                        context.drawImage(image, 0, 0)
                        resolve(canvas)
                    }
                    image.src = base64Data
                })
            }
        }
        const screenshotViaIFrame = async () => {
            const iframe = document.createElement('iframe')
            iframe.srcdoc = document.URL
            iframe.style.border = 'none'
            iframe.width = '100%'
            iframe.height = '100%'
            document.body.replaceChildren(iframe)

            const canvas = await screenshotViaMediaDevices('iframe')
            return canvas
        }
        try {
            return await screenshotViaMediaDevices()
        } catch (error) {
            if (!/permission\sdenied/i.test(error.message)) {
                // try another method
                return await screenshotViaIFrame()
            }
        }
    }
    injection.screenshotFunc = () => {
        const drawToCanvas = async function (stream) {
            const canvas = document.createElement("canvas")
            const video = document.createElement("video")
            video.srcObject = stream

            // Play it.
            await video.play()

            // Draw one video frame to canvas.
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            canvas.id = 'ugh-cropper-canvas'
            canvas.getContext("2d").drawImage(video, 0, 0)

            return canvas
        }
        return new Promise(async resolve => {
            console.log('starting screenshotFunc')
            const stream = await navigator.mediaDevices.getDisplayMedia({ preferCurrentTab: true })
            const canvas = await drawToCanvas(stream)
            stream.getTracks().forEach(track => track.stop())
            canvas.toBlob((blob) => {
                resolve(URL.createObjectURL(blob))
            })
        })
    }
    injection.markupFunc = (ughData, svgIcon) => {
        function doMarkup() {
            console.log('starting markupFunc')
            function insertButtonWithoutCoordinates(ughs) {
                const a = document.createElement('a')
                const iconSize = '48px' // Adjust the size as needed

                a.id = 'draggable'
                a.draggable = 'true'
                a.classList.add('ugh', 'btn', 'btn-link', 'animate__animated', 'animate__fadeIn')
                a.addEventListener('animationend', () => {
                    a.classList.replace('animate__hinge', 'animate__fadeIn')
                })
                a.style.position = 'fixed'
                a.style.top = 0
                a.style.left = '10%'
                a.style.zIndex = '99999'
                a.setAttribute('tabindex', 0)
                a.setAttribute('data-bs-toggle', 'modal')
                a.setAttribute('data-bs-target', '#modal')
                a.role = 'button'
                a.innerHTML = svgIcon
                a.querySelector('svg').style.width = iconSize
                a.querySelector('svg').style.height = iconSize
                document.body.append(a)
                const modal = ughModalDialog()
                document.body.append(modal)

                function ughModalDialog() {
                    let el = `
                        <div class="modal modal-xl fade" tabindex="-1" id="modal">
                            <div class="modal-dialog modal-dialog-centered">
                                <div class="modal-content" style="background-color: rgb(0 0 0 / 10%)">
                                    <div class="modal-body" style="height: 90vh; align-content: center">
                                        ${ughComments()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `
                    const range = document.createRange()
                    const fragment = range.createContextualFragment(el)
                    return fragment
                }
                function ughComments() {
                    const accordianId = `accordian-top`
                    let accordianContent = `<div id="${accordianId}" class="accordion accordion-flush">`
                    for (const [ughIndex, ugh] of ughs.entries()) {
                        accordianContent += `
                            <div class="accordion-item">
                                <h2 class="accordion-header">
                                    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#comment-${ughIndex + 1}" aria-expanded="true" aria-controls="comment-${ughIndex + 1}">
                                        <div class="w-100 d-flex justify-content-between">
                                            <div class="text-truncate">
                                                <span>${ugh.user.name} on ${new Date(ugh.createdAt).toLocaleString()}</span>
                                                <span>-</span>
                                                <span class="text-muted">${ugh.ughedComment.slice(0, 100)}</span>
                                            </div>
                                        </div>
                                    </button>
                                </h2>
                                <div id="comment-${ughIndex + 1}" class="accordion-collapse collapse ${ughIndex === 0 ? 'show' : ''}" data-bs-parent="#${accordianId}">
                                    <div class="accordion-body" style="white-space: pre-wrap">
                                        <img src="${ugh.ughedImages[0].url}" class="d-block" alt="Image ${ughIndex + 1}">
                                        <div>${ugh.ughedComment}</div>
                                        <div>${ugh.forumUrl ? `<a href="${ugh.forumUrl}" target="_blank" class="me-4">↩️ forum</a>` : ''}</div>
                                    </div>
                                </div>
                            </div>
                      `
                    }
                    return accordianContent
                }
                // image per person vs image per persons image
                function ughCarousel() {
                    const carouselId = `carousel-top`
                    let carouselContent = `<div id="${carouselId}" class="carousel slide" style="width: auto">`
                    carouselContent += '<div class="carousel-inner">'

                    for (const [ughIndex, ugh] of ughs.entries()) {
                        carouselContent += `<div class="carousel-item ${ughIndex === 0 ? 'active' : ''}">`
                        carouselContent += `    <img src="${ugh.ughedImages[0].url}" class="d-block mx-auto img-fluid" alt="Image ${ughIndex + 1}">`
                        carouselContent += `    <div class="carousel-caption d-none d-md-block">`
                        carouselContent += `        <h5>${ugh.user.name}</h5>`
                        carouselContent += `        <p>${ugh.ughedComment}</p>`
                        carouselContent += `    </div>`
                        carouselContent += '</div>'


                    }

                    carouselContent += '</div>'

                    // Add carousel controls
                    carouselContent += `<a class="carousel-control-prev" role="button" href="#${carouselId}" data-bs-slide="prev">`
                    carouselContent += '<span class="carousel-control-prev-icon" aria-hidden="true"></span>'
                    carouselContent += '<span class="visually-hidden">Previous</span>'
                    carouselContent += '</a>'
                    carouselContent += `<a class="carousel-control-next" role="button" href="#${carouselId}" data-bs-slide="next">`
                    carouselContent += '<span class="carousel-control-next-icon" aria-hidden="true"></span>'
                    carouselContent += '<span class="visually-hidden">Next</span>'
                    carouselContent += '</a>'

                    carouselContent += '</div>'

                    return carouselContent
                }

                // Get the draggable element
                const draggableElement = document.getElementById('draggable')

                // Add event listeners for drag events
                draggableElement.addEventListener('dragstart', (event) => {
                    draggableElement.classList.add('dragging')
                    // Set the drag data to be the ID of the draggable element
                    event.dataTransfer.setDragImage(event.target, 0, 0)
                })
                draggableElement.addEventListener('dragend', () => {
                    // Remove class after dragging ends
                    draggableElement.classList.remove('dragging')
                })
                draggableElement.addEventListener('drag', (event) => {
                    // Update the position of the draggable element
                    const { clientX, clientY } = event
                    draggableElement.style.left = `${clientX}px`
                    draggableElement.style.top = `${clientY}px`
                })

                // Prevent the default action of dropping (prevents the browser from navigating away)
                document.addEventListener('dragover', (event) => {
                    event.preventDefault()
                })

                document.addEventListener('drop', (event) => {
                    event.preventDefault()
                    const id = event.dataTransfer.getData('text/plain')
                    const draggableElement = document.getElementById(id)
                    if (draggableElement) {
                        const { clientX, clientY } = event
                        draggableElement.style.left = `${clientX}px`
                        draggableElement.style.top = `${clientY}px`
                    }
                })

            }
            function insertButtonWithCoordinates(ughIndex, ugh) {
                // left, top, width, height https://github.com/fengyuanchen/cropperjs/blob/main/README.md#getcropboxdata
                const cropCoordinates = ugh.ughedCrop.split(',').map(Number)
                // insert a button in the document that will show an overlay of the cropped image(s)
                const a = document.createElement('a')
                const iconSize = '48px' // Adjust the size as needed

                a.classList.add('ugh', 'btn', 'btn-link', 'animate__animated', 'animate__fadeIn')
                a.addEventListener('animationend', () => {
                    a.classList.replace('animate__hinge', 'animate__fadeIn')
                })
                a.style.position = 'absolute'
                a.style.top = `${cropCoordinates[1]}px`
                a.style.left = `${cropCoordinates[0]}px`
                a.style.opacity = '0.5'
                a.style.zIndex = '99999'
                a.setAttribute('tabindex', ughIndex)
                a.setAttribute('data-bs-html', 'true')
                a.setAttribute('data-bs-toggle', 'popover')
                a.setAttribute('data-bs-title', `${ugh.user.name} Ugh. on ${new Date(ugh.createdAt).toLocaleString()}`)
                a.setAttribute('data-bs-popover-max-width', '400px')
                a.setAttribute('data-bs-content', getContent())
                a.role = 'button'
                a.innerHTML = svgIcon
                a.querySelector('svg').style.width = iconSize
                a.querySelector('svg').style.height = iconSize

                document.body.append(a)
                function getContent() {
                    return `
                        <p>${ugh.ughedComment}</p>
                        ${imageCarousel()}
                    `
                }
                function imageCarousel() {
                    const carouselId = `carousel-${ughIndex}`
                    let carouselContent = `<div id="${carouselId}" class="carousel slide" data-bs-ride="carousel">`
                    carouselContent += '<div class="carousel-inner">'

                    // Iterate over the ugh.ughedImages array to generate carousel items
                    ugh.ughedImages.forEach((ughedImage, index) => {
                        // For each image, create a carousel item
                        carouselContent += `<div class="carousel-item ${index === 0 ? 'active' : ''}">`
                        carouselContent += `<img src="${ughedImage.url}" class="d-block w-100" alt="Image ${index + 1}">`
                        carouselContent += '</div>'
                    })

                    carouselContent += '</div>'

                    // Add carousel controls
                    carouselContent += `<button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">`
                    carouselContent += '<span class="carousel-control-prev-icon" aria-hidden="true"></span>'
                    carouselContent += '<span class="visually-hidden">Previous</span>'
                    carouselContent += '</button>'
                    carouselContent += `<button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">`
                    carouselContent += '<span class="carousel-control-next-icon" aria-hidden="true"></span>'
                    carouselContent += '<span class="visually-hidden">Next</span>'
                    carouselContent += '</button>'

                    carouselContent += '</div>'

                    return carouselContent
                }
            }
            const withCoordinates = ughData.ughs.filter(ugh => ugh.ughedCrop)
            const withoutCoordinates = ughData.ughs.filter(ugh => !ugh.ughedCrop)

            insertButtonWithoutCoordinates(withoutCoordinates)
            if (withCoordinates.length > 0) {
                for (const [ughIndex, ugh] of withCoordinates.ughs.entries()) {
                    insertButtonWithCoordinates(ughIndex, ugh)
                }
            }

            const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
            const popoverList = [...popoverTriggerList].map(popoverTriggerEl => {
                const popover = new bootstrap.Popover(popoverTriggerEl, {
                    customClass: 'custom-popover', // Apply custom class to popover content,
                    trigger: 'focus'
                })

                popoverTriggerEl.addEventListener('click', function (event) {
                    // Check if a specific key (Ctrl key) is pressed along with the click event
                    if (event.altKey) {
                        console.log('Alt key pressed with the click event')
                        // Prevent the default behavior of dismissing the popover
                        bootstrap.Popover.getInstance(event.currentTarget)._activeTrigger = { focus: false, click: true }
                    }
                })

                return popover
            })
            new bootstrap.Carousel('#carousel-top')
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') {
                    popoverList.forEach(popover => {
                        popover.hide()
                    })
                }
            })
        }
        doMarkup()
        globalThis.ugh = {
            doMarkup
        }
    }
})(typeof module !== 'undefined' && module.exports ? module.exports : (self.injection = self.injection || {}))