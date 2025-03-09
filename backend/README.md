# EasePatent Backend API

A RESTful API for managing patents, documents, and user subscriptions.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/easepatent"
JWT_SECRET="your-secret-key"
PORT=4000
FRONTEND_URL="http://localhost:3000"
```

3. Run database migrations:
```bash
npx prisma migrate dev
```

4. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
  - Body: `{ email, password, firstName, lastName, plan }`

- `POST /api/auth/login` - Login user
  - Body: `{ email, password }`

- `GET /api/auth/me` - Get current user profile
  - Headers: `Authorization: Bearer <token>`

### Patents

- `GET /api/patents` - Get user's patents
  - Headers: `Authorization: Bearer <token>`

- `GET /api/patents/:id` - Get single patent
  - Headers: `Authorization: Bearer <token>`

- `POST /api/patents/search` - Search patents
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ query?, technicalField?, dateRange?, jurisdictions?, status?, sortBy?, page?, limit? }`

- `POST /api/patents` - Create patent
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ title, description, inventors, jurisdictions, technicalField?, backgroundArt?, claims? }`

- `PUT /api/patents/:id` - Update patent
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ title, description, inventors, jurisdictions, technicalField?, backgroundArt?, claims? }`

- `DELETE /api/patents/:id` - Delete patent
  - Headers: `Authorization: Bearer <token>`

- `PATCH /api/patents/:id/status` - Update patent status
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ status }`

- `POST /api/patents/:patentId/documents` - Upload document
  - Headers: `Authorization: Bearer <token>`
  - Body: `FormData with { file, name, type }`

- `DELETE /api/patents/:patentId/documents/:documentId` - Delete document
  - Headers: `Authorization: Bearer <token>`

- `GET /api/patents/:id/similar` - Get similar patents
  - Headers: `Authorization: Bearer <token>`

- `GET /api/patents/:id/analysis` - Get AI analysis
  - Headers: `Authorization: Bearer <token>`

- `POST /api/patents/:id/search-report` - Generate search report
  - Headers: `Authorization: Bearer <token>`

### Subscriptions

- `POST /api/subscriptions` - Create subscription
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ plan }`

- `GET /api/subscriptions/active` - Get user's active subscription
  - Headers: `Authorization: Bearer <token>`

- `POST /api/subscriptions/cancel` - Cancel subscription
  - Headers: `Authorization: Bearer <token>`

## Error Handling

All endpoints return errors in the following format:
```json
{
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE"
  }
}
```

Common error codes:
- `NOT_AUTHENTICATED` - User is not logged in
- `NOT_AUTHORIZED` - User doesn't have permission
- `INVALID_CREDENTIALS` - Wrong email/password
- `EMAIL_EXISTS` - Email already registered
- `USER_NOT_FOUND` - User not found
- `PATENT_NOT_FOUND` - Patent not found
- `DOCUMENT_NOT_FOUND` - Document not found
- `NO_ACTIVE_SUBSCRIPTION` - No active subscription found

## File Upload

Documents are stored in the `uploads` directory and served at `/uploads/:filename`. The upload endpoint accepts multipart form data with the following fields:
- `file` - The file to upload
- `name` - Document name
- `type` - Document type

## Development

1. Run tests:
```bash
npm test
```

2. Run linter:
```bash
npm run lint
```

3. Build for production:
```bash
npm run build
``` 