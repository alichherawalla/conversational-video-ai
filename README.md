# VideoAI Pro - AI-Powered Content Generation Platform

An advanced AI-driven platform that transforms interview transcripts and video content into comprehensive social media content with intelligent optimization and creative tools.

## 🚀 Overview

VideoAI Pro is a sophisticated content generation platform that leverages OpenAI Whisper and Anthropic Claude to transform long-form video interviews into engaging, multi-format social media content. The platform offers three main workflows: recording studio sessions, question bank management, and comprehensive content generation.

## ✨ Key Features

### 🎥 Recording Studio
- **Browser-based video/audio capture** using MediaRecorder API
- **Real-time transcription** with OpenAI Whisper integration
- **AI-powered interview questions** with contextual follow-ups
- **Session management** with PostgreSQL database storage
- **Automated content generation** from recorded sessions

### 📚 Question Bank
- **CRUD operations** for interview questions
- **Category-based organization** (business, entrepreneurship, etc.)
- **Difficulty levels** (easy, medium, hard)
- **Primary and follow-up question** structure
- **AI-generated questions** as fallback options

### 🎬 Content Generation
- **Multi-format content creation**: LinkedIn carousels, image posts, text posts
- **Intelligent video clipping** with word-level timing precision
- **Social media optimization** with scoring algorithms
- **Creative direction generation** for designers
- **Comprehensive content packages** for download

### 📁 Upload & Process Workflow
- **Large file support** (up to 500MB) with streaming uploads
- **Transcript extraction** from video files using FFmpeg
- **Content generation** from existing transcripts
- **Video clip creation** with precise timing
- **Package downloads** with ZIP archives

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js
- **TypeScript** with ES modules
- **PostgreSQL** with Drizzle ORM
- **OpenAI Whisper** for transcription
- **Anthropic Claude 4.0** for content generation
- **FFmpeg** for video/audio processing
- **Busboy** for streaming file uploads

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** with shadcn/ui components
- **TanStack Query** for state management
- **Wouter** for routing
- **React Hook Form** with Zod validation
- **Framer Motion** for animations

### Database & Storage
- **PostgreSQL** with Neon Database (serverless)
- **Drizzle ORM** with strong typing
- **Object storage** integration for file management

## 📋 Prerequisites

Before using VideoAI Pro, ensure you have:

1. **API Keys** (required):
   - OpenAI API key for transcription services
   - Anthropic API key for content generation

2. **System Requirements**:
   - Node.js 20+
   - PostgreSQL database
   - FFmpeg installed (for video processing)

3. **Browser Requirements**:
   - Modern browser with MediaRecorder API support
   - Camera and microphone permissions for recording

## 🚀 Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd videoai-pro
npm install
```

### 2. Environment Setup

Create a `.env` file with your API keys:

```env
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
DATABASE_URL=your_postgresql_connection_string
```

### 3. Database Setup

```bash
# Push the database schema
npm run db:push
```

### 4. Start the Application

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

The application will be available at `http://localhost:5000`

## 📖 Usage Guide

### Option 1: Recording Studio Workflow

1. **Create a New Session**
   - Navigate to the Recording Studio tab
   - Click "Start New Session"
   - Fill in session details (title, topic, target duration)
   - Choose AI personality and settings

2. **Conduct the Interview**
   - Start video recording
   - Use AI-generated questions or select from question bank
   - Get real-time transcription feedback
   - AI provides contextual follow-up questions

3. **Generate Content**
   - Stop recording when complete
   - Navigate to Content Generation tab
   - Select your recorded session
   - Click "Generate All Content" for comprehensive output

4. **Download Package**
   - Access generated LinkedIn posts (carousel, image, text)
   - Review video clips with timestamps
   - Download complete ZIP package

### Option 2: Upload & Process Workflow

This is the recommended workflow for existing video content:

#### Step 1: Download Your Video
- Download your video file from your existing platform
- Ensure file size is under 500MB
- Supported formats: MP4, MOV, AVI, WebM

#### Step 2: Upload Video for Transcription
⚠️ **Important**: Follow this exact sequence for best results

1. **Navigate to Content Generation tab**
2. **Click "Upload Content" button**
3. **Upload your video file**:
   - Click "Choose Video File" 
   - Select your downloaded video
   - Wait for upload progress (large files may take several minutes)
4. **Get Transcript**:
   - Click "Get Transcript" button
   - System will extract audio using FFmpeg
   - OpenAI Whisper generates word-level transcript
   - ⏱️ Processing time: 1-3 minutes per hour of video

#### Step 3: Generate LinkedIn Content
Once transcription is complete:

1. **Review the transcript** for accuracy
2. **Click "Generate LinkedIn Content"**:
   - Creates 7-8 optimized LinkedIn posts
   - Includes: 3 carousel posts, 2-3 image posts, 2-3 text posts
   - Each with detailed captions and creative direction
   - ⏱️ Generation time: 2-4 minutes

#### Step 4: Generate Video Clips
For short-form video content:

