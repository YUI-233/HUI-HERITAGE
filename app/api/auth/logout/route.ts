import { clearSessionCookie } from "../../../../lib/local-auth";
import { usesCloudRuntime } from "../../../../lib/cloud-runtime";

export async function POST() {
  if (usesCloudRuntime()) {
    return Response.json(
      { signedOut: true, redirectTo: "/signout-with-chatgpt?return_to=/" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { signedOut: true, redirectTo: "/" },
    { headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } },
  );
}
