# Sweet-Cookie Chrome Beta v20 Compatibility Fix - Handover

## TL;DR

**Problem**: `@steipete/sweet-cookie` (v0.2.0) fails to decrypt cookies from Chrome Beta on Windows. This blocks `whcli` CLI authentication.

**Root Cause**: Chrome Beta (v127+) uses `v20` cookie encryption format. Sweet-cookie treats all `v10/v11/v20` prefixes identically, but v20 likely has a different layout.

**Status**: No existing issue or PR on sweet-cookie repo. You will be the first to report this.

---

## First Steps

### 1. Create GitHub Issue

```bash
gh issue create -R steipete/sweet-cookie \
  --title "Bug: Chrome v20 (v127+) cookie decryption fails on Windows" \
  --body "## Problem

Chrome Beta (v127+) uses \`v20\` cookie encryption format. Decryption fails with \`Unsupported state or unable to authenticate data\`.

## Environment
- Windows 11
- Chrome Beta (v127+)
- Node.js v22.15.0
- sweet-cookie v0.2.0

## Findings
- Master key recovery via DPAPI works ✅
- AES-256-GCM decryption with standard v11 layout fails ❌
- v20 format likely has different nonce/ciphertext/auth-tag layout

## Reproduction
1. Close Chrome Beta
2. Run sweet-cookie with Chrome Beta profile path
3. Any cookie with \`encrypted_value\` starting with \`v20\` prefix fails to decrypt

## Cookie DB Path
\`\`\`
%LOCALAPPDATA%\\Google\\Chrome Beta\\User Data\\Default\\Network\\Cookies
\`\`\`

## Local State (Master Key)
\`\`\`
%LOCALAPPDATA%\\Google\\Chrome Beta\\User Data\\Local State
\`\`\`

## Expected Behavior
Cookies with v20 prefix should decrypt successfully.

## Actual Behavior
Decryption returns \`null\` (caught exception in AES-256-GCM decipher)."
```

### 2. Fork and Clone

```bash
# Fork via GitHub UI or:
gh repo fork steipete/sweet-cookie --clone

cd sweet-cookie
pnpm install
```

---

## Technical Details

### Cookie Encryption Versions

| Prefix | Chrome Version | Algorithm | Status |
|--------|----------------|-----------|--------|
| `v10` | < 80 | AES-128-CBC | ✅ Works |
| `v11` | >= 80 | AES-256-GCM | ✅ Works |
| `v20` | >= 127 | AES-256-GCM (modified) | ❌ Broken |

### Current sweet-cookie Code (Problem)

File: `packages/core/src/providers/chromeSqlite/crypto.ts`

```typescript
export function decryptChromiumAes256GcmCookieValue(
  encryptedValue: Uint8Array,
  key: Buffer,
  options: { stripHashPrefix: boolean },
): string | null {
  const buf = Buffer.from(encryptedValue);
  const prefix = buf.subarray(0, 3).toString("utf8");
  if (!/^v\d\d$/.test(prefix)) {
    return null;
  }

  // PROBLEM: Same layout assumed for ALL versions (v10, v11, v20)
  const payload = buf.subarray(3);
  const nonce = payload.subarray(0, 12);           // 12-byte nonce
  const authenticationTag = payload.subarray(payload.length - 16);  // 16-byte tag
  const ciphertext = payload.subarray(12, payload.length - 16);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAuthTag(authenticationTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decodeCookieValueBytes(plaintext, options.stripHashPrefix);
  } catch {
    return null;  // <-- v20 fails here
  }
}
```

### What We Know Works

1. **Master Key Recovery** ✅
   ```typescript
   // Local State JSON contains encrypted master key
   const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
   const encryptedKey = Buffer.from(localState.os_crypt.encrypted_key, 'base64');
   const keyToDecrypt = encryptedKey.subarray(5); // Skip "DPAPI" prefix

   // DPAPI decrypt via PowerShell
   const psScript = `
     Add-Type -AssemblyName System.Security
     $bytes = [Convert]::FromBase64String("${keyToDecrypt.toString('base64')}")
     $decrypted = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
     [Convert]::ToBase64String($decrypted)
   `;
   // Result: 32-byte AES-256 master key
   ```

2. **Cookie Database Access** ✅
   - 22 willhaben.at cookies exist
   - SQLite read works (after BigInt patch)
   - `encrypted_value` column contains v20-prefixed data

### What Fails

```typescript
// Test decryption with recovered master key
const encrypted = Buffer.from(cookieRow.encrypted_value);
// encrypted[0:3] = "v20"
// encrypted.length = 109

const payload = encrypted.subarray(3);  // 106 bytes
const nonce = payload.subarray(0, 12);
const authTag = payload.subarray(payload.length - 16);
const ciphertext = payload.subarray(12, payload.length - 16);

const decipher = createDecipheriv('aes-256-gcm', masterKey, nonce);
decipher.setAuthTag(authTag);
const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
// Error: Unsupported state or unable to authenticate data
```

