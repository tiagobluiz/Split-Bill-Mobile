import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "split-bill-mobile.db";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getAppDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

function isRetryableSqliteHandleError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("NativeDatabase.prepareAsync") || message.includes("NullPointerException");
}

export async function withAppDatabaseRetry<T>(operation: (db: SQLite.SQLiteDatabase) => Promise<T>) {
  const db = await getAppDatabase();
  try {
    return await operation(db);
  } catch (error) {
    if (!isRetryableSqliteHandleError(error)) {
      throw error;
    }
    databasePromise = null;
    const retryDb = await getAppDatabase();
    return operation(retryDb);
  }
}
