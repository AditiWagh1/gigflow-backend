# GigFlow Backend API

Smart Leads Dashboard — Node.js + Express + TypeScript + MongoDB

---

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript (strict mode)
- **Database**: MongoDB + Mongoose
- **Auth**: JWT + bcryptjs
- **Validation**: express-validator
- **Containerization**: Docker + Docker Compose

---

## Project Structure

```
src/
├── controllers/
│   ├── auth.controller.ts      # register, login, getMe
│   └── leads.controller.ts     # CRUD + CSV export + stats
├── middleware/
│   ├── auth.ts                 # JWT authenticate + requireRole guard
│   ├── validate.ts             # express-validator rules
│   └── errorHandler.ts         # global error + 404 handler
├── models/
│   ├── User.ts                 # User schema with bcrypt hook
│   └── Lead.ts                 # Lead schema with indexes
├── routes/
│   ├── auth.routes.ts
│   └── leads.routes.ts
├── types/
│   └── index.ts                # All interfaces/enums
├── utils/
│   ├── db.ts                   # MongoDB connection
│   ├── jwt.ts                  # generate + verify token
│   └── response.ts             # standardized API response helpers
└── index.ts                    # Express app + server bootstrap
```

---

## Setup

### Local development

```bash
# 1. Clone and install
npm install

# 2. Copy and fill environment variables
cp .env.example .env

# 3. Run in dev mode (ts-node + nodemon)
npm run dev
```

### With Docker

```bash
# Start MongoDB + Backend together
docker-compose up --build

# Stop
docker-compose down
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | — |
| `JWT_SECRET` | Secret for signing JWTs | — |
| `JWT_EXPIRES_IN` | Token expiry duration | `7d` |
| `NODE_ENV` | Environment | `development` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3000` |
| `ALLOW_ADMIN_REGISTER` | Allow admin role on register | `false` |

---

## API Reference

Base URL: `http://localhost:5000/api`

All protected routes require header:
```
Authorization: Bearer <token>
```

---

### Auth

#### POST /auth/register
```json
{
  "name": "Rahul Sharma",
  "email": "rahul@company.io",
  "password": "secret123"
}
```
Response `201`:
```json
{
  "success": true,
  "data": {
    "token": "eyJ...",
    "user": { "_id": "...", "name": "Rahul Sharma", "email": "...", "role": "sales" }
  }
}
```

#### POST /auth/login
```json
{ "email": "rahul@company.io", "password": "secret123" }
```

#### GET /auth/me  🔒
Returns the currently logged-in user.

---

### Leads

#### GET /leads  🔒
Query params (all optional):

| Param | Type | Example |
|---|---|---|
| `page` | number | `1` |
| `limit` | number | `10` |
| `status` | enum | `New`, `Contacted`, `Qualified`, `Lost` |
| `source` | enum | `Website`, `Instagram`, `Referral` |
| `search` | string | `Rahul` |
| `sort` | string | `latest` or `oldest` |

Example: `GET /leads?status=Qualified&source=Instagram&search=Rahul&sort=latest&page=1`

Response:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

#### POST /leads  🔒
```json
{
  "name": "Priya Patel",
  "email": "priya@startup.in",
  "status": "New",
  "source": "Instagram",
  "notes": "Interested in enterprise plan."
}
```

#### GET /leads/:id  🔒
Returns a single lead. Sales users can only access their own.

#### PUT /leads/:id  🔒
Same body shape as POST, all fields optional.

#### DELETE /leads/:id  🔒 Admin only
```json
{ "success": true, "data": { "id": "..." } }
```

#### GET /leads/stats  🔒
```json
{
  "data": {
    "total": 40,
    "byStatus": { "New": 12, "Contacted": 10, "Qualified": 8, "Lost": 10 },
    "bySource": { "Website": 15, "Instagram": 14, "Referral": 11 }
  }
}
```

#### GET /leads/export/csv  🔒
Streams a CSV file download. Respects same filter params as GET /leads.

---

## Role-Based Access

| Action | Admin | Sales |
|---|---|---|
| View leads | All leads | Own leads only |
| Create lead | ✅ | ✅ |
| Update lead | Any lead | Own leads only |
| Delete lead | ✅ | ❌ |
| Export CSV | ✅ | ✅ (own only) |
| View stats | ✅ | ✅ (own only) |

---

## Error Response Format

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "optional technical detail (dev mode only)"
}
```

Common status codes: `200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`, `500`
