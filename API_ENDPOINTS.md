# Chorely API Endpoints

This document lists all available API endpoints that correspond to the frontend mock.ts functions.

## Authentication & Users

### User Management
- `POST /user` - Create user
  - Body: `{ email: string, homeIds: string[], name?: string }`
  - Returns: User object

- `POST /user/login` - Login user
  - Body: `{ email: string }`
  - Returns: User object

- `GET /user/:email` - Get user by email
  - Returns: User object

- `GET /user/:email/home` - Get user's homes
  - Returns: Array of Home objects

- `POST /user/join` - Join a home
  - Body: `{ email: string, homeId: string }`

- `POST /user/leave` - Leave a home
  - Body: `{ email: string, homeId: string }`

## Home Management

### Home Operations
- `POST /homes` - Create home
  - Body: `{ name: string }`
  - Returns: Home object

- `GET /homes` - Get all homes
  - Returns: Array of Home objects

- `GET /homes/:id` - Get home by ID
  - Returns: Home object

- `GET /homes/:id/users` - Get users in home
  - Returns: Array of User objects

- `PATCH /homes/:id/quota` - Update weekly point quota
  - Body: `{ weeklyPointQuota: number }`
  - Returns: `{ weeklyPointQuota: number }`

## Chore Management

### Chore Operations
- `POST /chores` - Create chore
  - Body: `{ name: string, description: string, time: string, icon: string, home_id: string, points: number, user_email?: string }`
  - Returns: Chore object

- `GET /chores/:uuid` - Get chore by UUID
  - Returns: Chore object

- `GET /chores/available/:homeId` - Get available chores
  - Returns: Array of Chore objects

- `GET /chores/unapproved/:homeId` - Get unapproved chores
  - Returns: Array of Chore objects

- `GET /chores/user` - Get user's chores
  - Query: `?email=string&homeId=string`
  - Returns: Array of Chore objects

- `PATCH /chores/:uuid/approve` - Approve chore
- `PATCH /chores/:uuid/claim` - Claim chore
  - Body: `{ email: string }`
- `PATCH /chores/:uuid/complete` - Complete chore
- `PATCH /chores/:uuid/verify` - Verify chore

## Approval System

### Chore Approvals
- `GET /approvals/:uuid` - Get approval status
  - Returns: Approval status object

- `POST /approvals/:uuid/vote` - Vote for chore approval
  - Body: `{ userEmail: string }`

- `POST /approvals/:uuid/unvote` - Remove vote
  - Body: `{ userEmail: string }`

## Points System

### Points Management
- `GET /points/:homeId` - Get all user points in home
  - Returns: Array of user points

- `GET /points/:homeId/:email` - Get user's points
  - Returns: `{ points: number }`

- `POST /points/:homeId/:email` - Add points to user
  - Body: `{ delta: number }`
  - Returns: `{ points: number }`

- `PUT /points/:homeId/:email` - Update user's points
  - Body: `{ points: number }`
  - Returns: `{ points: number }`

## Disputes

### Dispute Management
- `GET /disputes` - Get disputes
  - Query: `?status=pending|approved|rejected`
  - Returns: Array of Dispute objects

- `POST /disputes` - Create dispute
  - Body: `{ choreId: string, reason: string, imageUrl?: string, disputerEmail: string }`
  - Returns: Dispute object

- `PATCH /disputes/:uuid/approve` - Approve dispute
- `PATCH /disputes/:uuid/reject` - Reject dispute

## Activity

### Recent Activity
- `GET /activities` - Get recent activity
  - Query: `?homeId=string&timeFrame=1d|7d|30d`
  - Returns: Array of completed chores

## Todo Items

### Todo Management
- `GET /todos/:choreId` - Get todo items for chore
  - Returns: Array of TodoItem objects

## Data Models

### User
```typescript
{
  email: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}
```

### Home
```typescript
{
  id: string;
  name: string;
  weekly_point_quota: number;
  created_at?: string;
  updated_at?: string;
}
```

### Chore
```typescript
{
  uuid: string;
  name: string;
  description: string;
  time: string;
  icon: string;
  user_email: string | null;
  status: "unapproved" | "unclaimed" | "claimed" | "complete";
  home_id: string;
  points: number;
  completed_at: string | null;
  created_at?: string;
  updated_at?: string;
}
```

### Dispute
```typescript
{
  uuid: string;
  chore_id: string;
  disputer_email: string;
  reason: string;
  image_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at?: string;
  updated_at?: string;
}
```

### TodoItem
```typescript
{
  id: string;
  chore_id: string;
  name: string;
  description: string;
  order: number;
}
```

## Error Responses

All endpoints return errors in the following format:
```typescript
{
  error: string;
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `204` - No content (for updates)
- `400` - Bad request
- `404` - Not found
- `409` - Conflict
- `500` - Server error
