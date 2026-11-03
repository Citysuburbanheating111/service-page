/** The "Service pages" tab: bundled into apps-script/ServicePages.gs by scripts/build-apps-script.ts. */
import type {Column} from '../../scripts/lib/sheet'
import {serviceProject} from '../../scripts/lib/service-sheet-rules'
import {createPageSheet, type Config} from './page-sheet'

// Injected at build time from the Sanity schema and apps-script/config.json.
declare const __COLUMNS__: Column[]
declare const __TYPES__: Record<string, string>
declare const __CONFIG__: Config

export const sheet = createPageSheet(serviceProject, __CONFIG__, __COLUMNS__, __TYPES__)
