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

## Recent Changes: Latest modifications with dates

### January 30, 2025 - Enhanced AI Conversation Features
- **AI Follow-up Questions**: AI now asks exactly 2 relevant follow-up questions after each response
- **Response Correction System**: AI analyzes responses and provides corrections when answers are inadequate
- **Smart Content Analysis**: AI checks for response length, examples, emotional content, and vague language
- **Enhanced Video Clips**: Generated clips are now optimized for 15-90 second social media formats
- **Advanced LinkedIn Content**: Three content types with sophisticated templates:
  - Carousel posts with 5-7 professional slides
  - Image posts with quotes, statistics, and personal insights  
  - Text posts with story threads, contrarian takes, and behind-the-scenes content

### January 30, 2025 - Contextual AI Follow-ups and Enhanced Question Display
- **Smart Follow-up Questions**: AI now generates contextual follow-up questions based on base questions and user responses
- **Enhanced AI Conversation**: Follow-ups are personalized using Claude to dig deeper into specific user answers
- **Prominent Question Display**: Current question is prominently displayed above the conversation for user context
- **Visual Question Reference**: Users can easily reference the question they're responding to throughout the conversation
- **Contextual Understanding**: AI analyzes both the original question and user response to create relevant follow-ups

### January 30, 2025 - Video Recording and Audio Integration
- **MP4 Video Format**: Switched from WebM to MP4 format for better audio compatibility and universal playback
- **Automatic Audio Recording**: Video recording now automatically starts parallel audio transcription recording
- **Enhanced Download**: Download now includes both video file (MP4/WebM) and transcript text file simultaneously  
- **Smart Format Detection**: MediaRecorder automatically selects best supported format (MP4 preferred, WebM fallback)
- **Audio Codec Support**: Added proper opus audio codec support for WebM when MP4 not available
- **Real-time Transcription**: Audio transcription happens in parallel with video recording for immediate text generation

### January 30, 2025 - Database Integration
- **PostgreSQL Database**: Successfully migrated from in-memory storage to persistent PostgreSQL database
- **Database Connection**: Integrated Neon Database with Drizzle ORM for robust data persistence
- **Sample Data**: Automatically initializes with sample questions when database is empty
- **Schema Migration**: Database tables created for sessions, questions, conversations, clips, and content pieces
- **Data Persistence**: All video sessions, conversations, and generated content now persist between app restarts

### January 30, 2025 - Enhanced Content Generation with Detailed Captions
- **Detailed Image Post Captions**: Comprehensive caption structure with hook, context, insight, value proposition, and call-to-action
- **Visual Direction for Designers**: Specific illustration guidance including color schemes, layout, typography, and visual elements
- **Enhanced Carousel Posts**: Detailed slide content (40-60 words each) with comprehensive captions and structured storytelling
- **Professional Caption Templates**: Structured approach for LinkedIn engagement with specific formatting and hashtag strategies
- **Authentic Content Focus**: All content generation uses only real transcript data with detailed storytelling frameworks
- **Three Content Variations**: Each type generates 3 distinct approaches (strategic insights, frameworks, lessons learned)

### January 30, 2025 - Video Clipping and Download Functionality
- **Actual Video Clipping**: Implemented FFmpeg integration to cut actual video files at generated timestamps
- **Individual Clip Downloads**: Added download buttons for individual video clips with proper file naming
- **Bulk Clip Downloads**: "Download All Clips" button creates ZIP package with all session clips and metadata
- **Video File Management**: Updated database schema to track video file paths for clipped segments
- **Enhanced User Interface**: Added "Create Video Files" button that processes timestamps into actual video clips
- **Error Handling**: Comprehensive error handling for video processing and file management
- **Metadata Export**: Clip downloads include JSON metadata with timestamps, descriptions, and social scores

### January 30, 2025 - Enhanced Content Generation with Full-View Modals
- **Authentic Data Usage**: All LinkedIn content generation now uses only real transcript data, no fictional stories or fabricated statistics
- **Simplified Content Page**: Removed video library and other content types, focusing solely on LinkedIn content and video clips
- **Interactive Content Modals**: Added comprehensive "View Full" functionality for all content types:
  - **Carousel Posts**: Full carousel preview with all slides, icons, titles, content, and professional hashtags
  - **Image Posts**: Mock image card display with quotes, insights, captions, and key statistics
  - **Text Posts**: Complete post breakdown showing hook, body content, call-to-action, and hashtags
  - **Video Clips**: Detailed view with precise start/end timestamps, duration, description, and social scores
