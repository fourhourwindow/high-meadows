/**
 * Grants (or revokes) the "admin" custom claim on a Firebase Auth user.
 * This is the ONLY way to make someone an admin — there's no button for it
 * in the app itself, since custom claims can only be set with the Admin
 * SDK, never from client code (that's exactly what keeps a regular visitor
 * from granting themselves access).
 *
 * SETUP
 *   The user must already exist in Firebase Authentication before running
 *   this — create them first via Firebase console > Authentication > Add
 *   user (email + password), or have them sign up if you build that flow
 *   later. This script only sets the claim on an existing account.
 *
 * USAGE
 *   cd scripts
 *   GOOGLE_APPLICATION_CREDENTIALS=../secrets/google-application-creds.json \
 *     node setAdminClaim.js someone@example.com
 *
 *   To revoke admin access:
 *   GOOGLE_APPLICATION_CREDENTIALS=../secrets/google-application-creds.json \
 *     node setAdminClaim.js someone@example.com --revoke
 *
 * IMPORTANT: after running this, the user must sign OUT and back IN again
 * (or the app must force-refresh their ID token, which AuthContext.tsx
 * already does on every auth state change) for the new claim to actually
 * take effect — a claim change doesn't retroactively apply to a token
 * that's already been issued.
 */

const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");

  if (!email) {
    console.error("Usage: node setAdminClaim.js <email> [--revoke]");
    process.exit(1);
  }

  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: !revoke });

  console.log(
    revoke
      ? `Revoked admin access for ${email}`
      : `Granted admin access to ${email}`
  );
  console.log("They'll need to sign out and back in for this to take effect.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to update admin claim:", err);
  process.exit(1);
});
