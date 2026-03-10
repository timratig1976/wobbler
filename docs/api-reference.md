# API Reference

Complete API documentation for all endpoints.

**⚠️ CUSTOMIZE THIS FILE WITH YOUR ACTUAL API ENDPOINTS**

---

## Base URL

```
Development: http://localhost:3000/api
Production:  https://your-domain.com/api
```

---

## Authentication

**⚠️ DESCRIBE YOUR AUTHENTICATION METHOD**

Example:
```bash
# Include API key in header
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.example.com/endpoint
```

---

## Endpoints

### Example Endpoint

```
POST /api/example
```

**Description:** What this endpoint does

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Request Body:**
```json
{
  "field1": "value",
  "field2": 123
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "field1": "value",
    "field2": 123
  }
}
```

**Error Responses:**

- **400 Bad Request**
  ```json
  {
    "success": false,
    "error": "Invalid input"
  }
  ```

- **401 Unauthorized**
  ```json
  {
    "success": false,
    "error": "Invalid API key"
  }
  ```

- **500 Internal Server Error**
  ```json
  {
    "success": false,
    "error": "Server error"
  }
  ```

**Example:**
```bash
curl -X POST https://api.example.com/api/example \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "field1": "value",
    "field2": 123
  }'
```

---

## Rate Limiting

**⚠️ DESCRIBE YOUR RATE LIMITS**

Example:
- 100 requests per minute per API key
- 1000 requests per hour per API key

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid API key |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Next Steps

- **[User Guide](user-guide.md)** - Feature documentation
- **[Architecture](architecture.md)** - Technical details
- **[Troubleshooting](troubleshooting.md)** - Common issues

---

**Remember:** Add new endpoints to this file as you build them. Don't create separate API docs.
