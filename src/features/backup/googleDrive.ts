import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";

type GoogleDriveSession = {
  accessToken: string;
  refreshToken?: string;
  issuedAt: number;
  expiresIn?: number;
  tokenType?: string;
  accountEmail?: string;
};

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const SESSION_KEY = "google-drive-session-v1";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

function getClientId() {
  return process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID?.trim() ?? "";
}

function isExpired(session: GoogleDriveSession) {
  if (!session.expiresIn) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= session.issuedAt + session.expiresIn - 60;
}

async function saveSession(session: GoogleDriveSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearGoogleDriveSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

async function loadSession() {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as GoogleDriveSession;
    if (!parsed.accessToken || !parsed.issuedAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function fetchAccountEmail(accessToken: string) {
  const response = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!response.ok) {
    return undefined;
  }
  const payload = (await response.json()) as { email?: string };
  if (typeof payload.email !== "string" || !payload.email.trim()) {
    return undefined;
  }
  return payload.email.trim();
}

async function refreshIfNeeded(
  session: GoogleDriveSession,
): Promise<GoogleDriveSession> {
  if (!isExpired(session)) {
    return session;
  }

  const clientId = getClientId();
  if (!clientId || !session.refreshToken) {
    return session;
  }

  try {
    const refreshed = await AuthSession.refreshAsync(
      {
        clientId,
        refreshToken: session.refreshToken,
      },
      GOOGLE_DISCOVERY,
    );
    const nextSession: GoogleDriveSession = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? session.refreshToken,
      issuedAt: refreshed.issuedAt,
      expiresIn: refreshed.expiresIn,
      tokenType: refreshed.tokenType,
      accountEmail: session.accountEmail,
    };
    await saveSession(nextSession);
    return nextSession;
  } catch {
    return session;
  }
}

export async function getGoogleDriveSession() {
  const session = await loadSession();
  if (!session) {
    return null;
  }
  const refreshed = await refreshIfNeeded(session);
  return refreshed;
}

export async function connectGoogleDrive() {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("google-drive-client-id-missing");
  }

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "split-bill-mobile",
    path: "oauthredirect",
  });
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: [DRIVE_SCOPE, "openid", "email", "profile"],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: {
      access_type: "offline",
      prompt: "consent",
    },
  });
  await request.makeAuthUrlAsync(GOOGLE_DISCOVERY);
  const result = await request.promptAsync(GOOGLE_DISCOVERY);

  if (result.type !== "success") {
    throw new Error("google-drive-auth-cancelled");
  }
  const code = result.params?.code;
  if (!code) {
    throw new Error("google-drive-auth-missing-code");
  }

  const tokenResponse = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code,
      redirectUri,
      extraParams: request.codeVerifier
        ? {
            code_verifier: request.codeVerifier,
          }
        : undefined,
    },
    GOOGLE_DISCOVERY,
  );
  const accountEmail = await fetchAccountEmail(tokenResponse.accessToken);
  const session: GoogleDriveSession = {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    issuedAt: tokenResponse.issuedAt,
    expiresIn: tokenResponse.expiresIn,
    tokenType: tokenResponse.tokenType,
    ...(accountEmail ? { accountEmail } : {}),
  };
  await saveSession(session);

  return {
    connected: true,
    accountEmail,
  };
}

async function getAuthorizedAccessToken() {
  const session = await getGoogleDriveSession();
  if (!session?.accessToken) {
    throw new Error("google-drive-not-connected");
  }
  return session.accessToken;
}

export async function uploadBackupToGoogleDrive(
  fileName: string,
  snapshotContent: string,
) {
  const accessToken = await getAuthorizedAccessToken();
  const boundary = `splitbill_${Date.now()}`;
  const metadata = JSON.stringify({
    name: fileName,
    parents: ["appDataFolder"],
  });
  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${snapshotContent}\r\n` +
    `--${boundary}--`;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!response.ok) {
    throw new Error("google-drive-upload-failed");
  }

  const payload = (await response.json()) as { id?: string; name?: string };
  return {
    id: payload.id ?? "",
    name: payload.name ?? fileName,
  };
}

export async function downloadLatestBackupFromGoogleDrive() {
  const accessToken = await getAuthorizedAccessToken();
  const listUrl =
    "https://www.googleapis.com/drive/v3/files?" +
    [
      "spaces=appDataFolder",
      "pageSize=1",
      "orderBy=modifiedTime%20desc",
      "q=trashed=false",
      "fields=files(id,name,modifiedTime)",
    ].join("&");
  const listResponse = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!listResponse.ok) {
    throw new Error("google-drive-list-failed");
  }
  const listPayload = (await listResponse.json()) as {
    files?: Array<{ id?: string; name?: string }>;
  };
  const fileId = listPayload.files?.[0]?.id;
  if (!fileId) {
    throw new Error("google-drive-no-backups");
  }

  const fileResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!fileResponse.ok) {
    throw new Error("google-drive-download-failed");
  }
  const content = await fileResponse.text();
  return {
    fileName: listPayload.files?.[0]?.name ?? "backup.sbbk",
    content,
  };
}
