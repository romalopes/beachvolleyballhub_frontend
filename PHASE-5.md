# Phase 5: Tournaments Feature

## Overview
This phase adds tournament management capabilities to the beach volleyball hub application.

## API Endpoints
All tournament-related API methods are available in `src/api.ts` under the `api` object.

### List Tournaments
```typescript
api.tournaments(filters?: TournamentFilters)
```
- **Description**: Retrieves a paginated list of tournaments with optional filtering.
- **Parameters**: 
  - `filters`: Optional `TournamentFilters` object (see below).
- **Returns**: `Promise<PaginatedResponse<Tournament>>`

### Tournament Options
```typescript
api.tournamentOptions()
```
- **Description**: Gets available options for tournament filters (scopes, publication states, etc.).
- **Returns**: `Promise<TournamentOptions>`

### Get Tournament
```typescript
api.tournament(id)
```
- **Description**: Retrieves a single tournament by ID.
- **Parameters**: 
  - `id`: Tournament ID (number or string)
- **Returns**: `Promise<Tournament>`

### Create Tournament
```typescript
api.createTournament(data)
```
- **Description**: Creates a new tournament.
- **Parameters**: 
  - `data`: Tournament data (excluding id, organisation, divisions, participations, watch_links, created_by_account_id)
- **Returns**: `Promise<Tournament>`

### Update Tournament
```typescript
api.updateTournament(id, data)
```
- **Description**: Updates an existing tournament.
- **Parameters**: 
  - `id`: Tournament ID (number or string)
  - `data`: Partial tournament data (same exclusions as create)
- **Returns**: `Promise<Tournament>`

### Archive Tournament
```typescript
api.archiveTournament(id)
```
- **Description**: Archives a tournament.
- **Parameters**: 
  - `id`: Tournament ID (number or string)
- **Returns**: `Promise<Tournament>`

### Publish Tournament
```typescript
api.publishTournament(id)
```
- **Description**: Publishes a tournament.
- **Parameters**: 
  - `id`: Tournament ID (number or string)
- **Returns**: `Promise<Tournament>`

### Participate in Tournament
```typescript
api.participateTournament(tournamentId, params)
```
- **Description**: Allows a user to participate in a tournament.
- **Parameters**: 
  - `tournamentId`: Tournament ID (number or string)
  - `params`: Object containing `role` (ParticipationRole) and `division_ids` (array of numbers)
- **Returns**: `Promise<Participation>`

### Leave Tournament
```typescript
api.leaveTournament(tournamentId)
```
- **Description**: Removes the current user's participation in a tournament.
- **Parameters**: 
  - `tournamentId`: Tournament ID (number or string)
- **Returns**: `Promise<void>`

## Filter Types
The `TournamentFilters` interface includes the following optional properties:
- `search`: Text search term
- `scope`: Tournament scope (e.g., public, private)
- `organisation_id`: Filter by organisation
- `division_scheme`: Filter by division scheme
- `letter_levels`: Array of letter-based levels (e.g., ["A", "B"])
- `division_numbers`: Array of division numbers
- `location`: Location filter
- `temporal_status`: Filter by temporal status (upcoming, ongoing, past)
- `mine`: Boolean to show only tournaments the user participates in
- `publication_state`: Filter by publication state (draft, published, archived)
- `starts_at`: Filter by start date (ISO string)
- `ends_at`: Filter by end date (ISO string)
- `page`: Page number for pagination
- `per_page`: Number of items per page

## Components
### TournamentCard
Displays a summary of a tournament in a grid layout.
- **Props**: 
  - `tournament`: Tournament object
  - `onParticipate`: Function to handle participation
  - `onLeave`: Function to handle leaving

### TournamentBadge
Shows a badge indicating the tournament's scope or publication state.
- **Props**: 
  - `variant`: "scope" or "publication"
  - `text`: Text to display

### DivisionChip
Represents a division within a tournament.
- **Props**: 
  - `division`: Division object or string
  - `selected`: Boolean indicating if selected

### FilterState
Manages the state of tournament filters and provides UI for filtering and resetting.
- **Props**: 
  - `filters`: Current filter state
  - `onChange`: Function to handle filter changes
  - `onReset`: Function to handle reset

### LoadingState
Shows a loading indicator.
- **Props**: None

### ErrorState
Shows an error message.
- **Props**: 
  - `error`: Error object or string

### TournamentFilterForm
Form for configuring tournament filters.
- **Props**: 
  - `filters`: Current filter state
  - `onChange`: Function to handle filter changes

### Tournaments Page
Main page displaying a list of tournaments with filtering capabilities.
- **Path**: `/tournaments`

### TournamentDetail Page
Detailed view of a specific tournament.
- **Path**: `/tournaments/:id`

## Styling
All styling for the tournament components is located in `src/App.css` and uses existing CSS variables to maintain visual consistency with the rest of the application. New styles follow the BEM-like naming convention used throughout the project.

## Usage
To use the tournament features, navigate to `/tournaments` in the application. From there, you can:
- Apply filters using the filter form
- View tournament cards in a responsive grid
- Click on a tournament to view its details
- Participate in or leave a tournament (if applicable)
- Tournament organizers can archive or publish tournaments from the detail view

## Implementation Notes
- The filtering system supports over 15 different filter parameters with client-side state management.
- Reusable UI patterns (badges, chips, loading/error states) ensure consistency.
- All API methods use the existing `fetchAPI` and `postJSON` helpers for uniform error handling.

## Fixes Applied
- Removed duplicate malformed tournament routes in `src/App.tsx` that contained invalid Unicode escape sequences.
- Fixed missing closing `>` in the `Partial<Omit<...>>` type in the `updateTournament` method in `src/api.ts`.