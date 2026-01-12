import { checkAuth } from "./src/agents/auth.js";

async function verifyAuthFix() {
  console.log("Verifying auth fix...");

  const auth = await checkAuth();

  if (auth.isAuthenticated) {
    console.log("Authentication SUCCESS!");
    console.log("User:", JSON.stringify(auth.user, null, 2));
  } else {
    console.log("Authentication FAILED.");
    console.log("Error:", auth.error);
    console.log("Cookies present:", !!auth.cookies);
  }
}

verifyAuthFix();
