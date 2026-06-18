# Testing Upload Error Fixes

## Quick Start

### Prerequisites
- Backend running: `cd server && npm run dev`
- Frontend running: `cd client && npm run dev`
- Browser dev tools open (F12)

---

## Test Case 1: Wrong MIME Type (415)

**Goal**: Verify user sees "File type not allowed" instead of "Request failed with status code 415"

### Steps
1. Navigate to `http://localhost:5173/rejoindre`
2. In file upload field, select a **.doc** or **.jpg** file (NOT PDF)
3. Observe:
   - ✅ Toast appears with message: `"File type 'application/...' not allowed. Accepted: application/pdf"`
   - ✅ Network tab shows 415 response with **JSON** body (not HTML)
   - ✅ Server console shows `[Upload Error] File type...` log
   - ✅ No console errors

### Expected Response
```json
{
  "error": {
    "code": "HTTP_415",
    "message": "File type \"application/vnd.openxmlformats-officedocument.wordprocessingml.document\" not allowed. Accepted: application/pdf"
  },
  "message": "File type \"application/vnd.openxmlformats-officedocument.wordprocessingml.document\" not allowed. Accepted: application/pdf"
}
```

### ❌ Failures to Watch For
- Toast shows: "Request failed with status code 415" → Message extraction failed
- Network response is HTML → Error middleware not catching error
- Console shows HTML parse error → Axios can't handle response

---

## Test Case 2: File Too Large (413)

**Goal**: Verify user sees "File exceeds maximum size limit" instead of "Request failed with status code 413"

### Prerequisites
Create a test file > 20MB. Options:
```bash
# Create 25MB dummy file (Linux/Mac)
dd if=/dev/zero of=test-large.pdf bs=1M count=25

# Or create via Node.js
node -e "require('fs').writeFileSync('test-large.pdf', Buffer.alloc(25*1024*1024))"
```

### Steps
1. Navigate to `http://localhost:5173/rejoindre`
2. Upload the 25MB file
3. Observe:
   - ✅ Toast appears with: `"File exceeds maximum size limit"`
   - ✅ Network tab shows 413 response with **JSON** body
   - ✅ Server console shows `[Upload] Starting upload...` then `[Upload Error]...`
   - ✅ No console errors

### Expected Response
```json
{
  "error": {
    "code": "MULTER_LIMIT_FILE_SIZE",
    "message": "File exceeds maximum size limit"
  },
  "message": "File exceeds maximum size limit"
}
```

### ❌ Failures to Watch For
- Toast shows generic message → Message extraction failed
- Network shows HTML response → Error middleware issue
- No server logs → Error not reaching middleware

---

## Test Case 3: Valid PDF Upload (Success)

**Goal**: Verify successful uploads still work after changes

### Prerequisites
- Have a valid PDF file < 20MB

### Steps
1. Navigate to `http://localhost:5173/rejoindre`
2. Upload valid PDF
3. Observe:
   - ✅ Toast appears: "Success" or file name
   - ✅ File preview appears in field
   - ✅ Network shows 201 response with upload metadata
   - ✅ Server console shows `[Upload] S3 upload successful { key: '...' }`
   - ✅ No error toasts

### Expected Response
```json
{
  "data": {
    "key": "cv/a1b2c3d4-e5f6.pdf",
    "url": "https://signed-url...",
    "originalName": "resume.pdf",
    "mimeType": "application/pdf",
    "size": 102400
  }
}
```

### ❌ Failures to Watch For
- Upload fails when it should succeed → Logic regression
- File doesn't appear in field → Frontend state issue
- No 201 response → Backend issue
- S3 error in logs → Credentials/bucket issue

---

## Test Case 4: Portfolio Context (ZIP + PDF)

**Goal**: Verify other upload contexts still work correctly

### Steps
1. Find a form with portfolio upload (e.g., freelancer profile if accessible)
2. Test upload of:
   - ✅ Valid PDF
   - ✅ Valid ZIP
   - ❌ .doc file (should fail with 415)
   - ❌ 25MB file (should fail with 413)

### Expected Behavior
- PDF + ZIP upload successfully
- .doc + large files show appropriate error toasts

---

## Test Case 5: Document Context

**Goal**: Verify document uploads accept broader MIME types

### Allowed MIME Types
- PDF
- Word (.doc, .docx)
- Excel (.xls, .xlsx)
- Images (JPEG, PNG)
- Text (.txt)

### Steps
1. Upload to document context:
   - ✅ PDF (should succeed)
   - ✅ .docx (should succeed)
   - ✅ .xlsx (should succeed)
   - ✅ .jpg (should succeed)
   - ❌ .zip (should fail with 415)

### Expected Error Message
```
"File type 'application/zip' not allowed. Accepted: application/pdf, application/msword, ..."
```

