### Chorely API (v1) – Developer Guide

All endpoints are JSON-only and follow REST conventions.

| Resource | Base URL    |
| -------- | ----------- |
| Users    | `/user`     |
| Homes    | `/homes`    |
| Chores   | `/chores`   |
| Points   | `/points`   |
| Disputes | `/disputes` |
| Activity | `/activities` |
| Todos    | `/todos`    |

> **Auth** – no authentication layer is included in the demo.
> **Errors** – every error is returned as<br>`{ "error": "<message>" }` with an appropriate HTTP status.
> **Body format** – `Content-Type: application/json`.

---

## 1 · Users

| Verb     | Endpoint              | Description                                 | Body / Query                                        | Success ⇢                   |
| -------- | --------------------- | ------------------------------------------- | --------------------------------------------------- | --------------------------- |
| **POST** | `/user`               | Create a user and link to ≥ 1 home          | `{ "email": "me@x.com", "homeIds": ["home-uuid"], "name": "John Doe" }` | **201** Created → `UserRow` |
| **POST** | `/user/login`         | Look up a user by email (very thin "login") | `{ "email": "me@x.com" }`                           | **200** → `UserRow`         |
| **GET**  | `/user/:email`        | Get user by email                            | —                                                   | **200** → `UserRow`         |
| **GET**  | `/user/:email/home`   | List all homes this user belongs to         | —                                                   | **200** → `HomeRow[]`       |
| **POST** | `/user/join`          | Add user to an existing home                | `{ "email": "me@x.com", "homeId": "home-uuid" }`    | **204** No Content          |
| **POST** | `/user/leave`         | Remove user from a home                     | `{ "email": "me@x.com", "homeId": "home-uuid" }`    | **204** No Content          |

*Errors*

* `409 Conflict` – email already registered
* `404` – user or home not found
* `400` – user would become orphaned (when leaving homes)

---

## 2 · Homes

| Verb     | Endpoint              | Description                    | Body                                             | Success ⇢             |
| -------- | -------------------- | ------------------------------ | ------------------------------------------------ | --------------------- |
| **POST** | `/homes`             | Create a new home              | `{ "name": "Summer Cabin" }`                     | **201** → `HomeRow`   |
| **GET**  | `/homes`             | List all homes                 | —                                                | **200** → `HomeRow[]` |
| **GET**  | `/homes/:id`         | Get one home by id             | —                                                | **200** → `HomeRow`   |
| **GET**  | `/homes/:id/users`   | Get users in home              | —                                                | **200** → `UserRow[]` |
| **PATCH**| `/homes/:id/quota`   | Update weekly point quota      | `{ "weeklyPointQuota": 100 }`                    | **200** → `{ weeklyPointQuota: number }` |

---

## 3 · Chores

`ChoreStatus = "unapproved" | "unclaimed" | "claimed" | "complete"`

| Verb      | Endpoint                     | Description                          | Body / Query                                 | Success ⇢              |
| --------- | ---------------------------- | ------------------------------------ | -------------------------------------------- | ---------------------- |
| **POST**  | `/chores`                    | Create a chore (starts *unapproved*) | `{ name, description, time, icon, home_id, points, user_email? }` | **201** → `ChoreRow`   |
| **GET**   | `/chores/:uuid`              | Get chore by UUID                    | —                                            | **200** → `ChoreRow`   |
| **GET**   | `/chores/available/:homeId`  | Unclaimed chores for a home          | —                                            | **200** → `ChoreRow[]` |
| **GET**   | `/chores/unapproved/:homeId` | Chores awaiting approval             | —                                            | **200** → `ChoreRow[]` |
| **GET**   | `/chores/user`               | Chores for a user                    | `?email=string&homeId=string`                 | **200** → `ChoreRow[]` |
| **PATCH** | `/chores/:uuid/approve`      | Approve → status = *unclaimed*       | —                                            | **204**                |
| **PATCH** | `/chores/:uuid/claim`        | Claim a chore                        | `{ "email": "me@x.com" }`                    | **204**                |
| **PATCH** | `/chores/:uuid/complete`     | Mark complete (auto-awards dynamic points) | —                                            | **204**                |

*Errors*

* `400` – FK violation (bad `home_id` / user not in home)
* `409` – attempting to claim an already-claimed chore
* `404` – unknown chore UUID

---

## 4 · Points System

