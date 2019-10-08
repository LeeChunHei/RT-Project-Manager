// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	// let disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
	// 	// The code you place here will be executed every time your command is executed

	// 	// Display a message box to the user
	// 	vscode.window.showInformationMessage('Hello World!');
	// });

	vscode.workspace.onDidOpenTextDocument((doc: vscode.TextDocument) => {
		if (doc.fileName.indexOf('.h') !== -1 && doc.uri.scheme === "file") {
			if (fs.readFileSync(doc.uri.fsPath, 'utf8') === '') {
				if (doc.uri.fsPath) {
					let temp = doc.uri.fsPath.split('\\').pop();
					if (temp) {
						let file_name = String(temp.split('/').pop()).replace('.', '_').toUpperCase();
						fs.writeFileSync(doc.uri.fsPath, '#ifndef ' + file_name + '\n#define ' + file_name + '\n\n\n\n#endif');
					}
				}
			}
		}
	});
	
	context.subscriptions.push(vscode.commands.registerCommand('rt-project-manager.initWorkspace', () => {
		const options: vscode.SaveDialogOptions = {
			filters: {
				'VSCode Workspace': ['code-workspace']
			}
		};
		vscode.window.showSaveDialog(options).then(uri => {
			if(uri){
				fs.writeFileSync(uri.fsPath,'{\n"folders": []\n}');
				vscode.commands.executeCommand('vscode.openFolder', uri);
			}
		});
	}));

	// context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }
