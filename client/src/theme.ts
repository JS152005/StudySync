/**
 * StudySync Design System & Motion Tokens
 *
 * Art Direction: Crisp Luminous Light & Editorial Precision
 * Engineered specifically for engineering and medical students.
 *
 * Semantic Palette:
 * - Ground / Canvas: #F8FAFC (Luminous Cool Canvas)
 * - Surface / Card: #FFFFFF (Pure Crisp White)
 * - Raised Surface: #F1F5F9 (Soft Slate 100)
 * - Elevated Surface: #FFFFFF (Floating Rails & Modals)
 * - Nested Surface: #F8FAFC
 * - Hairline Border: #E2E8F0 (Soft Slate Border)
 * - Hairline Subtle: rgba(0, 0, 0, 0.06)
 * - Primary Action / Accent: #0284C7 (Vibrant Sky / Azure)
 * - Accent Hover: #0369A1
 * - Accent Subtle: rgba(2, 132, 199, 0.08)
 * - Urgent / Alert: #F43F5E (Signal Rose / Crimson)
 * - Urgent Subtle: rgba(244, 63, 94, 0.08)
 * - Success / Milestone: #10B981 (Emerald Mint)
 * - Success Subtle: rgba(16, 185, 129, 0.08)
 * - Warning / Attention: #F59E0B (Amber Alert)
 * - Text Primary: #0F172A (Deep Rich Slate Charcoal)
 * - Text Secondary: #475569 (Cool Slate for Metadata)
 * - Text Muted: #94A3B8 (Tertiary Captions)
 */

export const THEME = {
  // Foundational Canvas & Surface Layers
  ground: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceRaised: '#F1F5F9',
  surfaceElevated: '#FFFFFF',
  surfaceNested: '#F8FAFC',

  // Structural Borders
  border: '#E2E8F0',
  borderSubtle: 'rgba(0, 0, 0, 0.06)',
  borderHighlight: 'rgba(2, 132, 199, 0.35)',
  rule: '#E2E8F0',

  // Semantic Interactive & Status Colors
  accent: '#0284C7',
  accentHover: '#0369A1',
  accentSubtle: 'rgba(2, 132, 199, 0.08)',
  accentGlow: '0 0 16px rgba(2, 132, 199, 0.25)',

  positive: '#10B981',
  positiveSubtle: 'rgba(16, 185, 129, 0.08)',

  negative: '#F43F5E',
  negativeSubtle: 'rgba(244, 63, 94, 0.08)',

  warning: '#F59E0B',
  warningSubtle: 'rgba(245, 158, 11, 0.08)',

  // Typographic Tones
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  // Direct Backward-Compatibility Aliases
  warmIvory: '#FFFFFF',              // Ground / Card background
  deepForestCharcoal: '#0F172A',     // High-contrast primary text
  emeraldGreen: '#0284C7',           // Vibrant Azure primary action
  vermilion: '#F43F5E',              // Signal Crimson alerts
  warmStone: '#64748B',              // Refined Slate metadata

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
    sm: '6px',
    control: '8px',
    md: '8px',
    card: '14px',
    lg: '14px',
    cardLg: '18px',
    xl: '18px',
    pill: '9999px',
    full: '50%',
  },

  // Elevation Shadows for Light Surfaces
  shadow: {
    subtle: '0 1px 2px rgba(0, 0, 0, 0.04)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
    card: '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.03)',
    md: '0 4px 14px rgba(0, 0, 0, 0.06)',
    lifted: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
    lg: '0 20px 30px -10px rgba(0, 0, 0, 0.1)',
    modal: '0 20px 48px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
  },
} as const;

export type ThemeTokens = typeof THEME;
