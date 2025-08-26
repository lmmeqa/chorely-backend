# Chorely API Documentation

A Hono-based REST API for the Chorely chore management application.

## Base URL

- **Local Development**: `http://localhost:3000` or `http://localhost:8787`
- **Staging**: `https://chorely-backend-staging.your-account.workers.dev`
- **Production**: `https://chorely-backend.your-account.workers.dev`

## Authentication

All protected endpoints require a Supabase JWT token in the Authorization header:

```http
Authorization: Bearer <supabase-access-token>
```

## Response Format

- **Success**: JSON data with appropriate HTTP status codes
- **Error**: `{ "error": "<message>" }` with appropriate HTTP status code
- **Content-Type**: `application/json`

---

## Public Endpoints

### Health Check
```http
GET /public/ping
```
Returns `{"pong": true}` - No authentication required.

### Database Ping
```http
GET /internal/db-ping
```
Internal endpoint to verify database connectivity.

---

## Authentication

### Authenticate Session
```http
POST /auth/authenticate
```
Authenticates the current Supabase session and creates/updates user in backend.

**Response**: `200` → User profile or `401` Unauthorized

---

## Users

### Create User
```http
POST /user
```
**Body**:
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "homeIds": ["home-uuid"] // optional
}
```
**Response**: `201` → User object

### Get User Profile
```http
GET /me
```
Get current authenticated user's profile.

**Response**: `200` → User object

### Delete Account
```http
DELETE /user/me
```
Delete current user's account.

**Response**: `204` No Content

### Join Home
```http
POST /user/join
```
**Body**:
```json
{
  "email": "user@example.com",
  "homeId": "home-uuid"
}
```
**Response**: `204` No Content

### Leave Home
```http
POST /user/leave
```
**Body**:
```json
{
  "email": "user@example.com", 
  "homeId": "home-uuid"
}
```
**Response**: `204` No Content

### Get User Homes
```http
GET /user/{email}/home
```
Get all homes for a specific user.

**Response**: `200` → Array of home objects

---

## Homes

### Create Home
```http
POST /homes
```
**Body**:
```json
{
  "name": "My Home"
}
```
**Response**: `201` → Home object

### Get All Homes
```http
GET /homes
```
**Response**: `200` → Array of home objects

### Get Home by ID
```http
GET /homes/{homeId}
```
**Response**: `200` → Home object

### Get Home Users
```http
GET /homes/{homeId}/users
```
**Response**: `200` → Array of user objects

### Update Weekly Quota
```http
PATCH /homes/{homeId}/quota
```
**Body**:
```json
{
  "weeklyPointQuota": 100
}
```
**Response**: `200` → `{"weeklyPointQuota": number}`

---

## Chores

### Create Chore
```http
POST /chores
```
**Body**:
```json
{
  "name": "Wash Dishes",
  "description": "Clean all dishes in sink",
  "time": "2024-01-01T12:00:00Z",
  "icon": "🍽️",
  "home_id": "home-uuid",
  "points": 10
}
```
**Response**: `201` → Chore object with generated todos

### Get Chore by ID
```http
GET /chores/{choreUuid}
```
**Response**: `200` → Chore object with todos

### Get Available Chores
```http
GET /chores/available/{homeId}
```
Get unclaimed chores for a home.

**Response**: `200` → Array of chore objects

### Get User's Chores
```http
GET /chores/user?homeId={homeId}
```
Get current user's claimed chores in a home.

**Response**: `200` → Array of chore objects

### Get Unapproved Chores
```http
GET /chores/unapproved/{homeId}
```
Get chores awaiting approval in a home.

**Response**: `200` → Array of chore objects

### Claim Chore
```http
PATCH /chores/{choreUuid}/claim
```
**Response**: `204` No Content

### Complete Chore
```http
PATCH /chores/{choreUuid}/complete
```
**Body** (optional image):
```json
{
  "image": {
    "data": "base64-encoded-image-data",
    "filename": "completion-photo.jpg",
    "contentType": "image/jpeg"
  }
}
```
**Response**: `204` No Content

### Approve Chore
```http
PATCH /chores/{choreUuid}/approve
```
Move chore from unapproved to unclaimed status.

**Response**: `204` No Content

### Get Chore Count by Status
```http
GET /chores/count/{homeId}
```
**Response**: `200` → 
```json
{
  "total": 10,
  "unapproved": 2,
  "unclaimed": 3,
  "claimed": 2,
  "complete": 3
}
```

---

## Todos

### Get Todos for Chore
```http
GET /todos/chore/{choreId}
```
**Response**: `200` → Array of todo objects

### Create Todo
```http
POST /todos
```
**Body**:
```json
{
  "chore_id": "chore-uuid",
  "name": "Step 1",
  "order": 0
}
```
**Response**: `201` → Todo object

### Generate Todos with AI
```http
POST /todos/generate
```
**Body**:
```json
{
  "choreName": "Clean Kitchen",
  "choreDescription": "Deep clean the entire kitchen"
}
```
**Response**: `200` → Array of generated todo objects

---

## Approvals

### Get Approval Status
```http
GET /approvals/{choreUuid}
```
**Response**: `200` →
```json
{
  "hasVoted": {"user@example.com": true},
  "votesNeeded": 2,
  "currentVotes": 1,
  "isApproved": false,
  "totalEligibleVoters": 3,
  "voters": ["user@example.com"]
}
```

### Vote for Chore
```http
POST /approvals/{choreUuid}/vote
```
Vote to approve a completed chore.

**Response**: `200` → `{"approved": boolean}`

### Remove Vote
```http
POST /approvals/{choreUuid}/unvote
```
**Response**: `200` → `{"approved": boolean}`

---

## Disputes

### Create Dispute
```http
POST /disputes
```
**Body** (JSON or multipart):
```json
{
  "choreId": "chore-uuid",
  "reason": "Job not completed properly",
  "image": {
    "data": "base64-encoded-image-data",
    "filename": "evidence.jpg",
    "contentType": "image/jpeg"
  }
}
```
**Response**: `201` → Dispute object

### Get Disputes
```http
GET /disputes?homeId={homeId}&status=pending
```
**Query Parameters**:
- `homeId` (required): Home UUID
- `status` (optional): `pending`, `sustained`, `overruled`

**Response**: `200` → Array of dispute objects with chore details

### Get Dispute by ID
```http
GET /disputes/{disputeUuid}
```
**Response**: `200` → Dispute object

### Sustain Dispute
```http
PATCH /disputes/{disputeUuid}/sustain
```
Admin endpoint to sustain a dispute.

**Response**: `204` No Content

### Overrule Dispute  
```http
PATCH /disputes/{disputeUuid}/overrule
```
Admin endpoint to overrule a dispute.

**Response**: `204` No Content

---

## Dispute Votes

### Vote on Dispute
```http
POST /dispute-votes/{disputeUuid}/vote
```
**Body**:
```json
{
  "vote": "sustain"  // or "overrule"
}
```
**Response**: `204` No Content

### Remove Dispute Vote
```http
DELETE /dispute-votes/{disputeUuid}/vote
```
**Response**: `204` No Content

### Get Dispute Vote Status
```http
GET /dispute-votes/{disputeUuid}/status
```
**Response**: `200` →
```json
{
  "dispute_uuid": "uuid",
  "sustain_votes": 1,
  "overrule_votes": 2,
  "total_votes": 3,
  "required_votes": 2,
  "total_eligible_voters": 4,
  "is_sustained": false,
  "is_overruled": true,
  "is_24_hours_passed": false,
  "hours_since_creation": 2.5,
  "voters": [
    {"user_email": "user1@example.com", "vote": "sustain"},
    {"user_email": "user2@example.com", "vote": "overrule"}
  ]
}
```

### Get User's Vote
```http
GET /dispute-votes/{disputeUuid}/user/{userEmail}
```
**Response**: `200` → `{"vote": "sustain" | "overrule" | null}`

---

## Points

### Get User Points
```http
GET /points/{homeId}/{userEmail}
```
**Response**: `200` → `{"points": number}`

### Get All User Points
```http
GET /points/{homeId}
```
**Response**: `200` → Array of user point objects

---

## Activities

### Get Recent Activities
```http
GET /activities?homeId={homeId}&timeFrame=3d
```
**Query Parameters**:
- `homeId` (required): Home UUID
- `timeFrame` (optional): `1d`, `3d`, `7d`, `30d` (default: `3d`)

**Response**: `200` → Array of completed chore objects (excludes disputed chores)

---

## Data Models

### User
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "homeIDs": ["home-uuid"]
}
```

