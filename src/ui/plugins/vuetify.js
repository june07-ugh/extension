/**
 * plugins/vuetify.js
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
//import 'vuetify/styles'
import '@/settings.scss'

// Composables
import { createVuetify } from 'vuetify'
import { aliases, md } from 'vuetify/iconsets/md'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
    theme: {
        themes: {
            light: {
                colors: {
                    primary: '#1B5E20',
                    secondary: '#5CBBF6',
                }
            }
        }
    },
    icons: {
        defaultSet: 'md',
        aliases,
        sets: {
            md
        }
    },
    components: {
        ...components
    },
    directives,
})