---

## Hypotheses to Investigate

### Hypothesis 1: Different Nonce Length

v20 might use a different nonce size (8 bytes? 16 bytes?).

**Test**: Try different nonce offsets in the payload.

### Hypothesis 2: AAD (Additional Authenticated Data)

v20 might require AAD parameter for GCM decryption.

```typescript
// Chromium might use domain or cookie name as AAD
decipher.setAAD(Buffer.from('chromium', 'utf8'));
// or
decipher.setAAD(Buffer.from(host_key, 'utf8'));
```

**Reference**: Chromium OSCrypt uses labeled encryption.

### Hypothesis 3: Key Derivation

v20 might derive per-cookie keys using HKDF instead of using master key directly.

```typescript
// Possible HKDF with cookie-specific info
const derivedKey = hkdfSha256(masterKey, nonce, 'cookie encryption');
```

### Hypothesis 4: Different Layout

v20 might have additional metadata between prefix and payload.

```
v10/v11: [v11][12-byte nonce][ciphertext][16-byte tag]
v20:     [v20][???][12-byte nonce][ciphertext][16-byte tag]
```

---

## Chromium Source References

- **OSCrypt Windows**: `components/os_crypt/sync/os_crypt_win.cc`
- **Encryption Key**: `components/os_crypt/sync/encryption_key_win.cc`
- **Crypto Utilities**: `crypto/apple_keychain.cc` (macOS reference)

Search for:
- `kEncryptionVersion`
- `EncryptString`
- `DecryptString`
- `v20` or `V20`

---

## Patch Already Applied

A local patch was applied to fix BigInt handling:

**File**: `node_modules/@steipete/sweet-cookie/dist/providers/chromeSqlite/shared.js`

```javascript
// Line ~211: Changed from
const needsTextExpires = sqliteKind === "node" && !supportsReadBigInts();

// To
const needsTextExpires = sqliteKind === "node"; // Patched: always use text for Node
```

This should be included in any PR (or verify it's already fixed in v0.2.0).

---

## Validation Steps

After fixing, test with:

```bash
# In willhaben-agent project
cd C:\Users\Hans\code\willhaben-agent

# Test auth
npm start -- auth
# Expected: { authenticated: true, user: { name: "...", email: "..." } }

# Test chats
npm start -- chats
# Expected: { total: 43, conversations: [...] }

# Test messaging
npm start -- message 1984083257 "Test message"
# Expected: { success: true, message: "Message sent successfully!" }
```

---

## Sweet-Cookie Repo Structure

```
sweet-cookie/
├── packages/
│   └── core/
│       └── src/
│           └── providers/
│               └── chromeSqlite/
│                   ├── crypto.ts      # <-- Main file to fix
│                   ├── shared.ts      # DB query logic
│                   └── windowsDpapi.ts
├── apps/
│   └── ... (example apps)
└── package.json
```

---

## Acceptance Criteria

1. [ ] GitHub issue created on steipete/sweet-cookie
2. [ ] Fork created with fix branch
3. [ ] v20 cookies decrypt successfully on Windows
4. [ ] Test with Chrome Beta and regular Chrome (both v127+)
5. [ ] PR submitted with:
   - Clear description of v20 format
   - Reference to Chromium source
   - Test case if possible
6. [ ] `whcli auth` returns authenticated user
7. [ ] `whcli chats` lists conversations

---

## Related Resources

- **sweet-cookie npm**: https://www.npmjs.com/package/@steipete/sweet-cookie
- **sweet-cookie GitHub**: https://github.com/steipete/sweet-cookie
- **Chromium OSCrypt**: https://source.chromium.org/chromium/chromium/src/+/main:components/os_crypt/
- **Chrome cookie decryption (Python)**: https://stackoverflow.com/questions/60269321/

---

## Quick Test Script

Save as `test-v20.ts` in sweet-cookie fork:

```typescript
import { getCookies } from '@steipete/sweet-cookie';

const chromeBetaProfile = process.env.LOCALAPPDATA + '/Google/Chrome Beta/User Data/Default';

const result = await getCookies({
  url: 'https://www.willhaben.at',
  browsers: ['chrome'],
  chromeProfile: chromeBetaProfile,
  debug: true,
});

console.log('Cookies found:', result.cookies.length);
console.log('Warnings:', result.warnings);

if (result.cookies.length > 0) {
  console.log('SUCCESS: v20 decryption works!');
  console.log('Sample cookie:', result.cookies[0].name, '=', result.cookies[0].value?.substring(0, 20));
} else {
  console.log('FAILED: No cookies decrypted');
}
```

Run with: `npx tsx test-v20.ts`

---

## Contact

If questions, check:
1. This handover document
2. The willhaben-agent codebase: `src/agents/auth.ts`, `src/agents/messaging.ts`
3. Chrome DevTools MCP can bypass this issue (works via browser automation)
