import { serve } from '@hono/node-server'
import { createApp } from './app.js'

serve({ fetch: createApp().fetch, port: 3000 })