- **Enhanced Video Clips**: Clips now provide accurate timestamps based on actual conversation moments using transcript timing data
- **Transcript Storage**: Added fullTranscript field to sessions table for precise content generation and clip timing

### January 30, 2025 - Upload Functionality for Content Generation
- **Video & Transcript Upload**: Users can now upload existing video files and transcript text to generate LinkedIn content
- **Flexible Input Options**: Support for transcript file uploads (.txt, .md, .doc, .docx) or direct text pasting
- **Upload Interface**: Dedicated upload mode accessible from Content Generation tab with user-friendly file handling
- **Same Content Engine**: Upload-generated content uses the same authentic data processing as session-based content
- **Batch Content Generation**: Single click generates all three LinkedIn content types (carousel, image, text) automatically
- **Content Preview Grid**: Generated content displays in organized cards with individual "View Full" buttons
- **Modal Integration**: Generated content from uploads displays in the same detailed modals as session content

### January 30, 2025 - Word-Level Transcription and Enhanced Auto-Submission
- **Word-Level Timing**: Upgraded OpenAI Whisper integration to use `verbose_json` format with word-level timestamps
- **Enhanced Transcription System**: New `useEnhancedTranscription` hook provides real-time word-level timing and smart chunking
- **5-Second Auto-Transcription**: Automatic transcription processing every 5 seconds with intelligent accumulation
- **Smart Auto-Submit**: Refined 5-second silence detection triggers automatic transcript submission for user confirmation
- **Real-Time Word Tracking**: Each transcribed word includes absolute start/end timestamps for precise timing
- **Improved User Experience**: Live transcription preview with auto-submit pending indicators
- **Fallback Manual Transcript**: Maintained manual "Get Transcript" button for user-controlled submission
- **Word-Level Accuracy**: Transcription now provides precise timing for each word instead of sentence-level timestamps

### January 30, 2025 - Enhanced Content Generation with Detailed Educative Captions
- **Detailed LinkedIn Captions**: All content types now generate comprehensive 200-400 word captions with educative and direct tone
- **Structured Caption Framework**: Consistent format using Hook → Context → Key Insights → Practical Value → Call-to-Action structure
- **Educative Content Focus**: Direct, educational voice that breaks down complex concepts into clear, actionable insights
- **Enhanced Carousel Posts**: Detailed slide content (40-60 words each) with comprehensive captions and storytelling frameworks
- **Comprehensive Image Posts**: Detailed visual direction for designers with specific color schemes, layout, and typography guidance
- **Authentic Data Only**: All content generation strictly uses real transcript data with no fictional stories or fabricated statistics
- **Generate All Content Feature**: Added bulk content generation for sessions creating 9 LinkedIn posts plus video clips in one click
- **Session Navigation Integration**: "Generate Social Media Content" button seamlessly navigates from Recording Studio to Content Generation

### January 30, 2025 - Enhanced Bold and Educative Content Generation
- **Bold Content Revolution**: Transformed all LinkedIn content to use provocative, contrarian viewpoints that challenge conventional thinking
- **Scroll-Stopping Captions**: Enhanced all content types with 350-600 word bold, educative captions that demand attention
- **Provocative Messaging**: Added power words, controversial hooks, and thought-provoking statements throughout all content
- **Contrarian Positioning**: Content now challenges industry norms and presents unconventional wisdom from interview insights
- **Enhanced Token Limits**: Increased Anthropic API max tokens to 2000 to support much more detailed content generation
- **Revolutionary Templates**: Updated carousel, image, and text post templates with bold, disruptive messaging frameworks

### January 30, 2025 - Reverted to Manual-Only Transcription
- **Removed Auto-Transcription**: Eliminated all automatic transcription functionality due to transcript quality issues
- **Manual Control Only**: Users now control when to generate transcripts by clicking "Get Transcript" button
- **Cleaner Transcription Process**: No more fragmented transcripts from frequent auto-processing
- **Simplified UI**: Updated interface to show "Manual transcription • Click 'Get Transcript' when ready"
- **Better User Experience**: Users can speak naturally without interruption and transcript when they choose
- **Code Cleanup**: Removed unused auto-transcription timers, refs, and logic for cleaner codebase