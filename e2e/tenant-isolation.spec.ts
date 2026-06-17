import { test, expect } from "@playwright/test";

async function loginAndGetToken(request: Parameters<typeof test>[0]["request"], email: string, password: string) {
  const response = await request.post("http://localhost:5000/api/v1/auth/login", {
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.data.tokens.accessToken as string;
}

test.describe("Tenant isolation", () => {
  test("second tenant cannot access first tenant client", async ({ request }) => {
    const adminToken = await loginAndGetToken(request, "admin@secritou.tn", "admin123");

    const createdClient = await request.post("http://localhost:5000/api/v1/clients", {
      data: {
        name: `E2E Client ${Date.now()}`,
        email: `e2e-${Date.now()}@example.tn`,
        phone: "+216 71 000 000",
      },
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(createdClient.ok()).toBeTruthy();
    const clientPayload = await createdClient.json();
    const clientId = clientPayload.data.id as string;

    const secondTenant = await request.post("http://localhost:5000/api/v1/auth/register", {
      data: {
        email: `tenant-${Date.now()}@example.com`,
        password: "Admin12345!",
        name: "Tenant Admin",
        companyName: "Tenant Two",
      },
    });
    expect(secondTenant.ok()).toBeTruthy();
    const secondBody = await secondTenant.json();
    const secondToken = secondBody.data.tokens.accessToken as string;

    const forbidden = await request.get(`http://localhost:5000/api/v1/clients/${clientId}`, {
      headers: {
        Authorization: `Bearer ${secondToken}`,
      },
    });

    expect(forbidden.status()).toBe(404);
  });
});
