import { exec } from "child_process";
import * as path from "path";
import { promisify } from "util";
import * as vscode from "vscode";

const execPromise = promisify(exec);
let terminal: vscode.Terminal | null;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "external-lazygit.openLazygit",
    () => {
      const weztermPath = vscode.workspace
        .getConfiguration()
        .get<string>("external-lazygit.weztermPath", "");
      if (weztermPath) {
        openLazygitInWezterm(weztermPath);
      } else {
        openLazygitInVscode();
      }
    }
  );
  context.subscriptions.push(disposable);

  const quitListener = vscode.window.onDidEndTerminalShellExecution((e) => {
    if (e.terminal.name !== terminal?.name) {
      return;
    }

    if (e.execution.commandLine.value.includes("lazygit")) {
      terminal?.hide();
      terminal?.sendText("clear");
    }
  });
  context.subscriptions.push(quitListener);
}

async function openLazygitInVscode() {
  createVscodeTerminal();
  if (!terminal) {
    vscode.window.showErrorMessage(
      "Failed to create terminal for lazygit. Please try again."
    );
    return;
  }

  terminal.sendText(getCommand(false));
  vscode.commands.executeCommand("workbench.action.toggleMaximizedPanel");
  terminal.show();
}

function createVscodeTerminal() {
  if (!terminal || terminal.exitStatus !== undefined) {
    terminal = vscode.window.createTerminal({
      name: "external-lazygit",
      hideFromUser: true,
      location: vscode.TerminalLocation.Panel,
    });
  }
}

async function openLazygitInWezterm(wezterm: string) {
  if (!wezterm) {
    return;
  }

  try {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri?.path ?? "~";
    const weztermInstances = await getWeztermInstances(wezterm);

    if (weztermInstances.length) {
      const existingLazygitInstance = weztermInstances.find(
        (w: any) => w.title === "lazygit" && isUnderSamePath(w.cwd, cwd)
      );
      const execCommand = existingLazygitInstance
        ? `${wezterm} cli activate-tab --tab-id ${existingLazygitInstance.tab_id}`
        : `${wezterm} cli spawn --cwd ${cwd} -- ${getCommand()}`;

      await execPromise(execCommand);
      exec(`osascript -e 'tell application "WezTerm" to activate'`);
      return;
    }

    await execPromise(`osascript -e 'tell application "WezTerm" to activate'`);
    exec(
      `${wezterm} cli spawn --cwd ${cwd} -- ${getCommand(
        false
      )} && ${wezterm} cli kill-pane --pane-id 0`
    );
  } catch (error) {
    vscode.window.showErrorMessage((error as any).message);
  }
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

function getCommand(closeOnExit = true) {
  return closeOnExit ? "lazygit && exit" : "lazygit";
}

// This method is called when your extension is deactivated
export function deactivate() {
  terminal?.dispose();
}