---

## Test Case 6: Image Context

**Goal**: Verify image uploads only accept images

### Allowed MIME Types
- JPEG
- PNG
- WebP
- GIF

### Steps
1. Upload to image context:
   - ✅ .jpg (should succeed)
   - ✅ .png (should succeed)
   - ❌ .pdf (should fail with 415)
   - ❌ .doc (should fail with 415)

---

## Network Tab Verification

### For All Error Cases (413, 415, etc.)

**Check**: Response Tab
- **Status**: Should be 413, 415, etc. (NOT 200)
- **Content-Type**: `application/json` (NOT `text/html`)
- **Body**: Valid JSON with `message` field

**Check**: Preview Tab
- Should show JSON object
- Should have `message` property
- Should NOT show HTML error page

### ❌ Red Flags
- Response shows HTML: `<!DOCTYPE html>...` → Error middleware failed
- Content-Type is `text/html` → Server returned default error page
- 500 status instead of 413/415 → Error not caught correctly

---

## Console Verification

### Server Console
Should show logs for any upload attempt:

```
[Upload] Starting upload { originalName: 'resume.pdf', mimeType: 'application/pdf', size: 102400, context: 'cv', bucketConfigured: true }
[Upload] Sending to S3 { bucket: 'my-bucket', key: 'cv/uuid.pdf', contentType: 'application/pdf', bufferSize: 102400 }
[Upload] S3 upload successful { key: 'cv/uuid.pdf' }
[Upload] Complete { key: '...', url: 'https://...' }
```

OR for errors:

```
[Upload] Starting upload { originalName: 'bad.doc', ... }
[Upload Error] File type "application/msword" not allowed. Accepted: application/pdf
```

### Browser Console
- ✅ No "Uncaught" errors
- ✅ No "Failed to parse" errors
- ✅ No Network errors in red

---

## Checklist Summary

### Bug #1 Fix (Server Error Middleware)
- [ ] 415 errors return JSON (not HTML)
- [ ] 413 errors return JSON (not HTML)
- [ ] Error response has `message` field
- [ ] Error response has `error.code` field
- [ ] Status code is correct (413, 415)

### Bug #2 Fix (Client Message Extraction)
- [ ] Toast shows server message (not generic "Request failed")
- [ ] Message extraction works for `error.response.data.message`
- [ ] Message extraction works for `error.response.data.error.message`
- [ ] Success paths unaffected
- [ ] 401 retry logic still works

### No Regressions
- [ ] Valid uploads still work
- [ ] All 4 contexts (cv, portfolio, document, image) work
- [ ] MIME type restrictions enforced
- [ ] File size limits enforced
- [ ] No console errors on success
- [ ] No console errors on validation failures

---

## Troubleshooting

### Issue: Still Seeing "Request failed with status code XXX"
**Check**:
1. Did you restart frontend? `npm run dev`
2. Did you reload browser (not just browser refresh)? Ctrl+Shift+Del to clear cache
3. Check Network tab: Does response body have `message` field?

### Issue: Still Seeing HTML Error Page
**Check**:
1. Did you restart backend? `npm run dev`
2. Check server console for logs: Do you see `[Upload Error]...`?
3. Server file: Is `multer.MulterError` check present (line 9-34)?
4. Server file: Is statusCode check present (line 36-51)?

### Issue: Upload Succeeds But File Not Visible
**Check**:
1. Server logs: Did S3 upload succeed? Look for `[Upload] S3 upload successful`
2. Network tab: Does response have `data.key` and `data.url`?
3. Frontend state: Check useUpload hook - is `result` being set?
4. S3 bucket: Check AWS console for file in `cv/` folder

### Issue: All Uploads Fail (Even Valid PDFs)
**Check**:
1. Backend running? `npm run dev` in server/ directory
2. S3 configured? Check server logs for `[S3 Config] { bucket: '...'}`
3. Frontend connected? Check Network tab - is POST happening?
4. CORS? Check browser console for CORS errors

---

## Success Criteria

### All Tests Pass When
- ✅ Valid PDF uploads succeed (201)
- ✅ Wrong MIME types fail with "File type not allowed" toast (415)
- ✅ Oversized files fail with "File exceeds maximum size limit" toast (413)
- ✅ All 4 contexts enforce their MIME restrictions
- ✅ Network responses are JSON (not HTML)
- ✅ No console errors
- ✅ Server logs show clear flow of upload attempts

### Fixes Are Complete When
- ✅ Bug #1: Multer errors return JSON from error middleware
- ✅ Bug #2: Real server message extracted and shown in toast
- ✅ No regressions in upload happy path
- ✅ All 4 upload contexts work correctly

---

**Status**: Ready to test
