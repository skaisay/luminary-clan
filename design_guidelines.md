# Gaming Clan PWA - Design Guidelines

## Design Approach

**Selected Approach:** Custom Futuristic Gaming Aesthetic  
**Primary References:** Cyberpunk/sci-fi gaming interfaces (Valorant, Apex Legends, Cyberpunk 2077 UI), combined with modern glassmorphism trends

**Core Principles:**
- Immersive futuristic gaming experience with high-tech visual effects
- Bold, confident layouts that showcase clan identity and achievements
- Premium feel through layered depth and sophisticated visual treatments
- Performance-optimized despite rich visual effects

---

## Typography System

**Primary Font:** Orbitron or Rajdhani (Google Fonts) - geometric, futuristic sans-serif for headings and UI elements  
**Secondary Font:** Inter or Space Grotesk - clean, readable for body text and data displays

**Type Scale:**
- Hero Headlines: 48-72px (font-bold or font-black)
- Section Headers: 32-40px (font-bold)
- Card Titles: 20-24px (font-semibold)
- Body Text: 14-16px (font-normal)
- Stats/Numbers: 28-36px (font-bold, tabular-nums)
- UI Labels: 12-14px (font-medium, uppercase tracking-wide)

---

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16  
Common patterns: p-6, gap-8, space-y-12, m-4

**Grid Structure:**
- Dashboard: Asymmetric grid with featured stats panel (2/3 width) + sidebar widgets (1/3 width)
- Leaderboards: Single column with expansive stat cards on desktop, stacked on mobile
- News Feed: Masonry-style card grid (2 columns desktop, 1 column mobile)

**Container Strategy:**
- Full-width sections with inner max-w-7xl for primary content areas
- Floating panels with max-w-6xl for focused interactions (AI chat, forms)
- Stat cards and widgets use natural content width within grid constraints

---

## Visual Treatment

### Glassmorphism Effects
**Implementation:**
- Background: `backdrop-blur-xl` with `bg-white/10` or `bg-black/20`
- Borders: `border border-white/20` with subtle gradients
- Shadows: Multi-layered shadows for depth (`shadow-2xl` + custom glow effects)
- Applied to: Navigation bars, stat cards, modal overlays, AI chat interface

### Futuristic Elements
**Metallic Highlights:**
- Accent borders with gradient overlays (simulating chrome/steel finishes)
- Shimmer effects on hover states for interactive elements
- Metallic texture overlays on hero sections and featured panels

**Atmospheric Effects:**
- Subtle fog/mist overlays using CSS gradients with low opacity
- Animated particle effects in background (use libraries like particles.js sparingly)
- Radial gradient glows behind key UI elements

**Neon Accents:**
- Primary actions: Cyan/electric blue glows (`shadow-[0_0_20px_rgba(0,240,255,0.5)]`)
- Warnings/alerts: Red/orange neon highlights
- Success states: Green/lime glow effects
- Use on: CTA buttons, active navigation items, stat progress bars, AI advisor presence indicator

---

## Component Library

### Navigation
**Top Navigation Bar:**
- Full-width glassmorphic header with backdrop blur
- Clan logo/emblem on left (60-80px)
- Horizontal menu items center-aligned (desktop) / hamburger menu (mobile)
- User profile dropdown and notifications on right with glow indicators
- Subtle bottom border with gradient

### Dashboard Widgets

**Stat Cards:**
- Glassmorphic containers with rounded-2xl corners
- Icon + label + large number display
- Trend indicators with arrows and percentage changes
- Progress bars with neon gradient fills
- Micro-interactions on hover (subtle scale and glow increase)

**Leaderboard Table:**
- Transparent table with glassmorphic row backgrounds on hover
- Rank badges with metallic circular frames
- Player avatars with neon ring borders (color-coded by rank tier)
- Stat columns with tabular numbers and trend icons
- Top 3 players highlighted with gradient overlays

**Activity Feed:**
- Timeline-style layout with connecting lines
- Event cards with glassmorphic backgrounds
- Timestamps with futuristic date formatting
- Event type icons with colored glow halos
- Discord integration indicators (show online status, recent messages)

### AI Clan Advisor

**Chat Interface:**
- Fixed bottom-right floating panel or dedicated sidebar section
- Glassmorphic chat container with max height and scroll
- AI avatar: Animated 3D-style icon or abstract geometric shape with pulsing glow
- Message bubbles: User messages (right-aligned, subtle background), AI messages (left-aligned, neon border accent)
- Input field with voice-to-text indicator and send button with glow effect
- AI status indicator: "Analyzing...", "Thinking...", "Ready" with pulsing animation
- Suggested actions as chip buttons below chat

**AI Persona:**
- Display name: "Clan Advisor" or custom clan-themed AI name
- Presence indicator with breathing glow animation
- Typing indicator with futuristic dot animation

### News & Announcements

**News Cards:**
- Large featured card for latest news (full-width or 2-column span)
- Smaller cards in masonry grid for archive
- Background image overlay with dark gradient for readability
- Metallic frame borders with corner accents
- Author info, timestamp, and read more CTA
- Category tags with neon pill backgrounds