### Home
```json
{
  "id": "home-uuid",
  "name": "My Home",
  "weeklyPointQuota": 100,
  "userPoints": {"user@example.com": 50}
}
```

### Chore
```json
{
  "uuid": "chore-uuid",
  "name": "Wash Dishes",
  "description": "Clean all dishes",
  "time": "2024-01-01T12:00:00Z",
  "icon": "🍽️",
  "status": "unclaimed",
  "user_email": null,
  "homeID": "home-uuid",
  "points": 10,
  "todos": [{"name": "Step 1"}, {"name": "Step 2"}],
  "approvalList": [],
  "completed_at": null,
  "claimed_at": null,
  "photo_url": null
}
```

### Dispute
```json
{
  "uuid": "dispute-uuid",
  "choreId": "chore-uuid",
  "choreName": "Wash Dishes",
  "choreDescription": "Clean all dishes",
  "choreIcon": "🍽️",
  "chorePoints": 10,
  "disputerEmail": "user@example.com",
  "disputerName": "John Doe", 
  "reason": "Job not done properly",
  "imageUrl": "https://signed-url-to-image",
  "status": "pending",
  "createdAt": "2024-01-01T12:00:00Z",
  "claimedByEmail": "other@example.com"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid request body or parameters |
| 401 | Unauthorized - Invalid or missing authentication token |
| 403 | Forbidden - User lacks permission for resource |
| 404 | Not Found - Resource does not exist |
| 409 | Conflict - Resource already exists or constraint violation |
| 500 | Internal Server Error - Server error occurred |

---

## Rate Limiting

Currently no rate limiting is implemented. In production, consider implementing rate limits based on:
- Authentication status
- Endpoint sensitivity
- User tier/subscription

## Image Handling

- **Upload**: Images are accepted as base64-encoded data in JSON requests
- **Storage**: Images are stored in Supabase Storage private buckets
- **Access**: Images are served via signed URLs with expiration
- **Formats**: JPEG preferred, other formats supported
- **Size**: No explicit limits currently enforced

## Database

- **Local Development**: Seed images served statically from `/seed/*`
- **Production**: Seed images stored in Supabase Storage as `seed/*` paths
- **User uploads**: Stored as timestamped paths like `proofs/chores/{uuid}/{timestamp}-{filename}`