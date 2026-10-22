// Icon names for the "Work We Handle" strip items. The Studio picker and the renderer
// (service-page-sections.ts draws each one) share this list, so they cannot drift apart.
export const WORK_ICON_NAMES = [
  'furnace', 'flame', 'fan', 'thermostat', 'gauge', 'wrench', 'pipe', 'drop', 'snowflake', 'filter',
  'duct', 'bolt', 'clipboard', 'shield', 'building', 'home', 'clock', 'vent', 'radiator', 'plug',
] as const

export type WorkIconName = (typeof WORK_ICON_NAMES)[number]

/** Each page's strip shows exactly this many items. */
export const WORK_ITEM_COUNT = 7