| Verb     | Endpoint                    | Description                    | Body / Query                    | Success ⇢                    |
| -------- | --------------------------- | ------------------------------ | ------------------------------- | ---------------------------- |
| **GET**  | `/points/:homeId`           | Get all user points in home    | —                               | **200** → `UserPoints[]`      |
| **GET**  | `/points/:homeId/:email`    | Get user's points              | —                               | **200** → `{ points: number }` |
| **POST** | `/points/:homeId/:email`    | Add points to user             | `{ "delta": 10 }`               | **200** → `{ points: number }` |
| **PUT**  | `/points/:homeId/:email`    | Update user's points           | `{ "points": 50 }`              | **200** → `{ points: number }` |

---

## 5 · Disputes

| Verb     | Endpoint                    | Description                    | Body / Query                    | Success ⇢                    |
| -------- | --------------------------- | ------------------------------ | ------------------------------- | ---------------------------- |
| **GET**  | `/disputes`                 | Get disputes                   | `?status=pending\|approved\|rejected` | **200** → `DisputeRow[]` |
| **GET**  | `/disputes/:uuid`           | Get dispute by UUID            | —                               | **200** → `DisputeRow`        |
| **POST** | `/disputes`                 | Create dispute                 | `{ choreId, reason, imageUrl?, disputerEmail }` | **201** → `DisputeRow` |

### Dispute Voting System

Disputes are resolved through a voting system where family members vote to approve or reject the dispute. When 50% or more of family members vote to approve, the dispute is automatically approved and the chore is reverted.

| Verb     | Endpoint                    | Description                    | Body / Query                    | Success ⇢                    |
| -------- | --------------------------- | ------------------------------ | ------------------------------- | ---------------------------- |
| **POST** | `/dispute-votes/:disputeUuid/vote` | Vote on dispute            | `{ userEmail, vote }`           | **204**                       |
| **DELETE**| `/dispute-votes/:disputeUuid/vote` | Remove vote              | `{ userEmail }`                 | **204**                       |
| **GET**  | `/dispute-votes/:disputeUuid/status` | Get vote status        | —                               | **200** → `DisputeVoteStatus` |
| **GET**  | `/dispute-votes/:disputeUuid/user/:userEmail` | Get user's vote | —                               | **200** → `{ vote }`          |

**Vote Types:**
- `"approve"` - Vote to approve the dispute (revert chore completion)
- `"reject"` - Vote to reject the dispute (keep chore completed)

**Auto-Resolution:**
- When 50% or more family members vote "approve", the dispute is automatically approved
- When 50% or more family members vote "reject", the dispute is automatically rejected
- Approved disputes remove points from the chore assignee and revert the chore to "claimed" status

---

## 6 · Activity

| Verb     | Endpoint                    | Description                    | Body / Query                    | Success ⇢                    |
| -------- | --------------------------- | ------------------------------ | ------------------------------- | ---------------------------- |
| **GET**  | `/activities`               | Get recent activity            | `?homeId=string&timeFrame=1d\|7d\|30d` | **200** → `ChoreRow[]` |

---

## 7 · Todo Items

| Verb     | Endpoint                    | Description                    | Body / Query                    | Success ⇢                    |
| -------- | --------------------------- | ------------------------------ | ------------------------------- | ---------------------------- |
| **GET**  | `/todos`                    | Get all todo items             | —                               | **200** → `TodoItemRow[]`     |
| **POST** | `/todos`                    | Create a todo item             | `{ name, description, chore_id, order? }` | **201** → `TodoItemRow` |
| **GET**  | `/todos/:id`                | Get todo item by ID            | —                               | **200** → `TodoItemRow`       |
| **GET**  | `/todos/chore/:choreId`     | Get todo items for chore       | —                               | **200** → `TodoItemRow[]`     |
| **POST** | `/todos/generate`           | Generate todos using GPT API   | `{ choreName, choreDescription }` | **200** → `GeneratedTodos`   |

### Auto-Generated Todos

When creating a new chore, the system automatically generates a todo list using GPT API. The generated todos are:

- **Clear and actionable** - Each step is specific and easy to follow
- **In logical order** - Steps are arranged in the most efficient sequence
- **Appropriate for household chores** - Tailored to common cleaning and maintenance tasks
- **Fallback support** - If GPT API is unavailable, predefined todo lists are used

