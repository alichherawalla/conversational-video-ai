# VideoAI Pro - Video Content Generation Platform

## Overview
VideoAI Pro is a full-stack web application designed for creating AI-powered video interview sessions and generating social media content. Its primary purpose is to enable users to conduct video interviews with AI personalities, manage question banks, and automatically produce video clips and content pieces tailored for various social media platforms. The platform aims to streamline content creation workflows, leveraging AI to transform raw interview footage into engaging social media assets, thereby unlocking market potential for efficient content production.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
- **Framework**: React 18 with TypeScript and Vite.
- **UI Library**: Shadcn/ui components built on Radix UI primitives.
- **Styling**: Tailwind CSS with CSS variables for theming, adopting a mobile-first responsive design.
- **Component Architecture**: Utilizes Shadcn/ui for a consistent, accessible, and customizable design system.

### Technical Implementations
- **Frontend State Management**: TanStack Query (React Query) for server state management, optimized for caching and synchronization.
- **Frontend Routing**: Wouter for lightweight client-side routing.
- **Form Handling**: React Hook Form with Zod validation.
- **Backend Runtime**: Node.js with Express.js server.
- **Backend Language**: TypeScript with ES modules.
- **Database**: PostgreSQL with Drizzle ORM, utilizing Neon Database for serverless PostgreSQL.
- **API Pattern**: RESTful APIs with JSON responses.
- **Storage Interface**: Abstracted storage layer.
- **Build System**: Vite for frontend, esbuild for backend server bundling, with shared TypeScript types.
- **Media Recording**: Browser-based video/audio capture using MediaRecorder API, supporting MP4 (preferred) and WebM formats with automatic audio recording.
- **Transcription**: OpenAI Whisper integration for word-level transcription with precise timestamps.
- **Video Processing**: FFmpeg integration for actual video clipping, supporting large files via streaming multipart uploads (busboy).
- **AI Integration**: Enhanced AI conversation features including contextual follow-up questions, response correction, and smart content analysis using models like Claude.

### Feature Specifications
- **Core Modules**: Recording Studio (video capture, AI conversation), Question Bank (CRUD operations), Content Generation (automated clip and social media content), Video Library (session management).
- **Content Generation**: Automated creation of diverse social media content (LinkedIn carousel, image, text posts, and video clips) from interview transcripts, with detailed captions and creative direction for designers. Content generation strictly uses authentic transcript data.
- **Upload Functionality**: Users can upload existing video files and transcripts for content generation.
- **Workflow Separation**: Distinct workflows for transcript extraction, LinkedIn content generation (transcript-based), and video clip processing (video file + transcript-based).

### System Design Choices
- **Database Choice**: PostgreSQL with Drizzle ORM for strong typing, flexible schema management, and serverless compatibility.
- **Monorepo Structure**: Single repository with shared types between client and server for simplified development and deployment.
- **State Management**: React Query chosen over alternatives for optimized server state handling and reduced boilerplate.

## External Dependencies
- **Database**: Neon Database (serverless PostgreSQL).
- **ORM**: Drizzle (with PostgreSQL dialect).
- **UI Framework**: Radix UI primitives with Shadcn/ui.
- **State Management**: TanStack Query (React Query).
- **Validation**: Zod.
- **Media Handling**: Browser MediaRecorder API, FFmpeg.
- **AI Services**: OpenAI Whisper, Claude.
- **Build Tools**: Vite, esbuild.