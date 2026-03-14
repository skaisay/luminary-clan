# Clan Command - Gaming Clan PWA Panel

## Overview
Clan Command is a Progressive Web Application (PWA) serving as a centralized control panel for gaming clans. It offers a futuristic user experience, deep Discord integration, and web-based music control. The platform aims to enhance member interaction and administrative efficiency through features such as comprehensive member statistics, dynamic leaderboards, news management, and a robust economy system. The project's ambition is to provide a customizable and engaging hub for gaming communities, accessible and performant across devices, fostering a strong community and offering extensive administrative oversight.

## User Preferences
I prefer simple language and detailed explanations. I want iterative development with clear communication at each step. Please ask before making major changes to the codebase or architecture. Do not make changes to the folder `Z` and the file `Y`.

## System Architecture
Clan Command is built with a React and TypeScript frontend, styled using Tailwind CSS and shadcn/ui to achieve a futuristic design with glassmorphism and neon accents. The backend is powered by Node.js and Express, utilizing PostgreSQL (Neon) and Drizzle ORM for data persistence.

**UI/UX Decisions:**
- **Design System:** Futuristic theme with a cyan/electric blue primary and purple accent, glassmorphism effects, neon glows, and smooth animations.
- **Responsiveness:** Full mobile support with PWA optimization for an installable application and offline capabilities.
- **Navigation:** Floating glass "island" top navigation that auto-hides on scroll, and a hamburger menu for mobile.
- **Typography:** Uses Rajdhani, Space Grotesk, and Inter fonts.
- **Customization:** Splash screen and various visual elements are configurable via the admin panel.

**Technical Implementations:**
- **Frontend:** React + TypeScript, Tailwind CSS, shadcn/ui, Recharts for data visualization, and TanStack Query for data management and caching.
- **Backend:** Node.js + Express with PostgreSQL (Neon) and Drizzle ORM.
- **Discord Bot:** Supports 33 global slash commands in Russian for statistics, advanced music playback, moderation, and utilities, tracking member activity for ranking and LumiCoin rewards.
- **Admin Panel:** Secure interface for full CRUD operations on clan settings, members, news, Discord server management, and LumiCoin earning configurations, including error handling and empty state messages.
- **API Endpoints:** Separated into public and authenticated admin endpoints.
- **Security:** Bcrypt for password hashing, PostgreSQL-backed sessions, and `requireAdmin` middleware for protected routes.
- **Performance:** Optimized queries, TanStack Query caching, and guaranteed Discord session closure.

**Feature Specifications:**
- **User Dashboard:** Displays clan statistics, top members, activity graphs, leaderboards, profiles, news feed, and web-based music player.
- **Web Music Control:** Admin-only interface to manage Discord bot music playback directly from the web.
- **LumiCoin Economy System:** In-game currency earned through Discord activity, with customizable rates and anti-spam.
- **Unified Shop System:** Marketplace for Discord roles and economy items (boosters, badges, titles, banners, collectibles, services) with rarity, custom metadata, and stock management.
- **Extended Economy System:** Inventory, special services, achievement system, streak-based daily rewards, and quest system.
- **Level & Experience:** Member progression system with XP boosters.
- **Request System:** Allows members to submit requests for roles or questions, with admin approval/rejection.
- **Forum System:** Community discussion platform with topic creation, threaded replies, pinning, and locking.
- **Discord Integration:** Real-time display of Discord avatars and roles, direct management from admin panel, and automatic role assignment upon shop purchase.
- **Real-time Data:** Instant updates for admin changes and music queue status, with balance updates every 30 seconds.
- **Video Platform:** Standalone Apple-inspired video platform (accessible via `/video-platform/*`) with independent layout, shared authentication, video uploads, playback, and comprehensive settings (language, theme, player controls, privacy). Features automatic thumbnail generation and full-range HTTP video streaming.
  - **Three.js Loading Animation:** Dynamic butterflies animation using threejs-toys library with 3-second timeout and graceful fallback to ensure loading never hangs.
  - **Custom Backgrounds:** Support for custom background images via localStorage (JSON format with type and url), with black default (#000000) to prevent flash before custom backgrounds load.
  - **Mobile Responsiveness:** YouTube-inspired mobile layout with responsive grid (flex-col on mobile, flex-row on desktop), adaptive thumbnails (w-full on mobile, w-80 on desktop), and proper error handling for thumbnail loading.
  - **Secure Authentication Flow:** Discord OAuth with validated returnTo parameter to prevent open redirect vulnerabilities. Uses allowlist of safe paths, decodeURIComponent error handling, and defaults to /shop for invalid paths.
  - **Accessibility:** DialogTitle and DialogDescription properly implemented in DiscordAuthModal for screen reader users.
- **Site Bans Management:** Enhanced admin page for managing site bans with searchable member selector, various ban durations, and proper tracking of banned by admin.

## External Dependencies
- **PostgreSQL:** Primary database, hosted via Neon.
- **Discord.js:** For Discord bot functionality and server interaction.
- **Recharts:** Used for data visualization in the frontend.
- **TanStack Query:** For efficient data fetching, caching, and state management.
- **DisTube:** Advanced music system for the Discord bot, supporting YouTube, SoundCloud, and Spotify.
- **@distube/yt-dlp:** YouTube video extraction plugin for DisTube.
- **play-dl:** Alternative music source for the Discord bot.
- **@discordjs/voice:** Provides voice capabilities for the Discord bot.
- **FFmpeg:** Used for audio encoding in the Discord bot and video thumbnail generation.
- **Python3:** Required for `yt-dlp` video extraction.