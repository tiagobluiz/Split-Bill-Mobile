import { useSplitStore } from "../split/store";

export const BACKUP_BACKGROUND_TASK_NAME = "split-bill-backup-task-v1";

type BackgroundTaskModule = typeof import("expo-background-task");
type TaskManagerModule = typeof import("expo-task-manager");

let taskWasDefinedForSession = false;

function getTaskModules():
  | {
      backgroundTask: BackgroundTaskModule;
      taskManager: TaskManagerModule;
    }
  | null {
  try {
    const backgroundTask = require("expo-background-task") as BackgroundTaskModule;
    const taskManager = require("expo-task-manager") as TaskManagerModule;
    return {
      backgroundTask,
      taskManager,
    };
  } catch {
    return null;
  }
}

function defineTaskIfPossible() {
  if (taskWasDefinedForSession) {
    return true;
  }
  const modules = getTaskModules();
  if (!modules) {
    return false;
  }
  const { taskManager, backgroundTask } = modules;
  if (
    typeof taskManager.isTaskDefined !== "function" ||
    typeof taskManager.defineTask !== "function"
  ) {
    return false;
  }
  if (!taskManager.isTaskDefined(BACKUP_BACKGROUND_TASK_NAME)) {
    taskManager.defineTask(BACKUP_BACKGROUND_TASK_NAME, async () => {
      try {
        await useSplitStore
          .getState()
          .runScheduledBackupIfDue("background");
        return backgroundTask.BackgroundTaskResult.Success;
      } catch (error) {
        console.warn("Background backup task failed", error);
        return backgroundTask.BackgroundTaskResult.Failed;
      }
    });
  }
  taskWasDefinedForSession = true;
  return true;
}

export async function registerBackupBackgroundTask() {
  if (!defineTaskIfPossible()) {
    return false;
  }
  const modules = getTaskModules();
  if (!modules) {
    return false;
  }
  const { taskManager, backgroundTask } = modules;
  if (typeof taskManager.isAvailableAsync !== "function") {
    return false;
  }
  let available = false;
  try {
    available = await taskManager.isAvailableAsync();
  } catch {
    return false;
  }
  if (!available) {
    return false;
  }
  const alreadyRegistered = await taskManager.isTaskRegisteredAsync(
    BACKUP_BACKGROUND_TASK_NAME,
  );
  if (alreadyRegistered) {
    return true;
  }

  await backgroundTask.registerTaskAsync(BACKUP_BACKGROUND_TASK_NAME, {
    minimumInterval: 60 * 6,
  });
  return true;
}

export async function unregisterBackupBackgroundTask() {
  const modules = getTaskModules();
  if (!modules) {
    return;
  }
  const { taskManager, backgroundTask } = modules;
  const registered = await taskManager.isTaskRegisteredAsync(
    BACKUP_BACKGROUND_TASK_NAME,
  );
  if (!registered) {
    return;
  }
  await backgroundTask.unregisterTaskAsync(BACKUP_BACKGROUND_TASK_NAME);
}

void defineTaskIfPossible();
