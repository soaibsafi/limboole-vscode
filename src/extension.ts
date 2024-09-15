import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) {

	let panel: vscode.WebviewPanel | undefined;

	const registerCommand = (commandName: string, checkParameter: string) => {
		const command = vscode.commands.registerCommand(commandName, async () => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				let limboolePath = vscode.workspace.getConfiguration('limboole').get<string>('path');
				if (!limboolePath) {
					// Detect the platform and architecture
					const platform = os.platform();
					const arch = os.arch();

					// Set the default path based on the platform and architecture
					switch (platform) {
						case 'win32':
							limboolePath = path.join(__dirname, 'lib', 'limboole.exe');
							break;
						case 'linux':
							if (arch === 'x64') {
								limboolePath = path.join(__dirname, 'lib', 'limboole-linux-amd64.exe');
							} else if (arch === 'ia32') {
								limboolePath = path.join(__dirname, 'lib', 'limboole-linux-x86.exe');
							}
							break;
						case 'darwin':
							limboolePath = path.join(__dirname, 'lib', 'limbooleOSX');
							break;
						default:
							vscode.window.showErrorMessage('Unsupported platform. Please set the limboole.path in settings.');
							return;
					}

					if (platform !== 'win32') {
						try {
							if (!limboolePath) {
								throw new Error('Please set the limboole.path in settings.');
							}
							fs.chmodSync(limboolePath, '755');
						} catch (err) {
							vscode.window.showErrorMessage(`Failed to set executable permissions for ${limboolePath}`);
							return;
						}
					}
				}

				const document = editor.document;
				const code = document.getText();

				try {
					if (!limboolePath) {
						throw new Error('Please set the limboole.path in settings.');
					}
					const result = await runLimboole(limboolePath, code, checkParameter);
					if (!panel) {
						panel = vscode.window.createWebviewPanel(
							'limboolePreview',
							'Limboole',
							vscode.ViewColumn.Two,
							{}
						);

						panel.onDidDispose(() => {
							panel = undefined;
						});
					}
					panel.webview.html = `<html><body><pre>${result}</pre></body></html>`;
				} catch (error) {
					if (!panel) {
						panel = vscode.window.createWebviewPanel(
							'limboolePreview',
							'Limboole',
							vscode.ViewColumn.Two,
							{}
						);

						panel.onDidDispose(() => {
							panel = undefined;
						});
					}
					panel.webview.html = `<html><body><pre>${error}</pre></body></html>`;
					panel.reveal(vscode.ViewColumn.Two);
				}
			}
		});
		context.subscriptions.push(command);
	};

	// Register commands
	registerCommand('limboole.sat', '-s');
	registerCommand('limboole.val', '-v');
	registerCommand('limboole.cnf', '-d');

	const codeLensProvider = new LimbooleCodeLensProvider();
	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider({ scheme: 'file', language: 'limboole' }, codeLensProvider) // Language identifier for SMT2
	);
}

async function runLimboole(limboolePath: string, code: string, check: string) {
	const tempFileName = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}.limboole`;
	const tempFilePath = path.join(os.tmpdir(), tempFileName);
	fs.writeFileSync(tempFilePath, code);

	const command = `"${limboolePath}" "${tempFilePath}" "${check}"`;

	return new Promise<string>((resolve, reject) => {
		exec(command, (error, stdout, stderr) => {
			// Clean up temporary file
			fs.unlinkSync(tempFilePath);

			if (error) {
				const errorMessage = stderr.replace(/.*\.limboole:(\d+:\d+:)/g, '$1');
				reject(`Error: ${errorMessage}`);
				return;
			}
			resolve(stdout);
		});
	});
}

export function deactivate() { }

class LimbooleCodeLensProvider implements vscode.CodeLensProvider {
	provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
		const topOfDocument = new vscode.Range(0, 0, 0, 0);
		const code = document.getText();

		const checkSatCodeLens = new vscode.CodeLens(topOfDocument, {
			title: '▶ Check SAT',
			command: 'limboole.sat',
			arguments: [code]
		});

		const checkValCodeLens = new vscode.CodeLens(topOfDocument, {
			title: '▶ Check VAL',
			command: 'limboole.val',
			arguments: [code]
		});

		return [checkSatCodeLens, checkValCodeLens];
	}
}