**Generated Todos Response:**
```json
{
  "choreName": "Taking out trash",
  "choreDescription": "Empty all trash cans and take out the garbage",
  "todos": [
    {
      "name": "Collect trash",
      "description": "Gather trash from all bins in the house"
    },
    {
      "name": "Replace liners",
      "description": "Put new liners in all the trash cans"
    },
    {
      "name": "Take out to curb",
      "description": "Take the main trash bag to the outdoor bin/curb"
    }
  ]
}
```

*Errors*

* `400` – Missing choreName or choreDescription
* `500` – GPT API error (falls back to predefined todos)
* `400` – FK violation (bad `chore_id`)
* `404` – unknown todo ID

---

## 8 · Approval System

| Verb     | Endpoint                    | Description                    | Body / Query                    | Success ⇢                    |
| -------- | --------------------------- | ------------------------------ | ------------------------------- | ---------------------------- |
| **GET**  | `/approvals/:uuid`          | Get approval status            | —                               | **200** → `ApprovalStatus`    |
| **POST** | `/approvals/:uuid/vote`     | Vote for chore approval        | `{ "userEmail": "me@x.com" }`   | **204**                       |
| **POST** | `/approvals/:uuid/unvote`   | Remove vote                    | `{ "userEmail": "me@x.com" }`   | **204**                       |

---

## 9 · Row Shapes

```ts
// UserRow
{
  email:     string,
  name:      string,
  created_at?: string,  // Pacific time (YYYY-MM-DDTHH:mm:ss)
  updated_at?: string   // Pacific time (YYYY-MM-DDTHH:mm:ss)
}

// HomeRow
{
  id:                  string,
  name:                string,
  weekly_point_quota:  number,
  created_at?:         string,  // Pacific time (YYYY-MM-DDTHH:mm:ss)
  updated_at?:         string   // Pacific time (YYYY-MM-DDTHH:mm:ss)
}

// ChoreRow
{
  uuid:          string,
  name:          string,
  description:   string,
  time:          string,        // Pacific time (YYYY-MM-DDTHH:mm:ss)
  icon:          string,
  user_email:    string | null,
  status:        "unapproved" | "unclaimed" | "claimed" | "complete",
  home_id:       string,
  points:        number,        // Base points value (see Dynamic Points section)
  completed_at:  string | null, // Pacific time (YYYY-MM-DDTHH:mm:ss)
  claimed_at:    string | null, // Pacific time (YYYY-MM-DDTHH:mm:ss) - when chore was claimed
  created_at?:   string,        // Pacific time (YYYY-MM-DDTHH:mm:ss)
  updated_at?:   string         // Pacific time (YYYY-MM-DDTHH:mm:ss)
}

// DisputeRow
{
  uuid:            string,
  chore_id:        string,
  disputer_email:  string,
  reason:          string,
  image_url:       string | null,
  status:          "pending" | "approved" | "rejected",
  created_at?:     string,  // Pacific time (YYYY-MM-DDTHH:mm:ss)
  updated_at?:     string   // Pacific time (YYYY-MM-DDTHH:mm:ss)
}

// TodoItemRow
{
  id:          string,
  chore_id:    string,
  name:        string,
  description: string,
  order:       number
}

// UserPoints
{
  email: string,
  points: number
}

// ApprovalStatus (from GET /approvals/:uuid)
{
  status:    "unapproved" | "unclaimed" | "claimed" | "complete",
  voters:    string[],  // Array of user emails who voted
  votes:     number,    // Current number of votes
  required:  number     // Required votes for approval (50% of home users, minimum 1)
}

// ApprovalResponse (from POST /approvals/:uuid/vote and POST /approvals/:uuid/unvote)
{
  approved:  boolean,   // Whether the chore is approved (votes >= required)
  votes:     number,    // Current number of votes
  required:  number,    // Required votes for approval
  voters:    string[]   // Array of user emails who voted
}

// DisputeVoteStatus (from GET /dispute-votes/:disputeUuid/status)
{
  dispute_uuid:    string,    // UUID of the dispute
  approve_votes:   number,    // Number of approve votes
  reject_votes:    number,    // Number of reject votes
  total_votes:     number,    // Total number of votes cast
  required_votes:  number,    // Required votes for resolution (50% of home members)
  is_approved:     boolean,   // Whether dispute is approved (approve_votes >= required_votes)
  is_rejected:     boolean,   // Whether dispute is rejected (reject_votes >= required_votes)
  voters:          {          // Array of voters and their votes
    user_email:    string,
    vote:          "approve" | "reject"
  }[]
}
```