1. **Re-upload your video file** (required for clipping)
2. **Ensure transcript is available** from Step 2
3. **Click "Generate Video Clips"**:
   - Creates 3-5 optimized video segments
   - Uses word-level timing for precision
   - Includes titles, descriptions, and social scores
   - ⏱️ Processing time: 3-8 minutes depending on video length

#### Step 5: Download Complete Package
1. **Click "Download Package"** to get ZIP file containing:
   - `transcript.txt` - Full video transcript
   - `linkedin_content.md` - All generated posts with formatting
   - `video_clips/` folder - Actual MP4 clip files
   - `video_clips/clips_metadata.json` - Clip details and timings

## ⚠️ Important Usage Notes

### File Size Limitations
- **Maximum video file size**: 500MB
- **Recommended size**: Under 200MB for faster processing
- **Tip**: Compress large videos before upload

### Transcript Quality
- **Clear audio** produces better transcripts
- **Background noise** may affect accuracy
- **Multiple speakers** are supported but may need manual review
- **Technical terms** might require correction

### Processing Times
- **Transcription**: ~1-3 minutes per hour of video
- **Content Generation**: ~2-4 minutes per session
- **Video Clipping**: ~3-8 minutes depending on length
- **Large files** (>200MB) may take significantly longer

### Content Generation Caveats

#### LinkedIn Content Generation
- **Requires complete transcript** - partial or poor quality transcripts yield suboptimal results
- **Best with 10+ minutes** of source material for diverse content
- **Works with any language** but optimized for English
- **Technical content** may need manual refinement

#### Video Clip Generation
- **Requires both video file AND transcript** for timing accuracy
- **Word-level precision** depends on clear audio quality
- **Automatic scene detection** identifies optimal clip boundaries
- **Social media optimization** scores clips for engagement potential

### Workflow Best Practices

1. **Test with short videos first** (5-10 minutes) to understand the system
2. **Review transcripts** before generating content - accuracy affects quality
3. **Generate content before clips** - content generation is faster and doesn't require re-upload
4. **Use Wi-Fi for uploads** - cellular connections may timeout on large files
5. **Keep browser tab active** during processing to prevent timeouts

## 🔧 API Reference

### Key Endpoints

#### Video Processing
- `POST /api/upload-video-transcribe` - Extract transcript from video
- `POST /api/upload-video-generate-clips` - Generate video clips
- `POST /api/transcribe-video` - Basic video transcription

#### Content Generation
- `POST /api/generate-content-from-upload` - Generate LinkedIn content
- `POST /api/sessions/:id/generate-content` - Generate session content
- `POST /api/sessions/:id/generate-clips` - Generate session clips

#### Package Downloads
- `POST /api/download-upload-package` - Download upload-based content
- `GET /api/download-session-package/:id` - Download session package

## 🏗️ Architecture

### Database Schema
- **sessions** - Recording session metadata
- **questions** - Interview question bank
- **conversations** - Session dialogue history
- **clips** - Generated video clips with metadata
- **contentPieces** - LinkedIn posts and content
- **uploads** - File upload tracking and metadata

### AI Integration
- **OpenAI Whisper** - Word-level transcription with timestamps
- **Anthropic Claude 4.0** - Content generation and creative direction
- **FFmpeg** - Video/audio processing and clip extraction

### File Processing Pipeline
1. **Upload** via streaming multipart (Busboy)
2. **Audio Extraction** using FFmpeg
3. **Transcription** with OpenAI Whisper
4. **Content Generation** with Anthropic Claude
5. **Video Clipping** with precise timing
6. **Package Assembly** with ZIP archives

## 🐛 Troubleshooting

### Common Issues

#### Upload Failures
- **File too large**: Compress video under 500MB
- **Unsupported format**: Use MP4, MOV, AVI, or WebM
- **Timeout errors**: Try smaller file or stable internet connection

#### Transcription Issues
- **Poor accuracy**: Ensure clear audio, minimal background noise
- **Missing words**: Check for multiple speakers or technical terms
- **Processing stuck**: Refresh page and try smaller file

#### Content Generation Problems
- **Empty results**: Verify transcript quality and length (minimum 5 minutes)
- **Generic content**: Provide more detailed, specific source material
- **Processing timeout**: Break large transcripts into smaller segments

#### Video Clip Issues
- **No clips generated**: Ensure both video file and transcript are provided
- **Timing misalignment**: Check transcript accuracy first
- **Large processing time**: Expected for videos over 30 minutes

### Getting Help

1. **Check browser console** for detailed error messages
2. **Verify API keys** are correctly configured
3. **Test with shorter content** to isolate issues
4. **Review transcript quality** before content generation

## 🔒 Security & Privacy

- **API keys** are stored securely in environment variables
- **Video files** are processed locally and cleaned up after use
- **Transcripts** are temporarily stored for content generation
- **No data** is shared with third parties beyond OpenAI and Anthropic APIs

## 📝 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests for any improvements.

---

**VideoAI Pro** - Transform your interviews into engaging social media content with the power of AI.