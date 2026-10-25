/**
 * StudySync Design System Palette & Tokens
 *
 * MANDATORY FIVE-COLOR PALETTE:
 * - Warm Ivory: #F8F4E8 (Main backgrounds, surfaces, calm reading)
 * - Emerald Green: #006B4F (Primary actions, active navigation, key controls, success)
 * - Vermilion: #E74727 (Urgent deadlines, unread indicators, alerts, destructive)
 * - Deep Forest Charcoal: #26352F (Headings, body text, high-contrast definitions, borders)
 * - Warm Stone: #746F64 (Metadata, timestamps, secondary labels, subtle borders)
 */

export const THEME = {
  warmIvory: '#F8F4E8',
  emeraldGreen: '#006B4F',
  vermilion: '#E74727',
  deepForestCharcoal: '#26352F',
  warmStone: '#746F64',

  // Motion & Easing Tokens
  motion: {
    durationFast: '140ms',
    durationNormal: '240ms',
    durationSlow: '380ms',
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeSpring: 'cubic-bezier(0.34, 1.35, 0.64, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Geometry Radius Scale
  radius: {
    sharp: '4px',
    control: '8px',
    card: '12px',
    cardLg: '16px',
    pill: '9999px',
    full: '50%',
  },

  // Shadows adhering to editorial paper-craft aesthetic
  shadow: {
    subtle: '0 1px 3px rgba(38, 53, 47, 0.08)',
    card: '0 2px 6px rgba(38, 53, 47, 0.06)',
    lifted: '0 4px 14px rgba(38, 53, 47, 0.12)',
    dropdown: '0 8px 24px rgba(38, 53, 47, 0.18)',
    focus: '0 0 0 3px rgba(0, 107, 79, 0.35)',
    focusVermilion: '0 0 0 3px rgba(231, 71, 39, 0.35)',
  },
} as const;

export type ThemeColors = typeof THEME;
export default THEME;
