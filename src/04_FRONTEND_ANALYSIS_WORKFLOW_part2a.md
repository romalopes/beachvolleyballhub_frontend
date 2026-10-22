# 04_FRONTEND_ANALYSIS_WORKFLOW.md (part 2a)

## 4.7 Video Source Switching

### 4.7.1 Source Type Selection
- Radio buttons for "External URL" and "Upload Video"
- When "External URL" selected:
  - Show URL input field with validation
  - Show external video preview if URL is valid
- When "Upload Video" selected:
  - Show file upload area with drag-and-drop support
  - Display file type and size validation
  - Show preview thumbnail after upload

### 4.7.2 Validation Logic
- External URL validation:
  - Must be a valid URL format
  - Must point to an allowed video provider
  - System attempts to fetch metadata (title, duration) for preview
- Upload validation:
  - File type must be video MIME type
  - File size must be < 500MB
  - Client-side preview generation for common video formats

### 4.7.3 Preview Generation
- External videos: fetch metadata from provider API (if available)
- Uploaded videos: generate thumbnail using browser APIs
- Both previews displayed in video list or detail view

## 4.8 Navigation Flow

### 4.8.1 Main Navigation Updates
- Add "Analysis" item to sidebar with icon
- Update home page to include Analysis card
- Ensure consistent styling with other navigation items

### 4.8.2 Route Protection
- Protected routes for `/analyses/*` paths
- Unauthorized users redirected to login or analysis list
- Role-based access control implemented in route components

### 4.8.3 Breadcrumb Navigation
- Breadcrumb trail showing: Home > Analysis > [Analysis Name]
- Clickable links for navigation back to parent pages

### 4.8.4 Responsive Design
- Mobile: collapsible sidebar, stacked navigation
- Desktop: fixed sidebar, spacious layout
- Form components adapt to screen size
- Tabbed interface remains usable on small screens

## 4.9 API Integration

### 4.9.1 Service Layer
- Create `src/api/analysis.ts` service file with methods:
  - `fetchAnalyses(params)`
  - `createAnalysis(data)`
  - `updateAnalysis(id, data)`
  - `publishAnalysis(id)`
  - `archiveAnalysis(id)`
  - `linkAssessmentSession(analysisId, sessionId)`
  - `unlinkAssessmentSession(analysisId, sessionId)`
  - `createVideo(data)`
  - `createAnnotation(analysisVideoId, data)`
  - `createComment(analysisId, data)`

### 4.9.2 API Response Handling
- Consistent error handling with Axios interceptors
- Loading states for all API requests
- Error messages mapped to UI components
- Success notifications for create/update operations

### 4.9.2 Authentication
- Axios instance configured with JWT token
- `Current.user` equivalent in frontend via context
- Authorization headers automatically added to requests