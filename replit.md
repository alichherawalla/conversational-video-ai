# VideoAI Pro - Video Content Generation Platform

## Overview

VideoAI Pro is a full-stack web application for creating AI-powered video interview sessions and generating social media content. The platform allows users to conduct video interviews with AI personalities, manage question banks, and automatically generate clips and content pieces for various social media platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **API Pattern**: RESTful APIs with JSON responses
- **Storage Interface**: Abstracted storage layer with in-memory implementation

### Build System
- **Frontend Build**: Vite with React plugin
- **Backend Build**: esbuild for server bundling
- **Development**: Hot module replacement via Vite dev server
- **TypeScript**: Shared types between client and server

## Key Components

### Core Modules
1. **Recording Studio**: Video capture, AI conversation flow, session management
2. **Question Bank**: CRUD operations for interview questions with categorization
3. **Content Generation**: Automated clip creation and social media content generation
4. **Video Library**: Session browsing, filtering, and media management

### Database Schema
- **Sessions**: Video interview sessions with metadata (title, topic, duration, status)
- **Questions**: Interview questions with follow-ups and categorization
- **Conversations**: AI-user interaction logs with timestamps
- **Clips**: Generated video clips with social media scoring
- **Content Pieces**: Generated text content for social platforms

### UI Components
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Component Library**: Comprehensive set of reusable UI components
- **Media Recording**: Browser-based video/audio capture with MediaRecorder API
- **Real-time Updates**: React Query for automatic data synchronization

## Data Flow

1. **Session Creation**: User configures interview settings and starts recording
2. **AI Interaction**: Real-time conversation between user and AI personality
3. **Content Storage**: Video data and conversation logs stored in database
4. **Content Generation**: Automated analysis creates clips and social media content
5. **Library Management**: Users browse, filter, and manage generated content

## External Dependencies

### Core Dependencies
- **Database**: Neon Database (serverless PostgreSQL)
- **ORM**: Drizzle with PostgreSQL dialect
- **UI Framework**: Radix UI primitives with Shadcn/ui styling
- **State Management**: TanStack Query for server state
- **Validation**: Zod for runtime type checking
- **Media Handling**: Browser MediaRecorder API for video capture

### Development Tools
- **Build Tools**: Vite, esbuild, TypeScript compiler
- **Code Quality**: ESLint, Prettier (implied by project structure)
- **Development Environment**: Replit-specific plugins for hot reloading

## Deployment Strategy

### Environment Configuration
- **Development**: Vite dev server with Express backend
- **Production**: Static build served alongside Express API
- **Database**: Environment-based DATABASE_URL configuration
- **Assets**: Vite handles asset optimization and bundling

### Build Process
1. **Frontend**: Vite builds React app to `dist/public`
2. **Backend**: esbuild bundles Express server to `dist/index.js`
3. **Database**: Drizzle migrations applied via `db:push` command
4. **Serving**: Express serves static frontend and API routes

### Key Architectural Decisions

**Database Choice**: PostgreSQL with Drizzle ORM chosen for:
- Strong typing with TypeScript integration
- Flexible schema management with migrations
- Serverless compatibility with Neon Database

**Monorepo Structure**: Single repository with shared types:
- Reduces type duplication between client/server
- Simplified deployment and development workflow
- Shared validation schemas via Zod

**Component Architecture**: Shadcn/ui over custom components:
- Consistent design system with Tailwind CSS
- Accessible components via Radix UI primitives
- Customizable and maintainable component library

**State Management**: React Query over Redux:
- Optimized for server state management
- Built-in caching and synchronization
- Reduced boilerplate for API interactions