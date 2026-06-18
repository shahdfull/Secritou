/**
 * Test: FormData Content-Type Fix
 * 
 * Verifies that when sending FormData via axios, the Content-Type header
 * is NOT set to application/json, allowing the browser to set the correct
 * multipart/form-data boundary.
 * 
 * This test can be run with: npm test axios.test.ts
 * (Requires a test runner setup in vite.config.ts or vitest.config.ts)
 */

import api from "./axios";
import type { InternalAxiosRequestConfig } from "axios";

// Mock test to verify the interceptor logic
export function testFormDataContentTypeRemoval() {
  // Create a FormData instance (as would be done in uploadApi.uploadFile)
  const formData = new FormData();
  formData.append("file", new File(["test"], "test.txt"));

  // Create a mock config as axios would
  const config: InternalAxiosRequestConfig = {
    url: "/upload/cv",
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer fake-token",
    },
    data: formData,
  } as InternalAxiosRequestConfig;

  // Get the request interceptor (first one)
  const interceptor = (api.interceptors.request as any).handlers?.[0];
  
  if (interceptor && typeof interceptor.fulfilled === "function") {
    // Run the interceptor
    const processedConfig = interceptor.fulfilled(config);
    
    // Verify Content-Type was removed
    const hasContentType = processedConfig.headers?.["Content-Type"];
    console.log("Content-Type after interceptor:", hasContentType);
    
    if (hasContentType) {
      console.error("❌ FAIL: Content-Type header still present. FormData upload will fail.");
      return false;
    }
    
    // Verify Authorization is still present
    const hasAuth = processedConfig.headers?.["Authorization"];
    if (!hasAuth) {
      console.error("❌ FAIL: Authorization header was removed.");
      return false;
    }
    
    console.log("✅ PASS: FormData request configured correctly.");
    return true;
  }

  console.error("Could not access request interceptor");
  return false;
}

// Test for JSON requests (should NOT have Content-Type removed)
export function testJSONContentTypePreserved() {
  const config: InternalAxiosRequestConfig = {
    url: "/auth/login",
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify({ email: "test@test.com", password: "pass" }),
  } as InternalAxiosRequestConfig;

  const interceptor = (api.interceptors.request as any).handlers?.[0];
  
  if (interceptor && typeof interceptor.fulfilled === "function") {
    const processedConfig = interceptor.fulfilled(config);
    
    // Content-Type should still be present for JSON
    const hasContentType = processedConfig.headers?.["Content-Type"];
    if (!hasContentType) {
      console.error("❌ FAIL: Content-Type was removed for JSON request.");
      return false;
    }
    
    console.log("✅ PASS: JSON request Content-Type preserved.");
    return true;
  }

  return false;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("\n=== FormData Content-Type Fix Tests ===\n");
  
  const test1 = testFormDataContentTypeRemoval();
  const test2 = testJSONContentTypePreserved();
  
  console.log("\n" + (test1 && test2 ? "✅ All tests passed!" : "❌ Some tests failed"));
  process.exit(test1 && test2 ? 0 : 1);
}
