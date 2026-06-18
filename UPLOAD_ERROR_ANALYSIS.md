# Upload CV Error 500 - Complete Analysis & Fix

## Executive Summary

**Root Cause**: S3 environment variables are completely missing in `server/.env`

**CRITICAL MISMATCH**: 
- `.env.example` defines: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`
- Code (`upload.service.ts`) reads: `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_BUCKET`
- Result: `S3_BUCKET` = undefined → HTTP 500 error

---

## Complete Upload Flow Analysis

### Frontend (React)
**File**: `client/src/api/upload.api.ts:19-26`
```typescript
const formData = new FormData();
formData.append("file", file);
const response = await apiClient.post<{ data: UploadResult }>(
  `/upload/${context}`,  // context = "cv"
  formData
);
```

### Backend Route
**File**: `server/src/routes/upload.routes.ts:15-23`
- Applies `contactRateLimit` middleware (public endpoint for CV)
- Calls `uploadFile` controller handlers

### Backend Controller
**File**: `server/src/controllers/upload.controller.ts:13-49`
- **Line 23**: Creates multer middleware via `createUploadMiddleware("cv", "file")`
- **Line 36-42**: Calls `uploadService.upload()`
- **Line 45-47**: Catches errors and passes to error middleware

### Backend Middleware (Multer)
**File**: `server/src/middlewares/upload.middleware.ts`
- Uses memory storage (streams directly to S3)
- Validates MIME type for context (CV only allows PDF)
- **Line 34**: Limits file size to `UPLOAD_MAX_BYTES`

### Backend Service (S3 Upload)
**File**: `server/src/services/upload.service.ts:141-181`
- **Line 149**: CHECK: `if (!BUCKET) → throws 500`
- **Line 153**: Validates MIME type
- **Line 156**: Generates S3 key
- **Line 161-174**: Sends to S3 via AWS SDK

### Environment Variables (THE PROBLEM)
**File**: `server/src/services/upload.service.ts:16-21`
```typescript
const REGION = process.env.S3_REGION ?? "us-east-1";
const BUCKET = process.env.S3_BUCKET ?? "";  // ← UNDEFINED = ""
const ENDPOINT = process.env.S3_ENDPOINT;
const PUBLIC_URL_BASE = process.env.S3_PUBLIC_URL;

const MAX_FILE_SIZE = Number(process.env.UPLOAD_MAX_BYTES ?? 20 * 1024 * 1024);
```

**Credentials** (line 68-72):
```typescript
if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
  cfg.credentials = {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  };
}
```

---

## Variable Mismatch Comparison

| `.env.example` | `upload.service.ts` | Current `.env` | Status |
|---|---|---|---|
| `AWS_ACCESS_KEY_ID` | `S3_ACCESS_KEY_ID` | ❌ Missing | MISMATCH |
| `AWS_SECRET_ACCESS_KEY` | `S3_SECRET_ACCESS_KEY` | ❌ Missing | MISMATCH |
| `AWS_REGION` | `S3_REGION` | ❌ Missing | MISMATCH |
| `AWS_S3_BUCKET` | `S3_BUCKET` | ❌ Missing | MISMATCH |
| N/A | `S3_ENDPOINT` | ❌ Missing | Missing |
| N/A | `S3_PUBLIC_URL` | ❌ Missing | Missing |
| N/A | `S3_PUBLIC_ACL` | ❌ Missing | Missing |
| N/A | `UPLOAD_MAX_BYTES` | ❌ Missing | Missing |

---

## Error Flow

1. Frontend sends `POST /upload/cv` with PDF file
2. Backend route passes to controller
3. Multer extracts file, calls service
4. Service checks: `if (!BUCKET)` → TRUE (BUCKET = "")
5. Throws: `"Error: S3_BUCKET is not configured"`
6. Controller catches (line 45-46): `next(err)`
7. Error middleware (line 31): `console.error(error)` → logs to console
8. Response: HTTP 500 generic error (error details only in server logs)

**Result**: User sees "Internal server error" but doesn't know the real issue is missing S3 config.

---

## Solution 1: Add Missing Variables to `.env` (RECOMMENDED)

**File**: `server/.env`

Add these lines:
```
# S3 Upload Configuration
S3_ACCESS_KEY_ID=your-access-key-here
S3_SECRET_ACCESS_KEY=your-secret-key-here
S3_REGION=us-east-1
S3_BUCKET=your-bucket-name-here
S3_ENDPOINT=
S3_PUBLIC_URL=
S3_PUBLIC_ACL=false
UPLOAD_MAX_BYTES=20971520
```

**Next steps**:
1. Restart server: `npm run dev` (from `server/` directory)
2. Check server logs for `[S3 Config]` messages
3. Try uploading CV from `/rejoindre` form
4. Watch server console for `[Upload]` logs

---

## Solution 2: Normalize All Variable Names to `S3_*` (BEST PRACTICE)

If you want to standardize on `S3_*` naming everywhere:

### Step 1: Update `.env.example`
**File**: `server/.env.example`

Replace lines 10-13:
```
# OLD
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=

