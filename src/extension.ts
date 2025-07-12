import { exec } from "child_process";
import * as path from "path";
import { promisify } from "util";
import * as vscode from "vscode";

const execPromise = promisify(exec);

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "external-lazygit.openLazygit",
    () => {
      const weztermPath = vscode.workspace
        .getConfiguration()
        .get<string>("external-lazygit.weztermPath", "");
      if (!weztermPath) {
        vscode.window.showErrorMessage(
          "Please set the external-lazygit.weztermPath configuration in your settings.json"
        );
        return;
      }

      openLazygitInWezterm(weztermPath);
    }
  );

  context.subscriptions.push(disposable);
}

async function openLazygitInWezterm(wezterm: string) {
  if (!wezterm) {
    return;
  }

  const command = getCommand();
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri?.path ?? "~";
  const weztermInstances = await getWeztermInstances(wezterm);

  if (weztermInstances.length) {
    const existingLazygitInstance = weztermInstances.find(
      (w: any) => w.title === "lazygit" && isUnderSamePath(w.cwd, cwd)
    );
    const execCommand = existingLazygitInstance
      ? `${wezterm} cli activate-tab --tab-id ${existingLazygitInstance.tab_id}`
      : `${wezterm} cli spawn --cwd ${cwd} -- ${command}`;

    await execPromise(execCommand);
    exec(`osascript -e 'tell application "WezTerm" to activate'`);
    return;
  }

  await execPromise(`osascript -e 'tell application "WezTerm" to activate'`);
  exec(`${wezterm} cli spawn --cwd ${cwd} -- ${command}`);
}

function isUnderSamePath(weztermCwd: string, cwd: string) {
  const normalizedWeztermCwd = new URL(weztermCwd).pathname;
  const relativePath = path.relative(normalizedWeztermCwd, cwd);
  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

async function getWeztermInstances(wezterm: string) {
  try {
    const { stdout } = await execPromise(`${wezterm} cli list --format json`);
    return JSON.parse(stdout) ?? [];
  } catch (error) {
    return [];
  }
}

function getCommand() {
  return "lazygit && exit";
}

// This method is called when your extension is deactivated
export function deactivate() {}
