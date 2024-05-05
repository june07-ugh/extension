<template>
    <v-app>
        <div class="d-flex justify-center">
            <v-btn href="https://forum-ugh.june07.com" target="_blank" variant="text" size="small" prepend-icon="forum" text="forum" />
        </div>
        <v-main>
            <v-container class="h-100 d-flex justify-center">
                <ugh-main :screenCapture="screenCapture" :auth="auth" @signin="signin" @signup="signup" />
            </v-container>
        </v-main>
        <v-img v-if="MODE !== 'production'" ref="devImgRef" @load="devOnloadHandler" src="/ugh.webp" style="visibility: hidden" />
    </v-app>
</template>
<script setup>
const { MODE, VITE_APP_EXTENSION_ID } = import.meta.env

import { ref, onMounted, provide, getCurrentInstance } from "vue"
import cookie from 'cookie'

import UghMain from "./components/UghMain.vue"

let workerPort
const { $keycloak, $api } = getCurrentInstance().appContext.config.globalProperties
const auth = ref()
const screenCapture = ref()
const extensionId = chrome?.runtime?.id || VITE_APP_EXTENSION_ID
const devImgRef = MODE === 'production' ? undefined : ref()

async function doAuth() {
    await $keycloak.value.isLoaded
    if ($keycloak.value.isAuthenticated) {
        auth.value = {
            token: $keycloak.value.token,
            preferred_username: $keycloak.value.tokenParsed.preferred_username,
        }
        chrome.runtime?.sendMessage(extensionId, {
            command: "authenticated",
            data: auth.value
        })
        await $api.forumAuth(auth.value)
    } else {
        await $api.info()
        auth.value = {
            session: cookie.parse(document.cookie)?.['connect.sid']?.match(/s:([^\.]*)/)[1]
        }
    }
}
const signin = () => $keycloak.value.login({ redirectUri: `${window.location.origin}/dist/index.html` })
const signup = () => $keycloak.value.login({ redirectUri: `${window.location.origin}`, action: 'register' })
async function devOnloadHandler() {
    const img = devImgRef.value.$el.querySelector('img')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    // Set canvas size to image size
    canvas.width = img.width
    canvas.height = img.height

    // Draw the image onto the canvas
    ctx.drawImage(img, 0, 0)

    screenCapture.value = {
        image: canvas.toDataURL(),
        width: 671,
        height: 671,
        crop: '129,155,314,178',
        url: 'https://ugh.june07.com',
        tabId: 51878
    }
}
onMounted(() => {
    if (chrome.runtime) {
        workerPort = chrome.runtime.connect(extensionId)

        workerPort.onMessage.addListener(function (event) {
            const { command, data } = event

            switch (command) {
                case "screenCapture":
                    screenCapture.value = data
                    break
            }
        })
    }
})

doAuth()

provide('extensionId', extensionId)
</script>