---

## 10 · Common SQLSTATE → HTTP Mapping

| SQLSTATE | Meaning                            | HTTP    | API message                |
| -------- | ---------------------------------- | ------- | -------------------------- |
| `23505`  | unique violation (duplicate email) | **409** | "Resource already exists"  |
| `23503`  | FK violation (bad home/user)       | **400** | "Related record not found" |

---

## 11 · Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `204` - No content (for updates)
- `400` - Bad request
- `404` - Not found
- `409` - Conflict
- `500` - Server error

---

## 12 · Timestamp Format

All timestamps in API responses are returned in **Pacific time** using the format `YYYY-MM-DDTHH:mm:ss` (e.g., `"2025-08-10T03:15:31"`).

**Note**: While timestamps are stored in UTC in the database, the API automatically converts them to Pacific time for user-friendly display. This applies to all timestamp fields including:
- `created_at`
- `updated_at` 
- `completed_at`
- `claimed_at`
- `time` (chore due dates)

---

## 13 · Dynamic Point System

Chores use a dynamic point system that encourages users to claim tasks quickly:

### **How it works:**
- **Base Points**: Each chore has a base point value stored in the database
- **Time Bonus**: Unclaimed chores get a bonus based on how long they've been unclaimed
- **Calculation**: Points increase by 10% every 24 hours, capped at 100% increase (double points)
- **Formula**: `final_points = base_points * (1 + (hours_unclaimed / 24) * 0.1)`, max 2.0x multiplier

### **Examples:**
- A 100-point chore unclaimed for 24 hours = 110 points
- A 100-point chore unclaimed for 48 hours = 120 points  
- A 100-point chore unclaimed for 240 hours (10 days) = 200 points (maximum)

### **When points are awarded:**
- **Chore Completion**: Users receive the dynamic points based on when they claimed the chore
- **Dispute Approval**: If a dispute is approved, the dynamic points are removed from the user and the chore status reverts to "claimed"

### **API Behavior:**
- **Available Chores**: The `/chores/available/:homeId` endpoint returns chores with current dynamic point values
- **Individual Chores**: The `/chores/:uuid` endpoint returns the current dynamic point value
- **Point Calculation**: Uses the `claimed_at` timestamp to determine the exact bonus when the chore was claimed

---

## 14 · Mock vs. Backend Implementation Differences

**⚠️ Important**: The frontend's `mock.ts` file provides a simplified simulation for development. The real backend has more sophisticated behavior that differs in several key ways:

### **Core Behavioral Differences**
| Feature | Mock Implementation | Real Backend |
|---------|-------------------|--------------|
| **Chore Completion** | `completeChoreAPI()` only changes status to "complete" | `complete()` changes status AND automatically awards points to the user |
| **Point Values** | Always static (e.g., 10 points) | **Dynamic**: increases by 10% every 24 hours unclaimed, up to 100% bonus |
| **Point Management** | Must manually call `updateUserPointsAPI()` after completion | **Fully automatic** - no manual point calls needed |
| **Dispute Approval** | Only changes dispute status to "approved" | **Complex workflow**: removes points from user, reverts chore to "claimed", clears completion timestamp |
| **Chore Reversal** | Not possible - completed chores stay completed | **Disputes can undo** completed chores back to "claimed" status |
| **Time Tracking** | Basic timestamps in ISO format | **Pacific timezone** with user-friendly formatting (e.g., "2025-08-10T03:15:31") |



### **Key Backend Features Not in Mock**
1. **Dynamic Point Calculation** - Points increase over time for unclaimed chores
2. **Automatic Point Management** - No manual point adding/removing needed
3. **Chore Status Reversion** - Disputes can undo completed chores
4. **Pacific Time Handling** - All timestamps in user-friendly Pacific time
5. **Real-time Data** - No static mock data, all operations affect real database state

### **Migration Path**
When switching from mock to backend:
1. **Remove manual point calls** - Backend handles this automatically
2. **Update dispute handling** - Backend automatically reverts chores
3. **Handle dynamic points** - UI should display current point values
4. **Use proper error handling** - Backend provides detailed error messages
5. **Update timestamp display** - All times are in Pacific timezone

---