### Discord Integration Panel

**Server Status Widget:**
- Display online member count with animated counter
- Recent activity feed (messages, voice channel activity)
- Server icon with neon border
- Quick join button with prominent glow effect

### Forms & Inputs

**Input Fields:**
- Glassmorphic backgrounds with subtle borders
- Focus states with neon glow expansion
- Floating labels with futuristic font
- Icon prefixes for context (search, user, etc.)

**Buttons:**
- Primary: Solid neon gradient backgrounds with shadow glows, text-white
- Secondary: Glassmorphic with border, hover adds glow
- Danger: Red neon glow treatment
- All buttons: Rounded-lg to rounded-xl, py-3 px-6, font-semibold

---

## Page Layouts

### Dashboard (Landing/Home)
1. **Hero Banner:** Full-width glassmorphic header with clan emblem, tagline, member count, floating particles background
2. **Quick Stats Row:** 4-column grid (desktop) with animated counter widgets (total members, wins, ranking, activity score)
3. **Main Content Grid:** 2/3 Featured panel (recent matches, highlighted achievements) + 1/3 Sidebar (Discord status, upcoming events)
4. **Leaderboard Section:** Top performers table with rank visualization
5. **AI Advisor Panel:** Sticky bottom-right or dedicated section with chat interface
6. **News Feed:** Latest 3-4 announcements in card format

### Clan Info Page
1. **Hero Section:** Large background image with clan history timeline overlay, glassmorphic text container
2. **Rules Section:** Organized list with numbered items, each in glassmorphic card
3. **Members Gallery:** Grid of member cards with avatars, roles, stats
4. **Achievements Showcase:** Visual trophy/badge display with descriptions

### Statistics Page
1. **Overview Dashboard:** Multi-metric visualization with charts and graphs
2. **Player Comparison Tool:** Side-by-side stat analysis
3. **Historical Trends:** Line graphs showing clan performance over time
4. **AI Insights Panel:** Automated analysis and recommendations from advisor

---

## Responsive Behavior

**Desktop (lg and above):**
- Multi-column layouts with asymmetric grids
- Sidebar navigation always visible
- AI chat as floating panel or dedicated sidebar
- Full glassmorphic effects and animations

**Tablet (md):**
- 2-column grids collapse to single column for complex layouts
- Hamburger navigation with slide-out glassmorphic drawer
- Reduced particle effects for performance

**Mobile (base):**
- Single column stacked layouts
- Bottom navigation bar with key actions
- AI chat as full-screen modal or bottom sheet
- Simplified glassmorphic effects (fewer layers)
- Touch-optimized button sizes (min 44px height)

---

## Animations

**Use Sparingly - Strategic Placement Only:**
- Stat counter animations on dashboard load (count-up effect)
- AI advisor presence pulse (breathing glow)
- Smooth page transitions (fade + slight slide)
- Hover state glows on interactive elements (cards, buttons)
- Loading states with futuristic spinner or progress bars
- **Avoid:** Excessive scroll-triggered animations, background video, constant motion graphics

---

## Images

**Hero Section:**
- Large background image (1920x1080+): Gaming-themed futuristic scene (space, cyberpunk city, abstract tech patterns)
- Dark gradient overlay for text readability
- Position: Full-width at top of dashboard

**Clan Emblem/Logo:**
- High-resolution SVG or PNG (minimum 512x512)
- Placement: Top navigation (60-80px), hero section (200-300px), footer

**Member Avatars:**
- Discord profile pictures or custom avatars
- Size: 40-80px depending on context
- Treatment: Circular with neon border ring, glow on hover

**News/Event Images:**
- Featured news: 16:9 ratio images (1200x675)
- Card thumbnails: Square or 4:3 ratio (600x600 or 800x600)
- Treatment: Subtle overlay gradients for text contrast

**Background Textures:**
- Subtle tech patterns, hexagonal grids, or circuit board designs as fixed backgrounds
- Low opacity (10-20%) to maintain readability

---

## Accessibility

- Maintain WCAG AA contrast ratios despite glassmorphic effects (test overlays carefully)
- Ensure neon glows don't obscure text - use as accents, not backgrounds for content
- Keyboard navigation with visible focus states (neon outline rings)
- Screen reader labels for all icons and decorative elements
- Reduced motion preference: Disable particle effects and pulsing animations
- Form inputs maintain consistent styling with clear labels and error states

---

## PWA Considerations

**Offline Experience:**
- Service worker caching for critical assets
- Offline fallback page with glassmorphic design consistency
- Local storage for user preferences and cached stats

**App Shell:**
- Navigation and core UI components load first
- Progressive enhancement for glassmorphic effects based on device capability
- Install prompt styled to match futuristic theme with clear benefits messaging

**Performance:**
- Lazy load particle effects and heavy animations
- Optimize glassmorphic blur effects (consider static gradients for low-end devices)
- Compress background images with fallback solid colors
- Defer non-critical AI features until after initial render