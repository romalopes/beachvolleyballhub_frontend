# 04_FRONTEND_ANALYSIS_WORKFLOW.md (part 1)

## 4. Frontend Analysis Workflow

### 4.1 Main Navigation Changes
- Add "Analysis" item to the main navigation sidebar
- Update home page to include Analysis card
- Ensure consistent styling with existing navigation patterns

### 4.2 Analysis-Specific Routes
- `/analyses` - List and create analyses
- `/analyses/:id` - View analysis details
- `/analyses/:id/edit` - Edit analysis
- `/hire-analysis` - Coming Soon placeholder page

### 4.3 Sidebar Navigation
- Add "Analysis" menu item with appropriate icon
- Ensure active state highlighting when on analysis routes
- Maintain consistent spacing and styling with other navigation items

### 4.4 Home Page Updates
- Add Analysis card to the home page grid
- Include brief description and call-to-action button
- Ensure responsive design for all screen sizes

### 4.5 List View and Filtering
- Implement filter options for:
  - Status (draft/published/archived)
  - Organization
  - Group
  - Search by title
- Pagination for large lists
- Sort options (by creation date, title, etc.)

### 4.6 Create/Edit Form
- Form fields for:
  - Title
  - Summary
  - Status selection
  - Organization dropdown
  - Group dropdown
  - Training session selection
  - Tournament selection
  - Participant selection (multi-select)
- Submit button with loading state
- Validation feedback for required fields

### 4.7 Video Source Selection
- Radio buttons for source type (external vs upload)
- External video URL input field with validation
- File upload component for uploaded videos
- Preview of selected video (if applicable)

### 4.8 Assessment Session Integration
- Dropdown to select existing assessment sessions
- Option to create new assessment session
- Pre-fill participant list based on assessment session
- Link analysis to assessment session after creation