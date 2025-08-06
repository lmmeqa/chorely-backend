### Chorely API (v1) – Developer Guide

All endpoints are JSON-only and follow REST conventions.

| Resource | Base URL  |
| -------- | --------- |
| Users    | `/users`  |
| Homes    | `/homes`  |
| Chores   | `/chores` |

> **Auth** – no authentication layer is included in the demo.
> **Errors** – every error is returned as<br>`{ "error": "<message>" }` with an appropriate HTTP status.
> **Body format** – `Content-Type: application/json`.

---

## 1 · Users

| Verb     | Endpoint              | Description                                 | Body / Query                                        | Success ⇢                   |
| -------- | --------------------- | ------------------------------------------- | --------------------------------------------------- | --------------------------- |
| **POST** | `/users`              | Create a user and link to ≥ 1 home          | `{ "email": "me@x.com", "homeIds": ["home-uuid"] }` | **201** Created → `UserRow` |
| **POST** | `/users/login`        | Look up a user by email (very thin “login”) | `{ "email": "me@x.com" }`                           | **200** → `UserRow`         |
| **GET**  | `/users/:email/homes` | List all homes this user belongs to         | —                                                   | **200** → `HomeRow[]`       |
| **POST** | `/users/join`         | Add user to an existing home                | `{ "email": "me@x.com", "homeId": "home-uuid" }`    | **204** No Content          |

*Errors*

* `409 Conflict` – email already registered
* `404` – user or home not found
* `400` – user would become orphaned (when leaving homes)

---

## 2 · Homes

| Verb     | Endpoint     | Description        | Body                                             | Success ⇢             |
| -------- | ------------ | ------------------ | ------------------------------------------------ | --------------------- |
| **POST** | `/homes`     | Create a new home  | `{ "name": "Summer Cabin", "address": "Lake…" }` | **201** → `HomeRow`   |
| **GET**  | `/homes`     | List all homes     | —                                                | **200** → `HomeRow[]` |
| **GET**  | `/homes/:id` | Get one home by id | —                                                | **200** → `HomeRow`   |

---

## 3 · Chores

`ChoreStatus = "unapproved" | "unclaimed" | "claimed" | "complete"`

| Verb      | Endpoint                     | Description                          | Body / Query                                 | Success ⇢              |
| --------- | ---------------------------- | ------------------------------------ | -------------------------------------------- | ---------------------- |
| **POST**  | `/chores`                    | Create a chore (starts *unapproved*) | `{ name, description, time, icon, home_id }` | **201** → `ChoreRow`   |
| **GET**   | `/chores/available/:homeId`  | Unclaimed chores for a home          | —                                            | **200** → `ChoreRow[]` |
| **GET**   | `/chores/unapproved/:homeId` | Chores awaiting approval             | —                                            | **200** → `ChoreRow[]` |
| **GET**   | `/chores/user/:email`        | Chores for a user                    | `?status=claimed,complete` *(optional CSV)*  | **200** → `ChoreRow[]` |
| **PATCH** | `/chores/:uuid/approve`      | Approve → status = *unclaimed*       | —                                            | **204**                |
| **PATCH** | `/chores/:uuid/claim`        | Claim a chore                        | `{ "email": "me@x.com" }`                    | **204**                |
| **PATCH** | `/chores/:uuid/complete`     | Mark complete                        | —                                            | **204**                |
| **PATCH** | `/chores/:uuid/verify`       | Verify (same as complete)            | —                                            | **204**                |

*Errors*

* `400` – FK violation (bad `home_id` / user not in home)
* `409` – attempting to claim an already-claimed chore
* `404` – unknown chore UUID

---

## 4 · Row Shapes

```ts
// UserRow
{
  id:        string, // UUID
  email:     string,
  created_at: string,  // ISO-8601
  updated_at: string
}

// HomeRow
{
  id:      string,
  name:    string,
  address: string
}

// ChoreRow
{
  uuid:        string,
  name:        string,
  description: string,
  time:        string,
  icon:        string,
  status:      "unapproved" | "unclaimed" | "claimed" | "complete",
  user_id:     string | null,
  home_id:     string,
  created_at:  string,
  updated_at:  string
}
```

---

## 5 · Common SQLSTATE → HTTP Mapping

| SQLSTATE | Meaning                            | HTTP    | API message                |
| -------- | ---------------------------------- | ------- | -------------------------- |
| `23505`  | unique violation (duplicate email) | **409** | “Resource already exists”  |
| `23503`  | FK violation (bad home/user)       | **400** | “Related record not found” |

---

## 6 · Run Locally

```bash
docker compose up --build           # hot-reload backend
```

* Changes to `src/**` auto-restart (`ts-node-dev`).
* On every container boot the script unlocks, rolls back, migrates & seeds demo data.
* API served at **[http://localhost:4000](http://localhost:4000)**

---

Happy hacking!