# NEW
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_REGION=us-east-1
S3_BUCKET=
S3_ENDPOINT=
S3_PUBLIC_URL=
S3_PUBLIC_ACL=false
UPLOAD_MAX_BYTES=20971520
```

### Step 2: Update your `.env`
Same as Solution 1 above.

### Step 3: Code is already correct ✅
No changes needed — `upload.service.ts` already uses `S3_*` names.

---

## Solution 3: Fix Code to Use `AWS_*` Names (NOT RECOMMENDED)

Only use this if you must match the `.env.example` naming.

**File**: `server/src/services/upload.service.ts`

Replace lines 16-21:
```typescript
// OLD
const REGION = process.env.S3_REGION ?? "us-east-1";
const BUCKET = process.env.S3_BUCKET ?? "";
const ENDPOINT = process.env.S3_ENDPOINT;
const PUBLIC_URL_BASE = process.env.S3_PUBLIC_URL;
const MAX_FILE_SIZE = Number(process.env.UPLOAD_MAX_BYTES ?? 20 * 1024 * 1024);

// NEW
const REGION = process.env.AWS_REGION ?? "us-east-1";
const BUCKET = process.env.AWS_S3_BUCKET ?? "";
const ENDPOINT = process.env.S3_ENDPOINT;
const PUBLIC_URL_BASE = process.env.S3_PUBLIC_URL;
const MAX_FILE_SIZE = Number(process.env.UPLOAD_MAX_BYTES ?? 20 * 1024 * 1024);
```

Replace lines 68-73:
```typescript
// OLD
if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
  cfg.credentials = {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  };
}

// NEW
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  cfg.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}
```

Then add the AWS variables to `.env`:
```
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

---

## Debugging Logs Added

I've added detailed logging to `upload.service.ts` to help diagnose issues:

### On server startup (buildS3Client):
```
[S3 Config] { region: 'us-east-1', bucket: 'NOT_SET', endpoint: 'NOT_SET', ... }
```

### On upload attempt (uploadFile):
```
[Upload] Starting upload { originalName: 'resume.pdf', mimeType: 'application/pdf', size: 102400, context: 'cv', bucketConfigured: false }
[Upload Error] S3_BUCKET is not configured. Set S3_BUCKET env var.
```

### On successful upload:
```
[Upload] Starting upload { originalName: 'resume.pdf', ... bucketConfigured: true }
[S3 Config] { region: 'us-east-1', bucket: 'my-bucket', ... }
[Upload] Sending to S3 { bucket: 'my-bucket', key: 'cv/a1b2c3d4-e5f6.pdf', contentType: 'application/pdf', bufferSize: 102400 }
[Upload] S3 upload successful { key: 'cv/a1b2c3d4-e5f6.pdf' }
[Upload] Complete { key: '...', url: 'https://...' }
```

---

## Troubleshooting Checklist

- [ ] Restart server after adding env variables
- [ ] Check server console for `[S3 Config]` logs at startup
- [ ] Verify AWS credentials are valid (check IAM console)
- [ ] Verify bucket name is exactly correct (case-sensitive)
- [ ] Verify bucket exists and is in the specified region
- [ ] Check S3 bucket policy allows PutObject from your credentials
- [ ] Check S3 bucket CORS if uploading from browser
- [ ] Verify IAM user has `s3:PutObject`, `s3:GetObject` permissions

---

## Summary

| Aspect | Finding | Action |
|---|---|---|
| **Root Cause** | S3 variables missing from `.env` | Add variables OR update code |
| **Primary Issue** | Name mismatch: `AWS_*` vs `S3_*` | Choose one convention, apply everywhere |
| **Logs Added** | Detailed S3 upload tracing | Will show exact failure point |
| **Data Loss Risk** | None — just config issue | Safe to fix anytime |
| **Recommended Fix** | Solution 1 (add vars to .env) | Simplest, no code changes |
| **Best Practice** | Solution 2 (standardize S3_*) | Cleaner, more maintainable |

---

## Next Steps

1. **Immediate**: Add S3 variables to `server/.env` (Solution 1)
2. **Then**: Restart server and test upload
3. **Optional**: Standardize naming (Solution 2) for consistency
4. **Monitor**: Check server logs for `[Upload]` messages during testing
